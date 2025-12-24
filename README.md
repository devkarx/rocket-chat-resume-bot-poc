# AI Resume Analyzer for Rocket.Chat (Archived POC)

A Retrieval-Augmented Generation (RAG) prototype designed to analyze resumes against job descriptions within Rocket.Chat. This project implements a microservices architecture to handle file processing, vector embeddings, and chat interactions.

## ⚠️ Project Status: Archived
**Reason:** This project served as a Proof of Concept (POC) to test external AI integrations. It is now archived to focus on a **Native Air-Gapped Search App** for the Rocket.Chat GSoC program, ensuring strict data privacy without external dependencies.

## 📂 Architecture Overview
This repository is organized into four distinct services:

* **`/rc-app`**: The Rocket.Chat Frontend Application (TypeScript/Apps Engine). Handles the UI commands and Slash Commands.
* **`/backend-api`**: The Orchestration Layer (Node.js/Express). Manages the communication between the App and the Vector Database.
* **`/pdf-service`**: A dedicated microservice for parsing PDF resumes and extracting raw text.
* **`/infrastructure`**: Docker Compose configurations for spinning up the local Rocket.Chat server and database.

## 🛠 Tech Stack
* **Frontend:** Rocket.Chat Apps Engine (TypeScript)
* **Backend:** Node.js, Express
* **AI/ML:** Pinecone (Vector DB), LangChain (Logic), OpenAI/Ollama (LLM)
* **DevOps:** Docker, Docker Compose

## 🚀 How it Worked
1. User uploads a PDF resume in Rocket.Chat.
2. **rc-app** sends the file to the **pdf-service**.
3. **pdf-service** extracts text and sends it to **backend-api**.
4. **backend-api** converts text to embeddings (Vectors) and stores them in Pinecone.
5. User asks: "Is this candidate a good fit?" -> The system performs a semantic search and generates a match score.