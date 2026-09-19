# RepoPilot 🧠

RepoPilot is an AI-powered repository intelligence app built for engineers who need to understand large codebases quickly. It connects to GitHub, indexes repository content, stores semantic embeddings, and lets you ask natural-language questions about the code with grounded answers based on actual files and chunks.

Instead of manually searching through folders, you connect a repo and ask things like:

- "Where is the authentication flow defined?"
- "Which service handles GitHub webhooks?"
- "Explain the indexing pipeline from repo fetch to vector search."

RepoPilot is designed to help teams move faster in unfamiliar codebases, evaluate open-source projects, and keep context close to the source.

## ✨ What it does

- Connects to GitHub using OAuth
- Pulls repository metadata and file content
- Splits code into searchable chunks
- Generates embeddings with AI models
- Stores vectors in PostgreSQL with pgvector
- Answers repository questions with source-aware responses
- Surfaces chat history and repository context inside the app

## 🏗️ Architecture

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL with pgvector
- Queue / background processing: BullMQ + Redis
- Auth: GitHub OAuth via Passport
- AI: OpenAI or Gemini-compatible models for embeddings and chat

```mermaid
flowchart LR
    A[GitHub Repo] --> B[Backend Service]
    B --> C[Repo Indexing]
    C --> D[Chunk + Embed]
    D --> E[PostgreSQL pgvector]
    E --> F[Semantic Retrieval]
    F --> G[AI Answer]
    G --> H[Frontend UI]
    I[GitHub OAuth] --> B
```

## 🧩 Product overview

RepoPilot combines repository discovery, semantic indexing, and AI-assisted code understanding in one workflow:

1. Authenticate with GitHub
2. Select a repository or connect a public repo URL
3. Backend indexes files and chunks the code
4. Embeddings are stored for search and retrieval
5. Ask questions in plain English and receive answers grounded in repository content

This is especially useful for:

- onboarding into a new project
- understanding large monorepos
- investigating architecture decisions
- finding ownership and usage patterns inside code
- working faster across unfamiliar repositories

## 🛠️ Tech stack

### Frontend
- React
- Vite
- TypeScript
- CSS / custom component styling

### Backend
- Express
- TypeScript
- PostgreSQL
- pgvector
- Redis
- Passport GitHub OAuth
- BullMQ

### AI / Retrieval
- OpenAI-compatible models
- Gemini-compatible models
- Vector similarity search
- Source-grounded answer generation

## 📁 Project structure

```text
RepoPilot/
├── Backend/
│   ├── src/
│   ├── docker/
│   ├── package.json
│   ├── docker-compose.yml
│   └── tsconfig.json
├── Frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── .gitignore
├── package.json
├── scripts/
└── README.md
```

## 🚀 Getting started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- GitHub OAuth app credentials
- Optional: OpenAI or Gemini API key

### 1. Install dependencies

```bash
npm install
npm --prefix Backend install
npm --prefix Frontend install
```

### 2. Configure environment variables

Create a `.env` file in the Backend directory with values similar to:

```env
PORT=3000
CLIENT_URL=http://localhost:5173
SESSION_SECRET=your_session_secret
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/devpilot
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5433
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=devpilot
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
OPENAI_KEY=your_openai_key
OPENAI_CHAT_MODEL=openrouter/auto
OPENAI_EMBED_MODEL=openai/text-embedding-3-small
```

If you are using Gemini instead of OpenAI, set the Gemini variables used by the backend instead.

### 3. Start services

```bash
cd Backend
npm run dev
```

In a second terminal:

```bash
cd Frontend
npm run dev
```

The frontend typically runs on:

- http://localhost:5173

The backend typically runs on:

- http://localhost:3000

## 🧪 Common workflow

- Sign in with GitHub
- Connect one or more repositories
- Let the backend index files and embeddings
- Ask repository questions through the app UI
- Review chat answers with source-grounded references

## 📌 Notes

This project is currently structured as a working MVP / prototype focused on GitHub-connected repository understanding. The backend is designed to support:

- user auth
- repo indexing jobs
- vector storage
- retrieval-augmented Q&A
- real repository context in the product UI

## 🙌 Why RepoPilot

RepoPilot is built for the real problem developers face every day: understanding unfamiliar code without spending hours digging through files, history, and configuration. It brings repository context, GitHub access, and AI reasoning together in one place.

---

Built for faster code understanding. Safer onboarding. Better question-driven exploration.
