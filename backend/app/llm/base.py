from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Type, TypeVar
from uuid import uuid4
from pydantic import BaseModel

class LLMRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"

@dataclass
class Message:
    role: LLMRole
    content: str

@dataclass
class LLMUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    model: str = ""
    provider: str = ""

@dataclass
class LLMResponse:
    content: str
    usage: LLMUsage
    request_id: str = field(default_factory=lambda: str(uuid4()))

T = TypeVar("T", bound=BaseModel)

class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def generate(self, messages: List[Message], **kwargs: Any) -> LLMResponse: ...

    @abstractmethod
    async def generate_structured(
        self, messages: List[Message], schema: Type[T], **kwargs: Any
    ) -> tuple[T, LLMUsage]: ...
