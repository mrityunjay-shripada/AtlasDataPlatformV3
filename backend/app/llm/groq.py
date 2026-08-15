import json, logging
from typing import List, Type, TypeVar
from groq import AsyncGroq
from pydantic import BaseModel, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential_jitter
from app.config import get_settings
from app.llm.base import LLMProvider, LLMResponse, LLMRole, LLMUsage, Message

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

class GroqProvider(LLMProvider):
    name = "groq"
    def __init__(self):
        s = get_settings()
        if not s.groq_api_key:
            raise ValueError("GROQ_API_KEY required")
        self.client = AsyncGroq(api_key=s.groq_api_key)
        self.model_name = s.groq_model

    @retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(1, 12))
    async def generate(self, messages: List[Message], temperature=0.2, max_tokens=2048, **kw) -> LLMResponse:
        kwargs = {
            "model": self.model_name,
            "messages": [{"role": m.role.value, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if kw.get("json"):
            kwargs["response_format"] = {"type": "json_object"}
        r = await self.client.chat.completions.create(**kwargs)
        text = r.choices[0].message.content or ""
        u = r.usage
        return LLMResponse(
            content=text,
            usage=LLMUsage(
                prompt_tokens=u.prompt_tokens if u else 0,
                completion_tokens=u.completion_tokens if u else 0,
                total_tokens=u.total_tokens if u else 0,
                model=self.model_name, provider=self.name,
            ),
        )

    async def generate_structured(self, messages, schema: Type[T], temperature=0.1, max_tokens=1024, max_retries=3, **kw):
        instr = f"Respond with a single JSON object matching this schema only.\n{json.dumps(schema.model_json_schema())}"
        msgs = [Message(role=LLMRole.SYSTEM, content=instr)] + messages
        usage = LLMUsage(model=self.model_name, provider=self.name)
        last = None
        for _ in range(max_retries):
            try:
                resp = await self.generate(msgs, temperature=temperature, max_tokens=max_tokens, json=True)
                usage.total_tokens += resp.usage.total_tokens
                text = resp.content.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                return schema.model_validate(json.loads(text)), usage
            except (json.JSONDecodeError, ValidationError, ValueError) as e:
                last = e
                msgs.append(Message(role=LLMRole.USER, content=f"Invalid: {e}. JSON only."))
        raise ValueError(f"groq structured failed: {last}")
