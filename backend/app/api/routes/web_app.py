import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.api.routes.audio_models import get_session, summarize_background_helper, summarize_dialogue
from app.crud import get_messages_by_tree, get_selected_messages_between, \
    get_tree, delete_messages_after_children, get_message_children, \
    update_message_selected, get_case_context, delete_messages_including_children, \
    create_simulation, create_bookmark, get_bookmarks_by_simulation, delete_bookmark, \
    format_case_background_for_llm
from app.models import Message, Case, Simulation
from app.schemas import TreeResponse, SimulationCreate, SimulationResponse, CaseWithTreeCount, \
    BookmarkCreate, BookmarkResponse
from app.api.routes.tree_generation import create_tree, save_messages_to_tree

router = APIRouter()


class ContinueConversationRequest(BaseModel):
    case_id: int
    message_id: Optional[int] = None
    tree_id: Optional[int] = None
    refresh: bool = False


def get_last_message_id_from_tree(session: Session, tree_id: int) -> int:
    """
    Get the ID of the last selected message in a tree.
    Returns the ID of the deepest selected message in the tree.
    """
    # Get all selected messages in the tree
    statement = select(Message).where(
        (Message.simulation_id == tree_id) & (Message.selected == True)
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


@router.post("/continue-conversation")
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
    message_id = request.message_id
    refresh = request.refresh
    try:
        # Get the case context
        case_context_json = get_case_context(session, case_id)
        if not case_context_json:
            raise HTTPException(status_code=404, detail=f"Case with id {case_id} not found")

        # Format the case background for the LLM
        case_background = format_case_background_for_llm(case_context_json)

        # Tree_id provided - continue existing conversation
        # Check if the last selected message is a leaf node
        if refresh:
            # Delete the original subtree
            delete_messages_including_children(session, message_id)

        # Leaf node - generate new messages and save them
        messages_history = get_messages_by_tree(session, tree_id, message_id) or ""
        last_message = session.get(Message, message_id)
        last_message_content = last_message.content if last_message else ""

        simulation = session.get(Simulation, tree_id)
        simulation_goal = simulation.brief if simulation else "Reach a favorable settlement"


        # Generate a tree of messages based on the case background and simulation goal
        tree_data = create_tree(case_background, messages_history, simulation_goal, last_message_content, refresh)

        # Save the messages to the database
        save_messages_to_tree(
            session,
            case_id,
            tree_data,
            existing_tree_id=tree_id,
            last_message_id=message_id
        )

        # Return the generated tree data
        return {
            **tree_data
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
    simulation_id: int,
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
        simulation_id=simulation_id,
        parent_id=parent_id,
        content=content,
        role=role,
        selected=True,  # Custom messages are automatically selected
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return new_message


class SummarizedMessageRequest(BaseModel):
    simulation_id: int
    parent_id: int | None
    user_input: str
    role: str
    desired_length: int = 15


@router.post("/messages/create-summarized", response_model=Message)
async def create_summarized_message(
    request: SummarizedMessageRequest,
    db: Session = Depends(get_session),
):
    """
    Create a new message with content summarized from user input using AI.
    Summarizes the user_input and creates a Message object with the summarized content.
    """
    try:
        # Summarize the user input
        summary_result = await summarize_dialogue(request.user_input, request.desired_length)
        summarized_content = summary_result.get("message", "") if summary_result.get("message") else request.user_input
        
        # Create the message
        new_message = Message(
            simulation_id=request.simulation_id,
            parent_id=request.parent_id,
            content=summarized_content,
            role=request.role,
        )

        db.add(new_message)
        db.commit()
        db.refresh(new_message)

        return new_message
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating summarized message: {str(e)}")

class CaseCreate(BaseModel):
    name: str
    party_a: Optional[str] = None
    party_b: Optional[str] = None
    context: Optional[str] = None

@router.post("/cases", response_model=CaseWithTreeCount)
async def create_case(
    case_data: CaseCreate,
    db: Session = Depends(get_session)
):
    """
    Create a new case with the provided information.
    Returns the created case with scenario count initialized to 0.
    """
    # Create default context if none provided
    if case_data.context is None:
        case_data.context = json.dumps({
            "parties": {
                "party_A": {"name": case_data.party_a or ""},
                "party_B": {"name": case_data.party_b or ""}
            },
            "key_issues": "",
            "general_notes": ""
        })

    summary = ""
    
    # Create new case
    new_case = Case(
        name=case_data.name,
        summary=summary,
        party_a=case_data.party_a or "",
        party_b=case_data.party_b or "",
        context=case_data.context,
        last_modified=datetime.now()
    )

    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    
    # Return with scenario count of 0
    return CaseWithTreeCount(
        id=new_case.id,
        name=new_case.name,
        party_a=new_case.party_a,
        party_b=new_case.party_b,
        context=new_case.context,
        summary=new_case.summary,
        last_modified=new_case.last_modified,
        scenario_count=0
    )

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
                summary=case.summary,
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


class CaseUpdate(BaseModel):
    party_a: Optional[str] = None
    party_b: Optional[str] = None
    key_issues: Optional[str] = None
    general_notes: Optional[str] = None


@router.patch("/cases/{case_id}")
async def update_case(
    case_id: int,
    case_update: CaseUpdate,
    session: Session = Depends(get_session)
):
    """
    Update a case's background information.
    Updates the context field which is stored as JSON.
    Also regenerates the summary based on the updated context.
    """
    # Fetch case
    case = session.exec(select(Case).where(Case.id == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case with id {case_id} not found.")

    # Parse existing context
    try:
        background_data = json.loads(case.context)
    except Exception:
        background_data = {
            "parties": {"party_A": {"name": ""}, "party_B": {"name": ""}},
            "key_issues": "",
            "general_notes": ""
        }

    # Update fields if provided
    if case_update.party_a is not None:
        if "parties" not in background_data:
            background_data["parties"] = {}
        if "party_A" not in background_data["parties"]:
            background_data["parties"]["party_A"] = {}
        background_data["parties"]["party_A"]["name"] = case_update.party_a
    
    if case_update.party_b is not None:
        if "parties" not in background_data:
            background_data["parties"] = {}
        if "party_B" not in background_data["parties"]:
            background_data["parties"]["party_B"] = {}
        background_data["parties"]["party_B"]["name"] = case_update.party_b
    
    if case_update.key_issues is not None:
        background_data["key_issues"] = case_update.key_issues
    
    if case_update.general_notes is not None:
        background_data["general_notes"] = case_update.general_notes

    # Save updated context
    case.context = json.dumps(background_data)
    case.last_modified = datetime.now()
    
    # Regenerate summary based on updated context
    try:
        case.summary = await summarize_background_helper(case.context, desired_lines=30)
    except Exception as e:
        case.summary = ""
    
    session.add(case)
    session.commit()
    session.refresh(case)

    # Return the updated case data including the regenerated summary
    return CaseWithTreeCount(
        id=case.id,
        name=case.name,
        party_a=case.party_a,
        party_b=case.party_b,
        context=case.context,
        summary=case.summary,
        last_modified=case.last_modified,
        scenario_count=0  # We could compute this if needed
    )


@router.post("/simulations", response_model=SimulationResponse)
def create_simulation_endpoint(
    simulation_data: SimulationCreate,
    db: Session = Depends(get_session)
):
    """
    Create a new simulation with headline, brief, and case_id.
    """
    try:
        simulation = create_simulation(session=db, simulation_create=simulation_data)
        return SimulationResponse(
            id=simulation.id,
            headline=simulation.headline,
            brief=simulation.brief,
            created_at=simulation.created_at,
            case_id=simulation.case_id
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating simulation: {str(e)}")


@router.get("/simulations/{simulation_id}", response_model=SimulationResponse)
def get_simulation_endpoint(
    simulation_id: int,
    db: Session = Depends(get_session)
):
    """
    Get simulation details by ID, including headline (title), brief, created_at, and case_id.
    """
    simulation = db.get(Simulation, simulation_id)
    if not simulation:
        raise HTTPException(status_code=404, detail=f"Simulation with id {simulation_id} not found")
    
    return SimulationResponse(
        id=simulation.id,
        headline=simulation.headline,
        brief=simulation.brief,
        created_at=simulation.created_at,
        case_id=simulation.case_id
    )


@router.post("/bookmarks", response_model=BookmarkResponse)
def create_bookmark_endpoint(
    bookmark_data: BookmarkCreate,
    db: Session = Depends(get_session)
):
    """
    Create a new bookmark for a specific message in a simulation.
    """
    try:
        bookmark = create_bookmark(session=db, bookmark_create=bookmark_data)
        return BookmarkResponse(
            id=bookmark.id,
            simulation_id=bookmark.simulation_id,
            message_id=bookmark.message_id
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating bookmark: {str(e)}")


@router.get("/bookmarks/{simulation_id}", response_model=List[BookmarkResponse])
def get_bookmarks_by_simulation_endpoint(
    simulation_id: int,
    db: Session = Depends(get_session)
):
    """
    Get all bookmarks for a specific simulation.
    """
    bookmarks = get_bookmarks_by_simulation(session=db, simulation_id=simulation_id)
    return [
        BookmarkResponse(
            id=bookmark.id,
            simulation_id=bookmark.simulation_id,
            message_id=bookmark.message_id
        )
        for bookmark in bookmarks
    ]


@router.delete("/bookmarks/{bookmark_id}")
def delete_bookmark_endpoint(
    bookmark_id: int,
    db: Session = Depends(get_session)
):
    """
    Delete a bookmark by ID.
    """
    try:
        delete_bookmark(session=db, bookmark_id=bookmark_id)
        return {"message": f"Bookmark with id {bookmark_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting bookmark: {str(e)}")