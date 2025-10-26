import uuid
from fastapi import FastAPI, HTTPException, Depends
from typing import Any

from sqlmodel import Session, select

from app.core.security import get_password_hash, verify_password
from app.models import Item, ItemCreate, User, UserCreate, UserUpdate, Case, \
    Message, Simulation, Bookmark
from app.schemas import SimulationCreate, BookmarkCreate
from app.schemas import messages_to_conversation
from sqlmodel import Session, select, delete
from typing import List, Optional


def get_case_context(session: Session, case_id: int) -> str | None:
    """Return the context field for a given case_id."""
    statement = select(Case.context).where(Case.id == case_id)
    result = session.exec(statement).first()
    return result


def format_case_background_for_llm(context_json: str) -> str:
    """Parse and format case context JSON into a readable string for LLM."""
    import json
    try:
        background_data = json.loads(context_json)
    except Exception:
        background_data = {}
    
    # Extract parties
    party_a = background_data.get("parties", {}).get("party_A", {}).get("name", "Unknown Party")
    party_b = background_data.get("parties", {}).get("party_B", {}).get("name", "Unknown Party")
    key_issues = background_data.get("key_issues", "") or "Not specified"
    general_notes = background_data.get("general_notes", "") or "Not specified"
    
    # Format into readable string - always provide all fields
    formatted = f"Case Background:\n\n"
    formatted += f"Parties:\n"
    formatted += f"  Party A: {party_a}\n"
    formatted += f"  Party B: {party_b}\n\n"
    
    formatted += f"Key Issues:\n{key_issues}\n\n"
    formatted += f"General Notes:\n{general_notes}\n"
    
    return formatted



def get_messages_by_tree(session: Session, tree_id: int) -> list[Message]:
    """Retrieve messages for a tree_id in hierarchical order (DFS)."""
    statement = select(Message).where(
        (Message.simulation_id == tree_id)
    )
    messages = session.exec(statement).all()

    # Build mapping: parent_id → list of children
    children_map = {}
    for msg in messages:
        children_map.setdefault(msg.parent_id, []).append(msg)

    # Sort children under each parent by id for consistent order
    for child_list in children_map.values():
        child_list.sort(key=lambda m: m.id)

    ordered = []

    def dfs(parent_id: int | None = None):
        for msg in children_map.get(parent_id, []):
            ordered.append(msg)
            dfs(msg.id)

    dfs(None)


    conversation_json = messages_to_conversation(ordered).model_dump_json(
        indent=2)

    return conversation_json

def get_tree(session: Session, tree_id: int) -> list[Message]:
    """
    Retrieve all messages for a specific tree_id in hierarchical chronological order.
    Includes both selected and unselected messages.

    The tree alternates between legal and client sides:
    - One root message (parent_id=None)
    - Then branches with multiple options (usually 3 per side)
    """
    # Fetch all messages for the tree (no selected filter)
    statement = select(Message).where(Message.simulation_id == tree_id)
    messages = session.exec(statement).all()

    if not messages:
        return []

    # Build mapping: parent_id → list of children
    children_map: dict[int | None, list[Message]] = {}
    for msg in messages:
        children_map.setdefault(msg.parent_id, []).append(msg)

    # Sort children by creation order (id ascending)
    for child_list in children_map.values():
        child_list.sort(key=lambda m: m.id)

    ordered: list[Message] = []

    def dfs(parent_id: int | None = None):
        """
        Depth-first traversal from root down, preserving order.
        Each branch is fully explored before moving to the next.
        """
        for msg in children_map.get(parent_id, []):
            ordered.append(msg)
            dfs(msg.id)

    # Start traversal from root(s)
    dfs(None)

    # Optional: sort by id to ensure chronological order (in case of multiple roots)
    ordered.sort(key=lambda m: m.id)

    return ordered


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return db_user


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item

def get_selected_messages_between(
    session: Session, start_id: int, end_id: int
) -> list[Message]:
    """
    Retrieve all selected messages between start_id and end_id (inclusive),
    ordered chronologically by message ID.
    """

    statement = (
        select(Message)
        .where(Message.selected == True)
        .where(Message.id >= start_id)
        .where(Message.id <= end_id)
        .order_by(Message.id)
    )

    messages = session.exec(statement).all()
    return messages


def delete_messages_including_children(session: Session, message_id: int) -> bool:
    """
    Delete all children of a message (not the message itself).
    Returns True if successful, False otherwise.
    """

    # Get all direct children
    children_stmt = select(Message).where(Message.parent_id == message_id)
    children = session.exec(children_stmt).all()

    # Recursively delete all descendants of each child
    for child in children:
        delete_messages_including_children(session, child.id)
        session.delete(child)  # Delete the child itself after its descendants
    
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        return False

    return True


