# ⚖️ LegalEase - AI-Powered Divorce Negotiation Simulator

### 🏆Boson AI Higgs Audio Hackathon - 3rd Place (2025)

**LegalEase** helps family lawyers practice and refine their negotiation strategies through realistic, emotionally intelligent simulations. Using **Boson AI**’s speech and audio models together with **Qwen 3**’s reasoning capabilities, it generates branching negotiation dialogues that capture both the **strategic** and **emotional** dynamics of real divorce cases.

🎥 Watch our demo here: https://www.loom.com/share/2624ffe2c21a4e2d9a8df1a28ab89892

---

## 💡 Overview

> “LegalEase is an AI-powered negotiation simulator that helps family lawyers navigate the complex legal and emotional dynamics of divorce. It generates realistic, branching dialogue scenarios so lawyers can prep themselves, their colleagues, and their clients by anticipating moves, testing strategies, and saving winning paths.”

Traditional legal prep focuses on logic; **LegalEase** goes beyond by simulating **emotion, tone, and persuasion** - the “human layer” of negotiation that often determines outcomes.

---

## 🎯 Features

- 🗂️ **Case creation & management** – Create and store client cases  
- 💬 **Negotiation simulation** – Qwen 3 generates multi-turn, branching dialogues  
- 🎭 **Multi-speaker narration** – Boson AI’s Higgs V2 expressive audio brings each role to life  
- 🧩 **Checkpointing** – Bookmark key decision points during negotiations  
- 🧠 **Graph visualization** – Explore branching dialogue paths in an interactive view  
- 🎧 **Audio narration** – Generate narrated transcripts for lawyer–client prep  

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | React + TypeScript + Vite |
| **Backend** | FastAPI (Python) |
| **AI / LLMs** | Qwen 3 (negotiation reasoning + dialogue branching) |
| **Audio / Voice** | Boson AI (multivocal narration + transcription) |
| **Visualization** | React Flow (conversation graphs) |
| **Deployment** | Docker + Render |

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository
```bash
git clone https://github.com/Dev301203/legal-ease.git
cd legal-ease
```
### 2️⃣ Docker Command
```bash
docker-compose up --build
```
3️⃣ Access the app
```bash
Frontend → http://localhost:5173
Backend → http://localhost:8000
```

---

## 🧩 Example Use Case

### Scenario: Negotiating division of the matrimonial home

- Qwen 3 generates dialogue between lawyer, client, and opposing counsel
- Boson AI gives each role unique tone and emotional nuance
- Lawyers can replay, branch, and refine strategies
- Checkpoints allow reviewing specific negotiation turns for feedback

---

## 💬 Motivation
Divorce negotiations are emotionally charged and strategically complex. LegalEase offers lawyers a “sandbox” to practice emotional intelligence, persuasion, and empathy - skills just as vital as legal reasoning and clients can gain insight and emotional preparedness through guided simulations.

“Most legal tech augments analytic intelligence. We augment emotional intelligence.”


---

## 📜 License
MIT License © 2025 LegalEase Team

---

## 🏁 Acknowledgments
- Boson AI - for voice synthesis, transcription, and multivocal scenario generation
- Qwen 3 - for dialogue reasoning and branching narrative generation
- Boson AI Hackathon 2025 - for inspiring this project and community

---

## 🌐 Future Directions

LegalEase can be extended beyond divorce law - into mediation training, corporate negotiation, or client-interview preparation. Future versions may include:
- Integration with legal databases for context-aware arguments
- Real-time emotion recognition from audio input
- AI-guided coaching feedback on negotiation performance
