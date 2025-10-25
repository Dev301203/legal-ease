from pydantic import BaseModel
from typing import Optional, Literal, List, Dict, Any

# Audio and Legal API Response Models
class AudioResponse(BaseModel):
    message: str
    audio_data: Optional[bytes] = None  # Base64 encoded audio

class ContextResponse(BaseModel):
    context: str

# Model Request Schema
class ModelRequest(BaseModel):
    model: str
    question: str
    context: Optional[str] = None

# Tree Generation Response Models
class TreeNode(BaseModel):
    speaker: str
    line: str
    level: int
    reflects_personality: str
    responses: List['TreeNode'] = []

class ScenariosTreeResponse(BaseModel):
    scenarios_tree: TreeNode

class TreeResponse(BaseModel):
    tree_id: int
    case_id: int
    simulation_goal: str
    scenarios_tree: TreeNode
    error: Optional[str] = None
    raw_response: Optional[str] = None