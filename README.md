# NexPhone Studio — Local RAG Mobile Shop Chatbot

NexPhone Studio is a zero-dependency mobile-store application with a fully local Retrieval-Augmented Generation (RAG) chatbot. It never calls an external LLM: answers and citations are generated from the indexed store catalog, policies, and buying guides.

## How it works

1. A customer submits a question to `POST /api/chat`.
2. `lib/rag.js` indexes and ranks the relevant product, policy, and guide chunks using BM25, TF-IDF similarity, and entity matching.
3. The API turns the top matches into a grounded answer and returns their citations.

Update the data sources to refresh the RAG knowledge:

- `data/products.json` — phones and specifications
- `data/store_policies.json` — warranty, EMI, and store policies
- `data/knowledge_base.md` — buying guides

## Run locally

Requires Node.js 18 or newer.

```bash
npm start
```

Open `http://localhost:3000`.

## Verify retrieval

```bash
npm run test:rag
```

To test the API, start the server in one terminal and run:

```bash
node test/test-api.js
```

## Configuration

No API key is required. `.env.example` only contains optional `STORE_NAME` and `PORT` settings.

## API

`POST /api/chat`

```json
{ "message": "Which phone is best under ₹25,000?" }
```

Responses include `answer`, ranked `sources`, and `mode: "local-rag"`.
