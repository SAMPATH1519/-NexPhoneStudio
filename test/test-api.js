/**
 * Integration Test for /api/chat endpoint
 */
async function runApiTests() {
  console.log("=== Testing NexPhone Studio /api/chat Endpoint ===\n");

  const baseUrl = "http://localhost:3000";

  // Test 1: Health check / Homepage
  try {
    const resHome = await fetch(baseUrl);
    console.log(`[Test 1] GET / -> Status: ${resHome.status} ${resHome.status === 200 ? '✅ OK' : '❌ FAIL'}`);
  } catch (err) {
    console.error(`[Test 1] Failed to connect:`, err.message);
    return;
  }

  // Test 2: Validation - Empty question
  try {
    const resEmpty = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "" })
    });
    const dataEmpty = await resEmpty.json();
    console.log(`[Test 2] Empty message validation -> Status: ${resEmpty.status} (Expected 400) ${resEmpty.status === 400 ? '✅ OK' : '❌ FAIL'}`);
    console.log(`         Error response: "${dataEmpty.message}"`);
  } catch (err) {
    console.error(`[Test 2] Error:`, err.message);
  }

  // Test 3: The 5 required user queries
  const queries = [
    "Which phone is best under ₹25,000?",
    "Which phone has the best camera?",
    "Compare Samsung A-series and Redmi phones.",
    "Which phones have 8GB RAM?",
    "Which phone has the best battery?"
  ];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    console.log(`\n[Test 3.${i + 1}] Testing Query: "${q}"`);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q })
      });
      const data = await res.json();
      console.log(`         Status: ${res.status} ${res.status === 200 ? '✅ OK' : '❌ FAIL'}`);
      console.log(`         Retrieved Sources count: ${data.sources ? data.sources.length : 0}`);
      if (data.sources && data.sources.length > 0) {
        data.sources.forEach(s => console.log(`           - ${s.title} (Match: ${s.score})`));
      }
      console.log(`         Answer preview: ${data.answer.substring(0, 120).replace(/\n/g, ' ')}...`);
    } catch (err) {
      console.error(`         Failed:`, err.message);
    }
  }

  console.log("\n=== API Integration Tests Completed! ===");
}

runApiTests();
