import uuid
from typing import Any

from sqlmodel import Session, select

from app.core.security import get_password_hash, verify_password
from app.models import Item, ItemCreate, User, UserCreate, UserUpdate, Case, \
    Message
from app.schemas import messages_to_conversation


def get_case_context(session: Session, case_id: int) -> str | None:
    """Return the context field for a given case_id."""
    statement = select(Case.context).where(Case.id == case_id)
    result = session.exec(statement).first()
    return result



def get_messages_by_tree(session: Session, tree_id: int) -> list[Message]:
    """Retrieve messages for a tree_id in hierarchical order (DFS), only selected ones."""
    statement = select(Message).where(
        (Message.tree_id == tree_id) & (Message.selected == True)
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
