from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any

from app.api.routes.audio_models import get_session
from app.crud import get_messages_by_tree, get_selected_messages_between, \
    get_tree, delete_messages_after_children, get_message_children, \
    update_message_selected, get_case_context
from app.models import Message
from app.schemas import TreeResponse
from app.api.routes.tree_generation import create_tree, save_messages_to_tree

router = APIRouter()


def get_last_message_id_from_tree(session: Session, tree_id: int) -> int:
    """
    Get the ID of the last selected message in a tree.
    Returns the ID of the deepest selected message in the tree.
    """
    # Get all selected messages in the tree
    statement = select(Message).where(
        (Message.tree_id == tree_id) & (Message.selected == True)
    )
    messages = session.exec(statement).all()
    
    if not messages:
        raise HTTPException(status_code=404, detail=f"No selected messages found in tree {tree_id}")
    
    # Find the deepest selected message (the one with no selected children)
    for msg in messages:
        # Check if this message has any selected children
        has_selected_children = session.exec(
            select(Message).where(
                (Message.parent_id == msg.id) & (Message.selected == True)
            )
        ).first() is not None
        
        if not has_selected_children:
            return msg.id
    
    # Fallback: return the message with the highest ID
    return max(msg.id for msg in messages)

def is_leaf_node(session: Session, message_id: int) -> bool:
    """
    Check if a message is a leaf node (has no children).
    Returns True if the message has no children, False otherwise.
    """
    children_stmt = select(Message).where(Message.parent_id == message_id)
    children = session.exec(children_stmt).all()
    return len(children) == 0

def get_message_children_for_tree(session: Session, message_id: int) -> list[Message]:
    """
    Get all direct children of a message.
    Returns a list of Message objects that are direct children of the given message.
    """
    children_stmt = select(Message).where(Message.parent_id == message_id)
    children = session.exec(children_stmt).all()
    return children


