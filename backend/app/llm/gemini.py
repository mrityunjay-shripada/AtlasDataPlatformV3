import json, logging, re
from typing import Any, List, Optional, Type, TypeVar
import google.generativeai as genai
from pydantic import BaseModel, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential_jitter
from app.config import get_settings
from app.llm.base import LLMProvider, LLMResponse, LLMRole, LLMUsage, Message

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


def _extract_text(response) -> str:
    """Safe text extraction for thinking / multi-part Gemini responses."""
    try:
        t = getattr(response, "text", None)
        if t:
            return t
    except Exception as e:
        logger.warning("response.text failed: %s", e)
    parts_out = []
    try:
        for cand in getattr(response, "candidates", None) or []:
            content = getattr(cand, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", None) or []:
                # skip pure thought signatures if exposed as attributes
                txt = getattr(part, "text", None)
                if txt:
                    parts_out.append(txt)
    except Exception as e:
        logger.warning("candidate part extraction failed: %s", e)
    return "\n".join(parts_out).strip()


def _extract_json_blob(text: str) -> str:
    text = (text or "").strip()
    if not text:
        raise ValueError("empty model response")
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        if text.lower().startswith("json"):
            text = text[4:].lstrip()
    # try whole text first
    try:
        json.loads(text)
        return text
    except Exception:
        pass
    # find first {...} block
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        return m.group(0)
    raise ValueError(f"no JSON object in response: {text[:200]}")


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self):
        s = get_settings()
        if not s.gemini_api_key:
            raise ValueError("GEMINI_API_KEY required")
        genai.configure(api_key=s.gemini_api_key)
        self.model_name = s.gemini_model or "gemini-3.5-flash"
        self._model = genai.GenerativeModel(self.model_name)
        logger.info("Gemini model=%s", self.model_name)

    def _contents(self, messages: List[Message]):
        out, sys = [], ""
        for m in messages:
            if m.role == LLMRole.SYSTEM:
                sys += m.content + "\n\n"
                continue
            role = "user" if m.role == LLMRole.USER else "model"
            text = (sys + m.content) if sys and role == "user" else m.content
            out.append({"role": role, "parts": [text]})
            sys = ""
        return out

    @retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(1, 15))
    async def generate(self, messages: List[Message], temperature=0.2, max_tokens=8192, **kw) -> LLMResponse:
        cfg: dict[str, Any] = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }
        if kw.get("json"):
            cfg["response_mime_type"] = "application/json"
        r = self._model.generate_content(self._contents(messages), generation_config=cfg)
        text = _extract_text(r)
        u = LLMUsage(
            prompt_tokens=getattr(r.usage_metadata, "prompt_token_count", 0) or 0,
            completion_tokens=getattr(r.usage_metadata, "candidates_token_count", 0) or 0,
            total_tokens=getattr(r.usage_metadata, "total_token_count", 0) or 0,
            model=self.model_name,
            provider=self.name,
        )
        return LLMResponse(content=text, usage=u)

    async def generate_structured(
        self,
        messages,
        schema: Type[T],
        temperature=0.1,
        max_tokens=8192,
        max_retries=3,
        **kw,
    ):
        instr = (
            "Respond ONLY with valid JSON matching this schema. "
            "No markdown fences, no commentary.\n"
            f"{json.dumps(schema.model_json_schema(), indent=2)}"
        )
        msgs = [Message(role=LLMRole.SYSTEM, content=instr)] + messages
        usage = LLMUsage(model=self.model_name, provider=self.name)
        last = None
        for attempt in range(max_retries):
            try:
                # first tries with JSON mime; if empty/fail, retry without
                use_json_mime = attempt == 0
                resp = await self.generate(
                    msgs,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    json=use_json_mime,
                )
                usage.total_tokens += resp.usage.total_tokens
                blob = _extract_json_blob(resp.content)
                return schema.model_validate(json.loads(blob)), usage
            except Exception as e:
                last = e
                logger.warning("structured attempt %s failed: %s", attempt + 1, e)
                msgs.append(
                    Message(
                        role=LLMRole.USER,
                        content=f"Invalid JSON: {e}. Return corrected JSON object only.",
                    )
                )
        raise ValueError(f"structured output failed: {last}")
