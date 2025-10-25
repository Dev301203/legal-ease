from pydantic import BaseModel
from typing import Optional, Literal
from typing import List
from app.models import Message

# Audio and Legal API Response Models
class AudioResponse(BaseModel):
    message: str
    audio_data: Optional[bytes] = None  # Base64 encoded audio

class ContextResponse(BaseModel):
    context: str


class ModelRequest(BaseModel):
    question: str



class ConversationTurn(BaseModel):
    party: str
    statement: str

class ConversationResponse(BaseModel):
    conversation: List[ConversationTurn]


def map_role_to_party(role: str) -> str:
    role = role.lower()
    if role == "user":
        return "Party A"
    elif role == "assistant":
        return "Party B"
    elif role == "system":
        return "System"
    else:
        return "Unknown"


def messages_to_conversation(messages: list[Message]) -> ConversationResponse:
    conversation_turns = [
        ConversationTurn(
            party=map_role_to_party(msg.role),
            statement=msg.content
        )
        for msg in messages
    ]
    return ConversationResponse(conversation=conversation_turns)
