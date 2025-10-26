import json
from datetime import datetime

from sqlmodel import Session, SQLModel, create_engine, select, func

from app.api.routes.audio_models import get_session, get_context_history
from app.core.db import engine
from app.crud import get_messages_by_tree, get_case_context
from app.models import Case, Simulation, Message
from app.core.config import settings
from app.schemas import messages_to_conversation
from sqlalchemy import text


from app.models import Case, Simulation, Message
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
        DELETE FROM simulation;
        DELETE FROM "case";
    """))
    session.commit()

def create_sample_data():
    with Session(engine) as session:
        # Check if data already exists
        existing_cases = session.exec(select(func.count(Case.id))).first()
        if existing_cases and existing_cases > 0:
            print("✅ Database already contains data. Skipping sample data creation.")
            return
        
        # === Build context JSON ===
        case_context = {
            "parties": {
                "party_A": {
                    "label": "Party A",
                    "name": "Mr. Alexander Sterling",
                    "role": "Petitioner",
                    "aliases": ["Mr. Sterling"],
                    "maps_to": "case_overview.petitioner"
                },
                "party_B": {
                    "label": "Party B",
                    "name": "Ms. Clara Sterling",
                    "role": "Respondent",
                    "aliases": ["Ms. Sterling"],
                    "maps_to": "case_overview.respondent"
                }
            },
            "key_issues": [
                "Custody and primary residence of two children (Ethan and Sophia)",
                "Spousal support duration and necessity",
                "Ownership and buyout terms of matrimonial home",
                "Responsibility for post-separation credit card debt"
            ],
            "general_notes": "The case involves a long-term marriage with significant financial disparity and competing priorities between stability for the children and business interests. Emotional tone moderate; parties maintain civility but display control and anxiety patterns respectively.",
            "case_overview": {
                "petitioner": "Mr. Alexander Sterling (Age 45, Software Consultant, ~$185k/yr)",
                "respondent": "Ms. Clara Sterling (Age 43, PR Manager, ~$95k/yr)",
                "marriage_duration": "19 years (DOM: June 14, 2005)",
                "separation_date": "September 1, 2024"
            },
            "children": {
                "names": "Ethan (Age 15), Sophia (Age 10)",
                "dispute": "Both parents seek primary residential parent designation. Ms. Sterling cites Mr. Sterling's travel; Mr. Sterling cites Ms. Sterling's rigidity."
            },
            "property": {
                "matrimonial_home_equity": "$950,000",
                "home_dispute": "Ms. Sterling wishes to buy out Mr. Sterling. Mr. Sterling prefers to sell or retain the home for his home business."
            },
            "support": {
                "spousal_support_dispute": "Ms. Sterling seeks 5 years of rehabilitative support to pursue a master's degree. Mr. Sterling disputes the duration and necessity.",
                "child_support": "To be calculated based on set-off for 50/50 shared parenting."
            },
            "debts": {
                "dispute": "Liability for $15,000 post-separation credit card debt incurred by Ms. Sterling."
            },
            "personalities": {
                "petitioner_profile": "Highly analytical, business-like, emotionally reserved, views divorce as a transaction. Can be controlling (finances/schedule).",
                "respondent_profile": "Warm, sociable, prone to anxiety (finances/children). Main concern is stability and securing the home.",
                "additional_info": None
            }
        }

        # === Create the case ===
        case = Case(
            name="Sterling v. Sterling Divorce Proceedings",
            party_a="Mr. Alexander Sterling",
            party_b="Ms. Clara Sterling",
            context=json.dumps(case_context, indent=2),  # store JSON as string
            summary="High-income marital dispute involving custody, home equity, and support disagreements.",
            last_modified=datetime.utcnow()
        )
        session.add(case)
        session.commit()
        session.refresh(case)

        # === Create a simulation (tree) for that case ===
        simulation = Simulation(
            case_id=case.id,
            headline="Initial Contract Discussion",
            brief="Start of negotiation and legal discussion.",
            created_at=datetime.utcnow()
        )
        session.add(simulation)
        session.commit()
        session.refresh(simulation)

        # === ROOT ===
        msg_root = Message(
            content="Let's begin the legal case discussion.",
            role="system",
            selected=True,
            simulation_id=simulation.id,
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
                simulation_id=simulation.id,
                parent_id=msg_root.id
            ),
            Message(
                content="The company failed to deliver services.",
                role="user",
                selected=True,
                simulation_id=simulation.id,
                parent_id=msg_root.id
            ),
            Message(
                content="I want to settle this out of court.",
                role="user",
                selected=False,
                simulation_id=simulation.id,
                parent_id=msg_root.id
            )
        ]
        session.add_all(user_msgs)
        session.commit()

        # === LEVEL 2 (Legal side: assistant options replying to selected user message) ===
        assistant_msgs = [
            Message(
                content="We'll prepare a claim focusing on contract fairness.",
                role="assistant",
                selected=False,
                simulation_id=simulation.id,
                parent_id=user_msgs[1].id
            ),
            Message(
                content="Understood. We'll focus on proving service failure under the contract terms.",
                role="assistant",
                selected=True,
                simulation_id=simulation.id,
                parent_id=user_msgs[1].id
            ),
            Message(
                content="Let's evaluate possible settlements first.",
                role="assistant",
                selected=False,
                simulation_id=simulation.id,
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
                selected=True,
                simulation_id=simulation.id,
                parent_id=assistant_msgs[1].id
            ),
            Message(
                content="Can we gather more evidence before filing?",
                role="user",
                selected=False,
                simulation_id=simulation.id,
                parent_id=assistant_msgs[1].id
            ),
            Message(
                content="I’m not sure if I have enough proof yet.",
                role="user",
                selected=False,
                simulation_id=simulation.id,
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
                selected=True,
                simulation_id=simulation.id,
                parent_id=user_followups[0].id
            ),
            Message(
                content="We should obtain all invoices and written correspondence first.",
                role="assistant",
                selected=False,
                simulation_id=simulation.id,
                parent_id=user_followups[0].id
            ),
            Message(
                content="Let's draft the complaint and adjust once more evidence is gathered.",
                role="assistant",
                selected=False,
                simulation_id=simulation.id,
                parent_id=user_followups[0].id
            ),
        ]
        session.add_all(assistant_followups)
        session.commit()

        print("✅ Database prepopulated with one sample case, simulation, and multi-option messages per side.")



if __name__ == "__main__":
    create_sample_data()
    #
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


