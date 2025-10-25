from pydantic import BaseModel
from typing import Optional, Literal

# Audio and Legal API Response Models
class AudioResponse(BaseModel):
    message: str
    audio_data: Optional[bytes] = None  # Base64 encoded audio

class ContextResponse(BaseModel):
    context: str