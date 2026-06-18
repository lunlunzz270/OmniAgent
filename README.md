# OmniAgent

A full-stack AI knowledge copilot built with React, Node.js, and LangChain. It lets you upload PDF documents and ask questions via text or voice.

To avoid hallucinations, it uses a **dynamic query router**: questions about your documents are answered from the private vector store, while questions outside the documents are routed to a live web search tool via the **Model Context Protocol (MCP)** and SerpAPI.

---

## Features

- **Multi-Document RAG**: Upload multiple PDFs to build a local knowledge base. Documents are chunked (500 chars) and tagged with metadata.
- **Dynamic Query Routing (RAG vs. MCP Web Search vs. Hybrid)**:
  - **High confidence ($\ge 0.80$)**: Answers directly from local documents with source citations.
  - **Medium confidence ($0.65 - 0.80$)**: Combines local document context with live web search results (Hybrid mode).
  - **Low confidence ($< 0.65$)**: Automatically falls back to live web search via SerpAPI to prevent hallucinations.
- **Cascading Deletion**: Removing a document from the UI deletes the physical file on disk and purges its corresponding embeddings from the vector store.
- **Local Vector Cache**: Caches embeddings on disk using file MD5 hashes. When restarting the server, existing documents are restored in under 100ms without re-calling the OpenAI Embedding API.
- **Voice Q&A**: Hands-free conversation mode using `react-speech-recognition` and `speak-tts`, with a live "Stop Speaking" button to interrupt audio playback.
- **Clean Management Console**: Drawer-based document table with pagination, search filter, and chunk statistics.

---

## How It Works

```text
[ User Question ] (Text or Voice)
       │
       ▼
[ Similarity Search in Vector Store ]
       │
       ├── Score ≥ 0.80 ──> Private Document RAG (GPT-5) ───────────────> Answer + Document Source
       │
       ├── 0.65 ≤ Score < 0.80 ──> Hybrid Mode (Document + SerpAPI Web) ─> Synthesized Answer
       │
       └── Score < 0.65 ──> MCP Client ──> SerpAPI Live Google Search ───> Answer + Web Citation
```

---

## Tech Stack

- **Frontend**: React 18, Ant Design 5, Axios, `react-speech-recognition`, `speak-tts`
- **Backend**: Node.js, Express, Multer
- **AI / LLM**: LangChain, OpenAI API (GPT-5, `text-embedding-ada-002`)
- **Search & Protocol**: Model Context Protocol (MCP SDK), SerpAPI
- **Vector Store**: MemoryVectorStore with local disk hash persistence

---

## Quick Start

### 1. Prerequisites

- Node.js (v18+)
- OpenAI API Key
- SerpAPI Key

### 2. Setup Environment Variables

Create `server/.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
SERPAPI_KEY=your_serpapi_key_here
PORT=5001
```

### 3. Install Dependencies

```bash
# Root dependencies (concurrently + frontend)
npm install

# Backend dependencies
cd server && npm install && cd ..
```

### 4. Run the App

```bash
npm run dev
```

- Web UI: `http://localhost:3000`
- API Server: `http://localhost:5001`

---

## API Endpoints

- `GET /documents` - List all active documents and their chunk counts.
- `POST /upload` - Upload and index a new PDF.
- `DELETE /documents/:fileName` - Delete a document and purge its vector embeddings.
- `GET /chat?question=...` - Ask a question (dynamically routed to RAG, Hybrid, or MCP).

---

## Project Structure

```text
agentai/
├── server/
│   ├── .cache/              # Local vector cache (git-ignored)
│   ├── uploads/             # Uploaded PDF files
│   ├── chat-mcp.js          # MCP client & SerpAPI search pipeline
│   ├── chat.js              # Query router (RAG / Hybrid / Web)
│   ├── knowledge-base.js    # Ingestion, chunking, caching & purge logic
│   ├── mcp-server.js        # Stdio MCP server
│   └── server.js            # Express REST API
├── src/
│   ├── components/
│   │   ├── ChatComponent.js # Text & voice input, stop playback button
│   │   ├── PdfUploader.js   # Dragger & document table
│   │   └── RenderQA.js      # Conversation cards with route badges
│   ├── App.js               # Main layout & drawer
│   └── index.js
├── .gitignore
├── package.json
└── README.md
```

---

## License

MIT
