#!/usr/bin/env node
/**
 * Ingests website content into Pinecone. Run after extractWebsiteContent.js.
 *
 * Prerequisites:
 * 1. Create index: pc index create -n uofttri-website-rag -m cosine -c aws -r us-east-1 --model llama-text-embed-v2 --field_map text=content
 * 2. Set PINECONE_API_KEY and PINECONE_INDEX in .env
 *
 * Usage: node backend/scripts/ingestToPinecone.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs');
const path = require('path');

const NAMESPACE = 'website';
const BATCH_SIZE = 96;
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + size;
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start) end = lastSpace;
    }
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks.filter((c) => c.length > 30);
}

async function main() {
  const apiKey = process.env.PINECONE_API_KEY?.trim();
  const indexName = process.env.PINECONE_INDEX || 'uofttri-website-rag';
  if (!apiKey) {
    console.error('❌ PINECONE_API_KEY required in .env');
    process.exit(1);
  }

  const dataPath = path.join(__dirname, '..', 'data', 'website-content.json');
  if (!fs.existsSync(dataPath)) {
    console.error('❌ Run extractWebsiteContent.js first to create', dataPath);
    process.exit(1);
  }

  const pages = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const records = [];
  let id = 0;
  for (const page of pages) {
    const chunks = chunkText(page.content);
    for (const chunk of chunks) {
      records.push({
        _id: `chunk_${id}`,
        content: chunk,
        source: page.path || page.url || '/',
      });
      id++;
    }
  }

  console.log(`📤 Upserting ${records.length} chunks to index "${indexName}" namespace "${NAMESPACE}"`);

  const pc = new Pinecone({ apiKey });
  const index = pc.index(indexName);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await index.namespace(NAMESPACE).upsertRecords(batch);
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}\r`);
  }
  console.log(`\n✅ Ingested ${records.length} records. Wait ~10s before querying.`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