@router.post("/continue-conversation", response_model=TreeResponse)
async def continue_conversation(case_id: int, tree_id: int = None, simulation_goal: str = "Reach a favorable settlement", session: Session = Depends(get_session)):
    """
    Continue a conversation by either generating new messages or returning existing children.
    If tree_id is provided:
        - If the last selected message is a leaf node, generates new messages and saves them.
        - If not a leaf node, returns the existing children of the last selected message.
    If no tree_id is provided, assumes no prior history and creates a new tree.
    """
    try:
        # Get the case context
        case_background = get_case_context(session, case_id)
        if not case_background:
            raise HTTPException(status_code=404, detail=f"Case with id {case_id} not found")

        # If no tree_id provided, assume no prior history and create new tree
        if tree_id is None:
            # No prior history - generate new tree
            tree_data = create_tree(case_background, "", simulation_goal, "")
            
            # Save the messages to the database (creates new tree)
            saved_tree_id = save_messages_to_tree(
                session, 
                case_id, 
                tree_data, 
                existing_tree_id=None, 
                last_message_id=None
            )

            # Return the generated tree data
            return {
                "tree_id": saved_tree_id,
                "case_id": case_id,
                "simulation_goal": simulation_goal,
                **tree_data
            }
        
        # Tree_id provided - continue existing conversation
        # Get the ID of the last selected message
        last_message_id = get_last_message_id_from_tree(session, tree_id)
        
        # Check if the last selected message is a leaf node
        if is_leaf_node(session, last_message_id):
            # Leaf node - generate new messages and save them
            messages_history = get_messages_by_tree(session, tree_id)
            last_message = session.get(Message, last_message_id)
            last_message_content = last_message.content if last_message else ""
            
            # Generate a tree of messages based on the case background and simulation goal
            tree_data = create_tree(case_background, messages_history, simulation_goal, last_message_content)

            # Save the messages to the database
            saved_tree_id = save_messages_to_tree(
                session, 
                case_id, 
                tree_data, 
                existing_tree_id=tree_id, 
                last_message_id=last_message_id
            )

            # Return the generated tree data
            return {
                "tree_id": saved_tree_id,
                "case_id": case_id,
                "simulation_goal": simulation_goal,
                **tree_data
            }
        else:
            # Not a leaf node - return existing children
            children = get_message_children_for_tree(session, last_message_id)
            
            # Convert children to the expected format
            children_responses = []
            for child in children:
                # Get grandchildren for each child
                grandchildren = get_message_children_for_tree(session, child.id)
                grandchildren_responses = []
                for grandchild in grandchildren:
                    grandchildren_responses.append({
                        "speaker": grandchild.role,
                        "line": grandchild.content,
                        "level": 3,
                        "reflects_personality": "Generated response",
                        "responses": []
                    })
                
                children_responses.append({
                    "speaker": child.role,
                    "line": child.content,
                    "level": 2,
                    "reflects_personality": "Generated response",
                    "responses": grandchildren_responses
                })
            
            # Create a mock scenarios_tree structure
            last_message = session.get(Message, last_message_id)
            scenarios_tree = {
                "speaker": last_message.role if last_message else "Player (My Lawyer)",
                "line": last_message.content if last_message else "",
                "level": 1,
                "reflects_personality": "Current message",
                "responses": children_responses
            }
            
            return {
                "tree_id": tree_id,
                "case_id": case_id,
                "simulation_goal": simulation_goal,
                "scenarios_tree": scenarios_tree
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error continuing conversation: {str(e)}")


@router.get("/trees/{tree_id}/messages", response_model=List[dict])
def get_tree_messages_endpoint(
    tree_id: int,
    session: Session = Depends(get_session),
):
    """
    Return all messages for a specific tree_id (both selected and unselected)
    in a hierarchical chronological structure.
    """

    # Reuse your existing function
    messages = get_tree(session, tree_id)

    if not messages:
        raise HTTPException(status_code=404, detail="No messages found for this tree_id")

    # Build mapping for hierarchy
    by_parent: dict[Optional[int], list[Message]] = {}
    for m in messages:
        by_parent.setdefault(m.parent_id, []).append(m)

    for children in by_parent.values():
        children.sort(key=lambda m: m.id)

    def build_tree(parent_id: Optional[int]) -> List[dict]:
        """Recursive builder for JSON hierarchy."""
        result = []
        for msg in by_parent.get(parent_id, []):
            result.append({
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "selected": msg.selected,
                "children": build_tree(msg.id),
            })
        return result

    tree_json = build_tree(None)
    return tree_json


@router.get("/messages/selected-path", response_model=List[dict])
def get_selected_messages_path(
    start_id: int = Query(..., description="Starting message ID"),
    end_id: int = Query(..., description="Ending message ID"),
    session: Session = Depends(get_session),
):
    """
    Return all selected messages between start_id and end_id (inclusive),
    in chronological order.
    """

    if start_id > end_id:
        raise HTTPException(status_code=400, detail="start_id must be <= end_id")

    messages = get_selected_messages_between(session, start_id, end_id)

    if not messages:
        raise HTTPException(status_code=404, detail="No selected messages found in this range")

    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "selected": m.selected,
            "parent_id": m.parent_id,
            "tree_id": m.tree_id,
        }
        for m in messages
    ]


@router.delete("/messages/trim-after/{message_id}")
def trim_messages_after_children(
    message_id: int,
    session: Session = Depends(get_session),
):
    """
    Delete all messages after the children of the given message.
    Keeps the given message and its direct children.
    """
    try:
        deleted_count = delete_messages_after_children(session, message_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {
        "message": f"Deleted {deleted_count} messages after message {message_id} and its children."
    }


@router.get("/messages/{message_id}/children", response_model=List[Message])
def get_children(message_id: int, db: Session = Depends(get_session)):
    """Get all direct children of a message."""
    children = get_message_children(db, message_id)
    return children  # returns [] if none found


@router.patch("/messages/{message_id}/select", response_model=Message)
def select_message(message_id: int, db: Session = Depends(get_session)):
    """Mark a message as selected=True."""
    message = update_message_selected(db, message_id)
    return message