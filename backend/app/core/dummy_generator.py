from sqlmodel import Session, SQLModel, create_engine

from app.api.routes.audio_models import get_session, get_context_history
from app.core.db import engine
from app.crud import get_messages_by_tree, get_case_context
from app.models import Case, Tree, Message
from app.core.config import settings
from app.schemas import messages_to_conversation
from sqlalchemy import text


from app.models import Case, Tree, Message
from sqlmodel import Session
from app.core.db import engine


def clear_all_data(session: Session):
    """
    Deletes all data from all tables in the correct dependency order.
    Quotes reserved table names like 'case'.
    """
    session.exec(text("""
        DELETE FROM message;
        DELETE FROM document;
        DELETE FROM tree;
        DELETE FROM "case";
    """))
    session.commit()

def create_sample_data():
    with Session(engine) as session:
        # === Create a sample case ===
        case = Case(
            name="Sample Case: Contract Dispute",
            legal_side="Plaintiff",
            client="John Doe",
            context="John Doe is suing ABC Corp for breach of contract."
        )
        session.add(case)
        session.commit()
        session.refresh(case)

        # === Create a tree for that case ===
        tree = Tree(case_id=case.id)
        session.add(tree)
        session.commit()
        session.refresh(tree)

        # === ROOT ===
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

        # === LEVEL 1 (Client side: user options) ===
        user_msgs = [
            Message(
                content="I believe the contract was unfair.",
                role="user",
                selected=False,
                tree_id=tree.id,
                parent_id=msg_root.id
            ),
            Message(
                content="The company failed to deliver services.",
                role="user",
                selected=True,  # <-- selected one
                tree_id=tree.id,
                parent_id=msg_root.id
            ),
            Message(
                content="I want to settle this out of court.",
                role="user",
                selected=False,
                tree_id=tree.id,
                parent_id=msg_root.id
            )
        ]
        session.add_all(user_msgs)
        session.commit()

        # === LEVEL 2 (Legal side: assistant options replying to the selected user message) ===
        assistant_msgs = [
            Message(
                content="We'll prepare a claim focusing on contract fairness.",
                role="assistant",
                selected=False,
                tree_id=tree.id,
                parent_id=user_msgs[1].id  # reply to selected user message
            ),
            Message(
                content="Understood. We'll focus on proving service failure under the contract terms.",
                role="assistant",
                selected=True,  # <-- selected one
                tree_id=tree.id,
                parent_id=user_msgs[1].id
            ),
            Message(
                content="Let's evaluate possible settlements first.",
                role="assistant",
                selected=False,
                tree_id=tree.id,
                parent_id=user_msgs[1].id
            ),
        ]
        session.add_all(assistant_msgs)
        session.commit()

        # === LEVEL 3 (Client side: user responses to selected assistant message) ===
        user_followups = [
            Message(
                content="That makes sense, please proceed.",
                role="user",
                selected=True,  # <-- selected one
                tree_id=tree.id,
                parent_id=assistant_msgs[1].id
            ),
            Message(
                content="Can we gather more evidence before filing?",
                role="user",
                selected=False,
                tree_id=tree.id,
                parent_id=assistant_msgs[1].id
            ),
            Message(
                content="I’m not sure if I have enough proof yet.",
                role="user",
                selected=False,
                tree_id=tree.id,
                parent_id=assistant_msgs[1].id
            ),
        ]
        session.add_all(user_followups)
        session.commit()

        # === LEVEL 4 (Legal side: final assistant responses) ===
        assistant_followups = [
            Message(
                content="We'll start by reviewing all communication records with the company.",
                role="assistant",
                selected=True,  # <-- selected one
                tree_id=tree.id,
                parent_id=user_followups[0].id
            ),
            Message(
                content="We should obtain all invoices and written correspondence first.",
                role="assistant",
                selected=False,
                tree_id=tree.id,
                parent_id=user_followups[0].id
            ),
            Message(
                content="Let's draft the complaint and adjust once more evidence is gathered.",
                role="assistant",
                selected=False,
                tree_id=tree.id,
                parent_id=user_followups[0].id
            ),
        ]
        session.add_all(assistant_followups)
        session.commit()

        print("✅ Database prepopulated with one sample case, tree, and multi-option messages per side.")




if __name__ == "__main__":
    create_sample_data()

    # with Session(engine) as session:
    #     clear_all_data(session)



    #     messages_history = get_messages_by_tree(session, 1)
    #     print(messages_history)
    # #
    # with Session(engine) as session:
    # #     # messages = get_case_context(session, case_id=1)
    #     messages = get_messages_by_tree(session, 6)
    # #
    # # #     conversation_json = messages_to_conversation(messages).model_dump_json(
    # # #         indent=2)
    #     print(messages)


