from sqlmodel import Session, SQLModel, create_engine

from app.api.routes.audio_models import get_session, get_context_history
from app.core.db import engine
from app.crud import get_messages_by_tree, get_case_context
from app.models import Case, Tree, Message
from app.core.config import settings
from app.schemas import messages_to_conversation


# Create the DB engine (same as your app)

def create_sample_data():


    with Session(engine) as session:
        # Create a case
        case = Case(
            name="Sample Case: Contract Dispute",
            legal_side="Plaintiff",
            client="John Doe",
            context="John Doe is suing ABC Corp for breach of contract."
        )
        session.add(case)
        session.commit()
        session.refresh(case)

        # Create a tree for that case
        tree = Tree(case_id=case.id)
        session.add(tree)
        session.commit()
        session.refresh(tree)

        # === Create messages forming a tree ===
        # Depth 1: root (system)
        msg_root = Message(
            content="Let's begin the legal case discussion.",
            role="system",
            selected=True,
            tree_id=tree.id,
            parent_id=None
        )
        session.add(msg_root)
        session.commit()
        session.refresh(msg_root)

        # Depth 2: user options
        msg_user_1 = Message(
            content="I believe the contract was unfair.",
            role="user",
            selected=False,
            tree_id=tree.id,
            parent_id=msg_root.id
        )
        msg_user_2 = Message(
            content="The company failed to deliver services.",
            role="user",
            selected=True,
            tree_id=tree.id,
            parent_id=msg_root.id
        )
        msg_user_3 = Message(
            content="I want to settle this out of court.",
            role="user",
            selected=False,
            tree_id=tree.id,
            parent_id=msg_root.id
        )
        session.add_all([msg_user_1, msg_user_2, msg_user_3])
        session.commit()

        # Depth 3: system replies to selected user message
        msg_reply = Message(
            content="Understood. We'll focus on proving service failure under the contract terms.",
            role="assistant",
            selected=True,
            tree_id=tree.id,
            parent_id=msg_user_2.id
        )
        session.add(msg_reply)
        session.commit()

        print("✅ Database prepopulated with one sample case, tree, and messages.")


if __name__ == "__main__":
    create_sample_data()

    # with Session(engine) as session:
    #     messages_history = get_messages_by_tree(session, 1)
    #     print(messages_history)

    with Session(engine) as session:
        messages = get_case_context(session, case_id=1)
    #     conversation_json = messages_to_conversation(messages).model_dump_json(
    #         indent=2)
        print(messages)


