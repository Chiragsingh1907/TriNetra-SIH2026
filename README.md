# 👁️ TriNetra: AI-Powered Criminal Network Analysis System

> **Turning Fragmented Data into Criminal Intelligence.**

**Smart India Hackathon 2026**
* **Team Name:** Aletheia
* **Team ID:** SIH-UPES-2026-T060
* **Problem Statement:** AI-Powered Criminal Network Analysis System (SIH26189)
* **Theme:** Blockchain & Cybersecurity | **Category:** Software

---

## 👥 Team Aletheia

| Role | Name | Stream / Branch |
| :--- | :--- | :--- |
| **Team Leader** | Arnav Bhatnagar | B.Tech CSE (AI & ML) |
| **Team Member** | Rao Yashvir Singh | B.Tech CSE (Cybersecurity) |
| **Team Member** | Chirag Singh | B.Tech CSE (AI & ML) |
| **Team Member** | Shresth Chaudhary | B.Tech CSE (Core) |
| **Team Member** | Prarthana Baisoya | B.Tech CSE (AI & ML) |
| **Team Member** | Anup Kumar Sinha | B.Tech CSE (Core) |  

---

## ⚠️ The Problem Landscape

Investigating agencies currently face significant hurdles when mapping criminal enterprises:
* **Data Silos:** Crucial evidence such as e-FIRs, CDRs, and bank records remain highly fragmented across different files, databases, and jurisdictions.
* **Unstructured Data:** Automated extraction is severely hindered because police records frequently contain a mix of Hindi, regional languages, and Hinglish.
* **Hidden Network Leaders:** Traditional investigations easily identify directly involved criminals but routinely miss the insulated brokers who connect multiple criminal cells.

---

## 💡 The TriNetra Solution

TriNetra shifts the investigative focus from simply asking *"Who committed the crime?"* to uncovering *"Who connects the network?"* The system is designed to surface actionable investigative leads for human review, utilizing AI and Graph Theory in a secure, air-gapped environment.

<img width="1600" height="811" alt="The Login Screen" src="https://github.com/user-attachments/assets/636c53b3-3782-42d0-921a-d3961040002c" />



### 📝 NLP Extraction & Human-in-the-Loop Validation

Before data is committed to the graph, TriNetra processes raw FIR documents and extracts critical entities (Suspects, Plaintiffs, Phone Anchors, Financial Accounts). The built-in Validation Panel ensures human oversight, allowing investigating officers to verify AI-extracted intelligence, mitigating false positives and ensuring data integrity.

<img width="1600" height="807" alt="Validation Panel" src="https://github.com/user-attachments/assets/3f047ad5-efa2-4688-bd6c-165ddbf40998" />


### 🕸️ Core Capabilities & Network Visualization

Based on our functional prototype, TriNetra delivers the following advanced investigative capabilities:

<img width="1600" height="806" alt="The Full Network Graph" src="https://github.com/user-attachments/assets/38cf657e-92f1-4d80-bbca-3203e17464d3" />



* **Holistic Entity Linkage:** The graph dynamically maps disparate entity types into a unified view, categorizing nodes by type (e.g., FIR Documents in grey, Persons in blue, Phone Anchors in green, and Financial Accounts in purple).
* **Semantic Relationships:** Directed edges are automatically labeled with specific relationships such as `FILED_COMPLAINT`, `ACCUSED_IN`, and `LINKED_TO`, contextualizing the network.
* **Cross-Jurisdictional Consolidation:** The graph successfully merges isolated case files, visualizing distinct FIRs reported by separate plaintiffs across different locations on a single canvas.
* **Algorithmic Syndicate Detection (USP):** Utilizing NetworkX, the algorithm calculates betweenness centrality to identify structural "choke points."
* **Automated Threat Alerting:** The system visually flags high-centrality nodes (Nexus > 0.4) with a glowing red aura and triggers a prominent system alert (e.g., *"ALERT: Syndicate detected! Nexus [Vikram Singhania] (Centrality: 0.73) bridges 3 distinct cases"*).

---

## ⚙️ Technical Architecture

TriNetra is engineered strictly for highly sensitive environments, supporting fully air-gapped, on-premise deployment directly on Police Intranets with zero external cloud API dependencies.

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React.js, Tailwind CSS | Interactive network visualization and UI/UX |
| **Backend** | FastAPI / Python | High-performance API and ML integration |
| **NLP** | IndicBERT | Multilingual and Hinglish entity extraction |
| **Graph DB** | Neo4j | Criminal relationship graph mapping |
| **Analytics** | NetworkX | Betweenness centrality and cycle detection |
| **ML** | Scikit-learn | Link discovery and clustering |
| **Deployment**| Docker | Secure, on-premise / air-gapped deployment |

---

## 📂 Project Structure

```text
TriNetra-SIH2026/
├── frontend/               # React.js UI, Tailwind styling, and graph visualization components
├── backend/                # FastAPI application, routing, and REST endpoints
├── nlp_engine/             # IndicBERT models and multilingual text extraction scripts
├── graph_db/               # Neo4j setup configurations and Cypher query controllers
├── analytics_ml/           # NetworkX centrality algorithms and ML link discovery
├── docs/                   # System architecture diagrams and SIH presentation materials
├── docker-compose.yml      # Container orchestration for air-gapped deployment
├── test_fir.txt            # Synthetic FIR data for testing and validation
├── .gitignore              # Standard exclusions (node_modules, venv, __pycache__)
└── README.md               # Project documentation

---

