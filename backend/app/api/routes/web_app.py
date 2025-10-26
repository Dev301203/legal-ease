import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.api.routes.audio_models import get_session
from app.crud import get_messages_by_tree, get_selected_messages_between, \
    get_tree, delete_messages_after_children, get_message_children, \
    update_message_selected, get_case_context
from app.models import Message
from app.schemas import TreeResponse
from app.api.routes.tree_generation import create_tree, save_messages_to_tree

from app.models import Message, Case, Simulation
from typing import List, Optional

from app.schemas import CaseWithTreeCount
from sqlmodel import select, func

router = APIRouter()


class ContinueConversationRequest(BaseModel):
    case_id: int
    tree_id: Optional[int] = None
    simulation_goal: str = "Reach a favorable settlement"


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
async def continue_conversation(request: ContinueConversationRequest, session: Session = Depends(get_session)):
    """
    Continue a conversation by either generating new messages or returning existing children.
    If tree_id is provided:
        - If the last selected message is a leaf node, generates new messages and saves them.
        - If not a leaf node, returns the existing children of the last selected message.
    If no tree_id is provided, assumes no prior history and creates a new tree.
    """
    case_id = request.case_id
    tree_id = request.tree_id
    simulation_goal = request.simulation_goal
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


@router.get("/trees/{simulation_id}/messages", response_model=List[dict])
def get_tree_messages_endpoint(
    simulation_id: int,
    session: Session = Depends(get_session),
):
    """
    Return all messages for a specific simulation_id (both selected and unselected)
    in a hierarchical chronological structure.
    """

    # Reuse your existing function
    messages = get_tree(session, simulation_id)

    if not messages:
        raise HTTPException(status_code=404, detail="No messages found for this simulation_id")

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
            "simulation_id": m.simulation_id,
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


@router.post("/messages/create", response_model=Message)
def create_message(
    tree_id: int,
    parent_id: int | None,
    content: str,
    role: str,
    db: Session = Depends(get_session),
):
    """
    Create a new message in the conversation tree.
    Used for custom user responses that aren't from the predefined options.
    """
    new_message = Message(
        tree_id=tree_id,
        parent_id=parent_id,
        content=content,
        role=role,
        selected=True,  # Custom messages are automatically selected
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return new_message

@router.get("/cases", response_model=List[CaseWithTreeCount])
def get_all_cases(db: Session = Depends(get_session)):
    """Return all cases with the number of trees for each case."""
    cases = db.exec(select(Case)).all()

    result = []
    for case in cases:
        tree_count = db.exec(
            select(func.count(Simulation.id)).where(Simulation.case_id == case.id)
        ).one()  # returns a tuple like (count,)
        result.append(
            CaseWithTreeCount(
                id=case.id,
                name=case.name,
                party_a=case.party_a,
                party_b=case.party_b,
                context=case.context,
                last_modified=case.last_modified,
                scenario_count=tree_count,  # extract integer
            )
        )
    return result


@router.get("/cases/{case_id}")
def get_case_with_simulations(case_id: int, session: Session = Depends(get_session)):
    """
    Get one case by ID, including its background and all simulations.
    Returns data matching the CaseData interface for the frontend.
    """
    # Fetch case
    case = session.exec(select(Case).where(Case.id == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case with id {case_id} not found.")

    # Fetch simulations
    simulations = session.exec(select(Simulation).where(Simulation.case_id == case.id)).all()

    # Count messages per simulation (optional but fits nodeCount)
    node_counts = {}
    for sim in simulations:
        count = session.exec(
            select(func.count(Message.id)).where(Message.simulation_id == sim.id)
        ).first()
        node_counts[sim.id] = count or 0

    # === Parse background (stored JSON in `context`) ===
    # Your Case.context is a JSON string
    try:
        background_data = json.loads(case.context)
    except Exception:
        background_data = {}

    background = {
        "party_a": background_data.get("parties", {}).get("party_A", {}).get("name"),
        "party_b": background_data.get("parties", {}).get("party_B", {}).get("name"),
        "key_issues": background_data.get("key_issues", ""),
        "general_notes": background_data.get("general_notes", ""),
    }

    # === Construct response ===
    return {
        "id": str(case.id),
        "name": case.name,
        "summary": case.summary,
        "background": background,
        "simulations": [
            {
                "id": str(sim.id),
                "headline": sim.headline,
                "brief": sim.brief,
                "created_at": sim.created_at.isoformat(),
                "node_count": node_counts.get(sim.id, 0)
            }
            for sim in simulations
        ],
    }