from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
import base64
import io
import wave
import os
from openai import OpenAI
from app.core.config import settings
from app.core.db import engine
from app.crud import get_case_context, get_messages_by_tree
from app.schemas import TreeResponse, ScenariosTreeResponse
from app.models import Tree, Message
from sqlmodel import Session
from typing import Dict, Any

router = APIRouter()

# Database session dependency
def get_session():
    with Session(engine) as session:
        yield session

def extract_last_message_from_history(messages_history: str) -> str:
    """
    Extract the last message from the conversation history JSON string.
    Returns the statement of the last conversation turn, or empty string if no history.
    """
    if not messages_history or messages_history.strip() == "":
        return ""
    
    try:
        import json
        conversation_data = json.loads(messages_history)
        conversation = conversation_data.get("conversation", [])
        
        if conversation:
            last_turn = conversation[-1]
            return last_turn.get("statement", "")
        return ""
    except (json.JSONDecodeError, KeyError, IndexError):
        return ""

# Boson AI client configuration
def get_boson_client():
    """Get Boson AI client with proper error handling"""
    if not settings.BOSON_API_KEY:
        raise HTTPException(
            status_code=500, 
            detail="Boson API key not configured. Please set BOSON_API_KEY environment variable."
        )
    return OpenAI(api_key=settings.BOSON_API_KEY, base_url="https://hackathon.boson.ai/v1")

def create_tree(case_background: str, previous_statements: str, simulation_goal: str, last_message: str = None) -> Dict[str, Any]:
    """
    Create a tree of messages based on the case background and previous statements.
    Uses the Qwen3-32B-thinking-Hackathon model to generate a structured 3-level dialogue tree.
    """
    try:
        # Get Boson AI client
        client = get_boson_client()
        
        # Prepare the complete system message for legal simulation tree generation
        if last_message:
            level1_instruction = f"Level 1: Use the provided last message as the Level 1 statement: \"{last_message}\"\n"
            special_note = f"\nIMPORTANT: The Level 1 node must use exactly this text: \"{last_message}\"\n"
        else:
            level1_instruction = "Level 1: An opening statement from the \"Player (My Lawyer)\".\n"
            special_note = ""
            
        system_message = (
            "You are an expert legal simulation generator. Your task is to create a realistic, branching dialogue tree for a legal negotiation scenario. You will be given a detailed case background and a specific simulation goal. Your output MUST be a single, valid JSON object and nothing else.\n\n"
            "[TASK_DEFINITION]\n"
            "Generate a dialogue tree exactly three (3) levels deep.\n"
            f"{level1_instruction}"
            "Level 2: Three possible responses from the \"Opposing Counsel\".\n"
            "Level 3: For each Level 2 response, provide exactly three follow-up replies from the \"Player (My Lawyer)\".\n"
            "The dialogue must directly reflect the facts, disputed issues, and (most importantly) the personalities described in the [CASE_BACKGROUND]. The entire negotiation must be focused on achieving the [SIMULATION_GOAL].\n\n"
            "[INPUT_CONTEXT]\n\n"
            f"[CASE_BACKGROUND]\n{case_background}\n\n"
            f"[PREVIOUS STATEMENTS]\n{previous_statements}\n\n"
            f"[SIMULATION_GOAL] {simulation_goal}\n\n"
            f"{special_note}"
            "[OUTPUT_FORMAT_AND_CONSTRAINTS]\n"
            "Output format MUST be a single, valid JSON object.\n"
            "Do not include any text, explanations, or markdown formatting before or after the JSON object.\n"
            "The root of the JSON object must be scenarios_tree.\n"
            "Follow the schema precisely:\n"
            "speaker: (string) \"Player (My Lawyer)\" or \"Opposing Counsel\".\n"
            "line: (string) The text of the dialogue.\n"
            "level: (number) The depth of the node (1, 2, or 3).\n"
            "reflects_personality: (string) A brief justification of how this line reflects the facts or personality from the [CASE_BACKGROUND].\n"
            "responses: (array) An array of nested node objects. Level 3 nodes must have an empty [] responses array.\n\n"
            "[SCHEMA_DEFINITION]\n"
            "{\n"
            '  "scenarios_tree": {\n'
            '    "speaker": "Player (My Lawyer)",\n'
            '    "line": "string",\n'
            '    "level": 1,\n'
            '    "reflects_personality": "string",\n'
            '    "responses": [\n'
            '      {\n'
            '        "speaker": "Opposing Counsel",\n'
            '        "line": "string",\n'
            '        "level": 2,\n'
            '        "reflects_personality": "string",\n'
            '        "responses": [\n'
            '          {\n'
            '            "speaker": "Player (My Lawyer)",\n'
            '            "line": "string",\n'
            '            "level": 3,\n'
            '            "reflects_personality": "string",\n'
            '            "responses": []\n'
            '          }\n'
            '        ]\n'
            '      }\n'
            '    ]\n'
            '  }\n'
            "}"
        )
        
        # Create the conversation with the AI model
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": "Generate the legal negotiation dialogue tree now."}
        ]
        
        # Make API call to Qwen3-32B-thinking-Hackathon model
        response = client.chat.completions.create(
            model="Qwen3-32B-thinking-Hackathon",
            messages=messages,
            temperature=0.7,
            max_tokens=4000,
            response_format={"type": "json_object"}
        )
        
        # Extract the response content
        tree_content = response.choices[0].message.content

        # Try to parse as JSON
        try:
            import json
            tree_data = json.loads(tree_content)
            # Validate the response structure
            scenarios_response = ScenariosTreeResponse(**tree_data)
            return scenarios_response.model_dump()
        except (json.JSONDecodeError, ValueError) as e:
            # If JSON parsing fails, return a structured response
            return {
                "error": f"Failed to parse JSON response: {str(e)}",
                "raw_response": tree_content,
                "scenarios_tree": {
                    "speaker": "Player (My Lawyer)",
                    "line": "Error: Could not generate proper dialogue tree",
                    "level": 1,
                    "reflects_personality": "System error occurred",
                    "responses": []
                }
            }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating tree: {str(e)}")

@router.post("/generate-tree", response_model=TreeResponse)
async def generate_tree(case_id: int, tree_id: int = None, simulation_goal: str = "Reach a favorable settlement", session: Session = Depends(get_session)):
    """
    Generate a tree of messages based on the case background and previous statements.
    Creates a new tree in the database and returns the generated dialogue structure.
    Hot reload test - this comment should trigger a reload!
    """
    try:
        # Get the case context
        case_background = get_case_context(session, case_id)
        if not case_background:
            raise HTTPException(status_code=404, detail=f"Case with id {case_id} not found")

        # Get the messages history for the tree if tree_id is provided
        if tree_id is not None:
            messages_history = get_messages_by_tree(session, tree_id)
            # Extract the last message to use as Level 1
            last_message = extract_last_message_from_history(messages_history)
        else:
            messages_history = ""
            last_message = None
        
        # Generate a tree of messages based on the case background and simulation goal
        tree_data = create_tree(case_background, messages_history, simulation_goal, last_message)

        # Save the tree to the database
        # tree_id = save_tree_to_database(session, case_id, tree_data)

        # Return the generated tree data with the tree_id (if provided)
        return {
            "tree_id": tree_id,
            "case_id": case_id,
            "simulation_goal": simulation_goal,
            **tree_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating tree: {str(e)}")