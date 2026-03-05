# RAG (Website Q&A) Setup Guide

This RAG system lets users ask questions about the UofT Triathlon Club. If the answer is on the website (excluding admin pages), the AI answers. Otherwise, it replies: **"I can't answer that, email us instead!"**

## Prerequisites

1. **Pinecone account** – [app.pinecone.io](https://app.pinecone.io/)
2. **OpenAI API key** – For the LLM (or use Groq via `OPENAI_BASE_URL`)
3. **Pinecone CLI** – For creating the index (optional; can use console)

## Setup Steps

### 1. Install Dependencies

```bash
cd backend && npm install
```

### 2. Configure Environment

Add to `backend/.env`:

```env
# Pinecone (no space after =)
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=uofttri-website-rag

# OpenAI (or Groq - set OPENAI_BASE_URL to Groq endpoint)
OPENAI_API_KEY=your_openai_api_key

# Optional: Use Groq instead (free tier)
# OPENAI_API_KEY=your_groq_api_key
# OPENAI_BASE_URL=https://api.groq.com/openai/v1
# OPENAI_MODEL=llama-3.1-8b-instant
```

**Note:** Ensure there is no space after `=` in `PINECONE_API_KEY`.

### 3. Create Pinecone Index

Using the CLI:

```bash
pc index create -n uofttri-website-rag -m cosine -c aws -r us-east-1 \
  --model llama-text-embed-v2 \
  --field_map text=content
```

Or create manually in [Pinecone Console](https://app.pinecone.io/) with:
- Metric: `cosine`
- Cloud: AWS, region `us-east-1`
- Embedding model: `llama-text-embed-v2`
- Field map: `text=content`

### 4. Ingest Website Content

A seed file with core content is already in `backend/data/website-content.json`. Ingest it:

```bash
cd backend && npm run ingest-rag
```

To refresh content from the live site (optional, requires Puppeteer):

```bash
# With frontend running, or against production:
SITE_BASE_URL=https://uoft-tri.club npm run extract-website
npm run ingest-rag
```

### 5. Test the API

```bash
curl -X POST http://localhost:5001/api/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I join the club?"}'
```

Expected response:

```json
{
  "answer": "To join the UofT Triathlon Club, you need to...",
  "sources": ["/join-us", "/faq"]
}
```

For off-topic questions:

```json
{
  "answer": "I can't answer that, email us instead!",
  "sources": []
}
```

## API Reference

**POST `/api/rag/ask`**

Request body:

```json
{
  "question": "What are the swim workout requirements?"
}
```

Response:

```json
{
  "answer": "You must be able to swim 300m continuously...",
  "sources": ["/faq", "/join-us"]
}
```

## Indexed Pages

- `/` – Home
- `/join-us` – Joining, fees, charter
- `/faq` – Frequently asked questions
- `/coaches-exec` – Team info (when extracted)
- `/resources` – Resources
- `/team-gear` – Team gear
- `/privacy` – Privacy policy
- `/support` – App support

Admin pages (`/admin/*`), login, and user-specific pages are excluded.

## Updating Content

1. **Manual:** Edit `backend/data/website-content.json` and run `npm run ingest-rag`.
2. **Automatic:** Run `npm run extract-website` (with site running or `SITE_BASE_URL` set) then `npm run ingest-rag`.
