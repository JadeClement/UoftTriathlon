/**
 * RAG API: Answer questions from website content.
 * If the answer is not in the indexed content, returns "I can't answer that, email us instead!"
 */

const express = require('express');
const router = express.Router();
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

const NAMESPACE = 'website';
const TOP_K = 8;
const TOP_K_RERANK = 6; // Pass more context for detailed answers
const SCORE_THRESHOLD = 0.001; // Pinecone scores are typically 0.001–0.05; use low threshold
const FALLBACK_MESSAGE = "I can't answer that, email us instead at info@uoft-tri.club!";

let pineconeIndex = null;
let openaiClient = null;

function getPineconeIndex() {
  if (pineconeIndex) return pineconeIndex;
  const apiKey = process.env.PINECONE_API_KEY?.trim();
  const indexName = process.env.PINECONE_INDEX || 'uofttri-website-rag';
  if (!apiKey) return null;
  const pc = new Pinecone({ apiKey });
  pineconeIndex = pc.index(indexName);
  return pineconeIndex;
}

function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  openaiClient = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  return openaiClient;
}

// Diagnostic endpoint - check if RAG is configured (no secrets exposed)
router.get('/status', (req, res) => {
  const hasPinecone = !!(process.env.PINECONE_API_KEY?.trim());
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const indexName = process.env.PINECONE_INDEX || 'uofttri-website-rag';
  res.json({
    ready: hasPinecone && hasOpenAI,
    hasPinecone,
    hasOpenAI,
    indexName,
  });
});

router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question is required' });
    }

    const trimmed = question.trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'question cannot be empty' });
    }

    const index = getPineconeIndex();
    const openai = getOpenAIClient();

    if (!index) {
      return res.status(503).json({
        error: 'RAG service unavailable',
        answer: FALLBACK_MESSAGE,
      });
    }

    const results = await index.namespace(NAMESPACE).searchRecords({
      query: {
        topK: TOP_K * 2,
        inputs: { text: trimmed },
      },
      rerank: {
        model: 'bge-reranker-v2-m3',
        topN: TOP_K,
        rankFields: ['content'],
      },
    });

    const hits = results?.result?.hits || [];
    const topHit = hits[0];
    const score = topHit?._score ?? topHit?.score ?? 0;

    console.log('[RAG] Hits:', hits.length, 'Top score:', score);

    if (hits.length === 0) {
      console.log('[RAG] Fallback: no hits from Pinecone (index may be empty - run npm run ingest-rag)');
      return res.json({ answer: FALLBACK_MESSAGE, sources: [] });
    }

    if (score < SCORE_THRESHOLD) {
      console.log('[RAG] Fallback: score below threshold');
      return res.json({ answer: FALLBACK_MESSAGE, sources: [] });
    }

    const context = hits
      .slice(0, TOP_K_RERANK)
      .map((h) => (h.fields && typeof h.fields === 'object' ? h.fields.content : ''))
      .filter(Boolean)
      .join('\n\n');

    const sources = hits.slice(0, TOP_K_RERANK).map((h) => h.fields?.source || '').filter(Boolean);

    if (!openai) {
      return res.status(503).json({
        error: 'LLM service unavailable. Set OPENAI_API_KEY.',
        answer: FALLBACK_MESSAGE,
        sources: [],
      });
    }

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant for the UofT Triathlon Club. Answer ONLY from the context below.

Rules:
- Give detailed, actionable answers. Include step-by-step instructions when relevant.
- Mention specific URLs (e.g. recreation.utoronto.ca), fees, and info@uoft-tri.club when they appear in the context.
- Don't just say "click the link" or "see the website"—explain the actual steps.
- Be friendly and clear. Use bullet points for multi-step processes.
- If the context does not contain the answer, say exactly: "${FALLBACK_MESSAGE}"`,
        },
        {
          role: 'user',
          content: `Context from the website:\n\n${context}\n\n---\n\nQuestion: ${trimmed}`,
        },
      ],
      max_tokens: 500,
    });

    const answer = response?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return res.json({ answer: FALLBACK_MESSAGE, sources });
    }

    const shouldFallback = answer.toLowerCase().includes("i can't") ||
      answer.toLowerCase().includes("i don't have") ||
      answer.toLowerCase().includes('email us');

    return res.json({
      answer: shouldFallback ? FALLBACK_MESSAGE : answer,
      sources: [...new Set(sources)],
    });
  } catch (err) {
    console.error('RAG ask error:', err);
    res.status(500).json({
      error: 'Something went wrong',
      answer: FALLBACK_MESSAGE,
      sources: [],
    });
  }
});

module.exports = router;
