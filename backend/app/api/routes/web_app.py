from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.api.routes.audio_models import get_session
from app.crud import get_messages_by_tree, get_selected_messages_between, \
    get_tree
from app.models import Message
from typing import List, Optional

router = APIRouter()


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

