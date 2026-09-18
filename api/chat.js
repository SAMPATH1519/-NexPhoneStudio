/**
 * RAG Chat API with OpenRouter LLM + Local Grounding Fallback.
 * Integrates indexed catalog chunks with live LLM (OpenRouter) or local RAG engine.
 */
import { rag } from '../lib/rag.js';
import { logChatbotQuery } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are supported on this endpoint.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const message = String(body.message || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return res.status(400).json({ error: 'Bad Request', message: 'Please provide a non-empty question in the "message" field.' });
    }

    const storeName = process.env.STORE_NAME || 'NexPhone Studio';
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

    // 1. Local RAG retrieval
    const chunks = rag.retrieve(message, 5);
    const sources = chunks.map(chunk => ({
      id: chunk.id,
      title: chunk.title,
      type: chunk.type,
      score: chunk.score,
      brand: chunk.metadata?.brand || null,
      price: chunk.metadata?.price ? `₹${chunk.metadata.price.toLocaleString('en-IN')}` : null
    }));

    // 2. Try OpenRouter if API key is provided and not a placeholder
    const isApiKeyConfigured = apiKey && apiKey.trim() && !apiKey.includes('your_openrouter_api_key_here');

    if (isApiKeyConfigured) {
      try {
        const llmResult = await callOpenRouter(message, chunks, history, storeName, apiKey, model);
        if (llmResult && llmResult.text) {
          logChatbotQuery(message, 'openrouter-rag', sources.length);
          return res.status(200).json({
            answer: llmResult.text,
            sources,
            mode: 'openrouter-rag',
            model: llmResult.model || model
          });
        }
      } catch (llmError) {
        console.warn('OpenRouter call failed, falling back to local RAG generator:', llmError.message);
        
        const localAnswer = generateGroundedAnswer(message, chunks, storeName);
        let notice = null;
        if (llmError.status === 402 || llmError.message?.includes('credits')) {
          notice = '⚠️ OpenRouter credit balance is ₹0 ($0). Showing local RAG answer. Add credits at openrouter.ai/settings/credits for live LLM.';
        } else if (llmError.status === 429) {
          notice = '⚠️ AI model rate-limited. Showing local store RAG answer.';
        }

        logChatbotQuery(message, 'local-rag', sources.length);
        return res.status(200).json({
          answer: localAnswer,
          sources,
          mode: 'local-rag',
          notice
        });
      }
    }

    // 3. Built-in Local RAG Answer (Offline / Default mode)
    logChatbotQuery(message, 'local-rag', sources.length);
    return res.status(200).json({
      answer: generateGroundedAnswer(message, chunks, storeName),
      sources,
      mode: 'local-rag'
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message || 'Unable to process the question.' });
  }
}

/**
 * Call OpenRouter Chat Completions with retrieved catalog context
 */
async function callOpenRouter(query, chunks, history, storeName, apiKey, model) {
  let contextText = '';
  if (chunks.length > 0) {
    contextText = chunks.map((c, i) => {
      let metaStr = '';
      if (c.metadata && c.type === 'product') {
        metaStr = ` [Price: ₹${c.metadata.price || 'N/A'}, RAM: ${c.metadata.ram || 'N/A'}, Camera: ${c.metadata.camera || 'N/A'}, Battery: ${c.metadata.battery || 'N/A'}]`;
      }
      return `[Source ${i + 1}: ${c.title}${metaStr}]\n${c.content}`;
    }).join('\n\n');
  } else {
    contextText = 'No specific catalog chunks found for this query.';
  }

  const systemPrompt = `You are the friendly, expert AI sales and product assistant for "${storeName}", an authorized smartphone retailer in India.
Your goal is to help customers find the right mobile phone, compare specifications, and answer questions about store policies (warranty, EMI, returns, delivery).

CRITICAL INSTRUCTIONS:
1. Ground your recommendations on the STORE CONTEXT provided below whenever applicable.
2. Always quote prices in Indian Rupees (₹) exactly as listed in the context.
3. Highlight key features like processor, camera, battery (mAh), and fast charging when comparing.
4. Format your responses with clean Markdown: use bullet points, bold text for phone models and prices.
5. If the user asks something not covered in the context, give helpful general mobile knowledge while politely suggesting they confirm availability with store staff.
6. Keep answers concise, clear, and easy to read.

STORE CONTEXT:
${contextText}`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  if (Array.isArray(history)) {
    for (const msg of history.slice(-4)) {
      if (msg && msg.role && msg.content) {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: String(msg.content).slice(0, 500)
        });
      }
    }
  }

  messages.push({ role: 'user', content: query });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': storeName
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 600
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      const err = new Error(data?.error?.message || `OpenRouter returned status ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const choice = data.choices?.[0];
    const text = choice?.message?.content?.trim();
    if (!text) {
      throw new Error('Empty response received from OpenRouter');
    }

    return {
      text,
      model: data.model || model
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Local Grounded Answer Generator (Zero dependency / fallback)
 */
function generateGroundedAnswer(query, chunks, storeName) {
  if (!chunks.length) return `I could not find that in ${storeName}'s current knowledge base. Try asking about a phone, budget, camera, battery, RAM, warranty, or EMI.`;

  const products = chunks.filter(chunk => chunk.type === 'product');
  const guides = chunks.filter(chunk => chunk.type !== 'product');
  let answer = `> **Store Knowledge Base Answer** — based on ${chunks.length} matching catalog sources:\n\n`;

  if (products.length) {
    answer += '### Recommended Smartphones\n\n';
    for (const product of products.slice(0, 3)) {
      const data = product.metadata || {};
      const price = data.price ? ` — **₹${data.price.toLocaleString('en-IN')}**` : '';
      answer += `- **${data.model || product.title.replace(/ Full Specifications$/, '')}**${price}\n`;
      const details = [data.processor, data.camera, data.battery].filter(Boolean);
      if (details.length) answer += `  - ${details.join(' · ')}\n`;
    }
    answer += '\n';
  }

  if (guides.length) {
    answer += '### Store Policy & Guide\n\n';
    for (const guide of guides.slice(0, 2)) {
      const content = guide.content.replace(/\s+/g, ' ').trim();
      answer += `- **${guide.title}**: ${content.slice(0, 420)}${content.length > 420 ? '…' : ''}\n`;
    }
  }

  return answer || `I found matching information in ${storeName}'s knowledge base.`;
}