def delete_messages_after_children(session: Session, message_id: int) -> int:
    """
    Delete all messages in the same tree that come after the last child
    of the given message. Keeps the message itself and its direct children.
    Returns the number of deleted rows.
    """

    # Get the target message
    target = session.get(Message, message_id)
    if not target:
        raise ValueError(f"Message with id={message_id} not found")

    # Get all direct children
    children_stmt = select(Message).where(Message.parent_id == message_id)
    children = session.exec(children_stmt).all()

    # Determine the cutoff ID (highest child ID)
    if children:
        last_child_id = max(child.id for child in children)
    else:
        last_child_id = message_id

    # Delete all messages in this tree with id > last_child_id
    delete_stmt = delete(Message).where(
        (Message.simulation_id == target.simulation_id) & (Message.id > last_child_id)
    )

    result = session.exec(delete_stmt)
    session.commit()

    return result.rowcount or 0



def get_message_children(db: Session, message_id: int) -> List[Message]:
    """Return all direct children of a message."""
    query = select(Message).where(Message.parent_id == message_id)
    results = db.exec(query).all()
    return results


def update_message_selected(db: Session, message_id: int) -> Message:
    """
    Mark a message as selected=True only if:
    - It is a leaf node (has no children)
    - Its parent (if any) is selected
    - None of its siblings (same parent_id) are already selected
    """
    message = db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # # 1️⃣ Check if message has children (must be a leaf)
    # has_children = db.exec(select(Message).where(Message.parent_id == message_id)).first() is not None
    # if has_children:
    #     raise HTTPException(
    #         status_code=400,
    #         detail="Cannot select this message because it has child messages"
    #     )

    # 2️⃣ Check if parent exists and is selected (must be on active branch)
    if message.parent_id is not None:
        parent = db.get(Message, message.parent_id)
        if not parent or not parent.selected:
            raise HTTPException(
                status_code=400,
                detail="Cannot select this message because its parent is not selected"
            )

    # 3️⃣ Check if siblings already selected (same parent_id)
    sibling_query = select(Message).where(
        (Message.parent_id == message.parent_id)
        if message.parent_id is not None
        else Message.parent_id.is_(None),
        Message.id != message_id,
        Message.simulation_id == message.simulation_id,
        Message.selected == True
    )
    selected_sibling = db.exec(sibling_query).first()
    if selected_sibling:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot select this message because sibling (id={selected_sibling.id}) is already selected"
        )

    # ✅ Passed all checks
    message.selected = True
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def create_simulation(*, session: Session, simulation_create: SimulationCreate) -> Simulation:
    """Create a new simulation."""
    # Check if case exists
    case = session.get(Case, simulation_create.case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case with id {simulation_create.case_id} not found")
    
    simulation = Simulation(
        headline=simulation_create.headline,
        brief=simulation_create.brief,
        case_id=simulation_create.case_id
    )
    session.add(simulation)
    session.commit()
    session.refresh(simulation)
    return simulation


def create_bookmark(*, session: Session, bookmark_create: BookmarkCreate) -> Bookmark:
    """Create a new bookmark."""
    # Check if simulation exists
    simulation = session.get(Simulation, bookmark_create.simulation_id)
    if not simulation:
        raise HTTPException(status_code=404, detail=f"Simulation with id {bookmark_create.simulation_id} not found")
    
    # Check if message exists
    message = session.get(Message, bookmark_create.message_id)
    if not message:
        raise HTTPException(status_code=404, detail=f"Message with id {bookmark_create.message_id} not found")
    
    # Check if bookmark already exists
    existing_bookmark = session.exec(
        select(Bookmark).where(
            Bookmark.simulation_id == bookmark_create.simulation_id,
            Bookmark.message_id == bookmark_create.message_id
        )
    ).first()
    
    if existing_bookmark:
        raise HTTPException(status_code=400, detail="Bookmark already exists for this message in this simulation")
    
    bookmark = Bookmark(
        simulation_id=bookmark_create.simulation_id,
        message_id=bookmark_create.message_id
    )
    session.add(bookmark)
    session.commit()
    session.refresh(bookmark)
    return bookmark


def get_bookmarks_by_simulation(*, session: Session, simulation_id: int) -> list[Bookmark]:
    """Get all bookmarks for a specific simulation."""
    return session.exec(select(Bookmark).where(Bookmark.simulation_id == simulation_id)).all()


def delete_bookmark(*, session: Session, bookmark_id: int) -> bool:
    """Delete a bookmark by ID."""
    bookmark = session.get(Bookmark, bookmark_id)
    if not bookmark:
        raise HTTPException(status_code=404, detail=f"Bookmark with id {bookmark_id} not found")
    
    session.delete(bookmark)
    session.commit()
    return True

