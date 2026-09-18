/**
 * Automated Verification Script for NexPhone Studio RAG Retrieval Engine
 */
import { rag } from '../lib/rag.js';

const testQueries = [
  "Which phone is best under ₹25,000?",
  "Which phone has the best camera?",
  "Compare Samsung A-series and Redmi phones.",
  "Which phones have 8GB RAM?",
  "Which phone has the best battery?"
];

console.log("=== Testing NexPhone Studio RAG Engine ===\n");
rag.init();
console.log(`Total knowledge chunks indexed: ${rag.chunks.length}`);
console.log(`Total unique indexed terms: ${rag.invertedIndex.size}\n`);

let allPassed = true;

for (const q of testQueries) {
  console.log(`\n🔍 Query: "${q}"`);
  const results = rag.retrieve(q, 3);
  
  if (results.length === 0) {
    console.error(`❌ FAILED: No results returned for "${q}"`);
    allPassed = false;
    continue;
  }

  console.log(`✅ Retrieved ${results.length} chunks (Top score: ${results[0].score}):`);
  results.forEach((r, idx) => {
    console.log(`   [${idx + 1}] (${r.type}) ${r.title} [Score: ${r.score}]`);
  });
}

if (allPassed) {
  console.log("\n🎉 All 5 core test queries retrieved relevant documents successfully!");
} else {
  console.error("\n⚠️ Some test queries failed.");
  process.exit(1);
}
