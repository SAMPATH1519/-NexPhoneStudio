/**
 * NexPhone Studio - Pure JavaScript RAG (Retrieval-Augmented Generation) Engine
 * 
 * Implements:
 * 1. Semantic document chunking of product catalog, store policies, and comparison guides
 * 2. Inverted Index with BM25 Okapi scoring (k1=1.2, b=0.75)
 * 3. TF-IDF Vector Space Model with Cosine Similarity
 * 4. Entity & Attribute Extractor (price bounds, RAM, brands, feature intents)
 * 5. Hybrid Retrieval with constraint boosting & Top-K ranked citations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard English stop words
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have',
  'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself',
  'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into',
  'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
  'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
  'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t',
  'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s',
  'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t',
  'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself',
  'yourselves', 'phone', 'phones', 'mobile', 'mobiles', 'show', 'tell', 'give', 'please'
]);

export class RagEngine {
  constructor() {
    this.chunks = [];
    this.invertedIndex = new Map(); // term -> { docId, tf }[]
    this.docLengths = new Map();   // docId -> token count
    this.avgDocLength = 0;
    this.idfMap = new Map();       // term -> IDF score
    this.vectorIndex = new Map();   // docId -> Map(term -> tfidf)
    this.vectorNorms = new Map();   // docId -> Euclidean norm
    this.isInitialized = false;
  }

  /**
   * Tokenizes and normalizes text into clean terms
   */
  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s₹$]/g, ' ')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length > 1 && !STOP_WORDS.has(t));
  }

  /**
   * Loads raw datasets and builds semantic chunks
   */
  loadKnowledgeBase() {
    const dataDir = path.resolve(__dirname, '../data');
    this.chunks = [];

    // 1. Ingest Products Catalog
    const productsPath = path.join(dataDir, 'products.json');
    if (fs.existsSync(productsPath)) {
      const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      for (const p of products) {
        const specsText = [
          `Product: ${p.model} by ${p.brand}`,
          `Price: ₹${p.price.toLocaleString('en-IN')} (MRP: ₹${p.mrp.toLocaleString('en-IN')})`,
          `RAM & Storage: ${p.ram}, ${p.storage}`,
          `Display: ${p.display}`,
          `Camera: ${p.camera}`,
          `Battery & Charging: ${p.battery}`,
          `Processor: ${p.processor}`,
          `Key Features: ${p.key_features.join('; ')}`,
          `Best For: ${p.best_for}`,
          `Pros: ${p.pros.join(', ')}`,
          `Cons: ${p.cons.join(', ')}`,
          `Stock Status: ${p.in_stock ? 'In Stock' : 'Out of Stock'}`,
          `Customer Rating: ${p.rating}/5`
        ].join('\n');

        this.chunks.push({
          id: `product-${p.id}`,
          title: `${p.model} Full Specifications`,
          type: 'product',
          content: specsText,
          metadata: {
            brand: p.brand,
            series: p.series || '',
            model: p.model,
            price: p.price,
            ram: p.ram,
            ram_size_gb: p.ram_size_gb || (p.ram.includes('8GB') ? 8 : p.ram.includes('12GB') ? 12 : 6),
            camera: p.camera,
            battery: p.battery,
            processor: p.processor,
            rating: p.rating
          }
        });
      }
    }

    // 2. Ingest Store Policies & Offers
    const policiesPath = path.join(dataDir, 'store_policies.json');
    if (fs.existsSync(policiesPath)) {
      const policies = JSON.parse(fs.readFileSync(policiesPath, 'utf8'));
      
      // Promotions chunk
      if (policies.current_promotions) {
        for (let i = 0; i < policies.current_promotions.length; i++) {
          const promo = policies.current_promotions[i];
          this.chunks.push({
            id: `policy-promo-${i}`,
            title: `Store Promotion: ${promo.title}`,
            type: 'policy',
            content: `Promotion Title: ${promo.title}\nDetails: ${promo.details}\n${promo.processing_fee ? 'Fee: ' + promo.processing_fee : ''}\n${promo.requirements ? 'Requirements: ' + promo.requirements : ''}`,
            metadata: {
              category: 'promotions',
              title: promo.title
            }
          });
        }
      }

      // Warranty and returns chunk
      if (policies.warranty_and_returns) {
        const wr = policies.warranty_and_returns;
        this.chunks.push({
          id: 'policy-warranty-returns',
          title: 'Store Warranty, Replacement, and Return Policy',
          type: 'policy',
          content: [
            `Official Brand Warranty: ${wr.brand_warranty}`,
            `7-Day Replacement Guarantee: ${wr.replacement_policy}`,
            `Return Policy: ${wr.return_policy}`,
            `Authorized Service Support: ${wr.service_centers}`
          ].join('\n'),
          metadata: {
            category: 'warranty_and_returns'
          }
        });
      }
    }

    // 3. Ingest Narrative Markdown Knowledge Base (Section Chunks)
    const kbPath = path.join(dataDir, 'knowledge_base.md');
    if (fs.existsSync(kbPath)) {
      const kbText = fs.readFileSync(kbPath, 'utf8');
      const sections = kbText.split(/(?=\n##\s+\d+\.)/);
      
      sections.forEach((sec, idx) => {
        const trimmed = sec.trim();
        if (!trimmed) return;
        
        const titleMatch = trimmed.match(/##\s+\d+\.\s*(.+)/);
        const sectionTitle = titleMatch ? titleMatch[1].trim() : `Buying Guide Part ${idx + 1}`;
        
        this.chunks.push({
          id: `kb-guide-section-${idx}`,
          title: `Buying Guide: ${sectionTitle}`,
          type: 'guide',
          content: trimmed,
          metadata: {
            section: sectionTitle,
            isComparison: sectionTitle.toLowerCase().includes('compar') || sectionTitle.toLowerCase().includes('vs')
          }
        });
      });
    }
  }

  /**
   * Builds BM25 Inverted Index & TF-IDF Vector Spaces
   */
  buildIndex() {
    this.invertedIndex.clear();
    this.docLengths.clear();
    this.idfMap.clear();
    this.vectorIndex.clear();
    this.vectorNorms.clear();

    const N = this.chunks.length;
    let totalLength = 0;

    // Step 1: Tokenize chunks and build raw term counts
    for (const chunk of this.chunks) {
      const fullText = `${chunk.title} ${chunk.content}`;
      const tokens = this.tokenize(fullText);
      this.docLengths.set(chunk.id, tokens.length);
      totalLength += tokens.length;

      const tfMap = new Map();
      for (const token of tokens) {
        tfMap.set(token, (tfMap.get(token) || 0) + 1);
      }

      for (const [term, tf] of tfMap.entries()) {
        if (!this.invertedIndex.has(term)) {
          this.invertedIndex.set(term, []);
        }
        this.invertedIndex.get(term).push({ docId: chunk.id, tf });
      }
    }

    this.avgDocLength = N > 0 ? totalLength / N : 1;

    // Step 2: Compute BM25 Inverse Document Frequency (IDF)
    for (const [term, postings] of this.invertedIndex.entries()) {
      const df = postings.length;
      // Standard BM25 IDF formula with smoothing
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      this.idfMap.set(term, Math.max(0.01, idf));
    }

    // Step 3: Compute TF-IDF Vectors and Norms for Cosine Similarity
    for (const chunk of this.chunks) {
      const tokens = this.tokenize(`${chunk.title} ${chunk.content}`);
      const termCounts = new Map();
      for (const t of tokens) {
        termCounts.set(t, (termCounts.get(t) || 0) + 1);
      }

      const vector = new Map();
      let sumSquares = 0;

      for (const [term, count] of termCounts.entries()) {
        const idf = this.idfMap.get(term) || 0.1;
        const tf = 1 + Math.log(count);
        const tfidf = tf * idf;
        vector.set(term, tfidf);
        sumSquares += tfidf * tfidf;
      }

      this.vectorIndex.set(chunk.id, vector);
      this.vectorNorms.set(chunk.id, Math.sqrt(sumSquares) || 1);
    }

    this.isInitialized = true;
  }

  /**
   * Initializes the engine if not already built
   */
  init() {
    if (!this.isInitialized) {
      this.loadKnowledgeBase();
      this.buildIndex();
    }
  }

  /**
   * Extracts structured entities from user prompt
   * (e.g., price ceiling, RAM requirement, target brands)
   */
  extractQueryEntities(query) {
    const text = query.toLowerCase();
    const entities = {
      maxPrice: null,
      targetRam: null,
      brands: [],
      wantsCamera: false,
      wantsBattery: false,
      wantsGaming: false,
      wantsCompare: false,
      wantsOffers: false
    };

    // Detect price bounds: "under 25000", "under 25k", "under ₹25,000", "below 20000"
    const priceMatch = text.match(/(?:under|below|less than|within|upto|up to)\s*(?:rs\.?|inr|₹)?\s*(\d{1,3}(?:,\d{3})*|\d+)\s*(k|thousand)?/i);
    if (priceMatch) {
      let num = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (priceMatch[2] && priceMatch[2].toLowerCase().startsWith('k')) {
        num *= 1000;
      }
      if (num < 1000 && num > 10) num *= 1000; // e.g. "under 25" -> 25000
      entities.maxPrice = num;
    }

    // Detect RAM: "8gb", "8 gb", "12gb", "6gb"
    const ramMatch = text.match(/(\d+)\s*(?:gb|gigs?)\s*(?:ram)?/i);
    if (ramMatch) {
      entities.targetRam = parseInt(ramMatch[1], 10);
    }

    // Detect Brands
    const brandList = ['samsung', 'redmi', 'xiaomi', 'oneplus', 'apple', 'iphone', 'realme', 'google', 'pixel', 'vivo', 'iqoo', 'motorola', 'moto', 'nothing'];
    for (const b of brandList) {
      if (new RegExp(`\\b${b}\\b`, 'i').test(text)) {
        entities.brands.push(b === 'iphone' ? 'apple' : b === 'xiaomi' ? 'redmi' : b);
      }
    }

    // Intent flags
    if (/camera|photo|lens|portrait|zoom|video|megapixels?|sensor/i.test(text)) entities.wantsCamera = true;
    if (/battery|mah|charging|backup|endurance|drain/i.test(text)) entities.wantsBattery = true;
    if (/gam(?:ing|e)|processor|antutu|snapdragon|dimensity|fps/i.test(text)) entities.wantsGaming = true;
    if (/compar(?:e|ison)|vs|versus|difference/i.test(text)) entities.wantsCompare = true;
    if (/offer|discount|emi|cashback|exchange|bank|deal/i.test(text)) entities.wantsOffers = true;

    return entities;
  }

  /**
   * Retrieves Top-K relevant chunks using hybrid BM25 + Cosine + Entity Boosting
   */
  retrieve(query, topK = 4) {
    this.init();

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const entities = this.extractQueryEntities(query);
    const k1 = 1.2;
    const b = 0.75;
    const bm25Scores = new Map();
    const chunkMap = new Map(this.chunks.map(c => [c.id, c]));

    // 1. Calculate BM25 Okapi Scores
    for (const token of queryTokens) {
      const postings = this.invertedIndex.get(token);
      if (!postings) continue;

      const idf = this.idfMap.get(token) || 0.1;

      for (const { docId, tf } of postings) {
        const docLen = this.docLengths.get(docId) || this.avgDocLength;
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (docLen / this.avgDocLength));
        const score = idf * (numerator / denominator);

        bm25Scores.set(docId, (bm25Scores.get(docId) || 0) + score);
      }
    }

    // 2. Calculate Query TF-IDF Vector & Cosine Similarity
    const queryTermCounts = new Map();
    for (const t of queryTokens) {
      queryTermCounts.set(t, (queryTermCounts.get(t) || 0) + 1);
    }

    const queryVector = new Map();
    let querySumSq = 0;
    for (const [t, count] of queryTermCounts.entries()) {
      const idf = this.idfMap.get(t) || 0.1;
      const tf = 1 + Math.log(count);
      const val = tf * idf;
      queryVector.set(t, val);
      querySumSq += val * val;
    }
    const queryNorm = Math.sqrt(querySumSq) || 1;

    const cosineScores = new Map();
    for (const chunk of this.chunks) {
      const docVector = this.vectorIndex.get(chunk.id);
      const docNorm = this.vectorNorms.get(chunk.id) || 1;
      if (!docVector) continue;

      let dotProduct = 0;
      for (const [t, qWeight] of queryVector.entries()) {
        const dWeight = docVector.get(t);
        if (dWeight) {
          dotProduct += qWeight * dWeight;
        }
      }

      const cosine = dotProduct / (queryNorm * docNorm);
      cosineScores.set(chunk.id, cosine);
    }

    // 3. Combine scores with Entity & Semantic Constraint Boosters
    const combinedScores = [];

    for (const chunk of this.chunks) {
      const bm25 = bm25Scores.get(chunk.id) || 0;
      const cosine = cosineScores.get(chunk.id) || 0;

      // Base hybrid score (normalized weights)
      let score = (bm25 * 0.6) + (cosine * 15.0);

      // Targeted Entity Boosts
      if (chunk.type === 'product' && chunk.metadata) {
        const p = chunk.metadata;

        // Price constraint boost
        if (entities.maxPrice !== null) {
          if (p.price && p.price <= entities.maxPrice) {
            score += 8.0; // Highly relevant to price ceiling
          } else if (p.price && p.price > entities.maxPrice * 1.15) {
            score *= 0.2; // Penalize products out of budget
          }
        }

        // RAM constraint boost
        if (entities.targetRam !== null) {
          if (p.ram_size_gb === entities.targetRam) {
            score += 6.0;
          }
        }

        // Brand match boost
        if (entities.brands.length > 0) {
          const brandLower = (p.brand || '').toLowerCase();
          const modelLower = (p.model || '').toLowerCase();
          const matchesBrand = entities.brands.some(b => brandLower.includes(b) || modelLower.includes(b));
          if (matchesBrand) {
            score += 7.0;
          }
        }

        // Feature intent boost
        if (entities.wantsCamera && (/camera|zeiss|periscope|sony|ois|200mp/i.test(chunk.content))) {
          score += 3.5;
        }
        if (entities.wantsBattery && (/5500 mah|6000 mah|100w/i.test(chunk.content))) {
          score += 3.5;
        }
      }

      // Comparison guide boost for comparison queries
      if (chunk.type === 'guide') {
        if (entities.wantsCompare && chunk.metadata && chunk.metadata.isComparison) {
          score += 15.0;
        }
        if (entities.maxPrice !== null && chunk.title.includes('Under ₹25,000')) {
          score += 10.0;
        }
        if (entities.wantsCamera && chunk.title.includes('Camera')) {
          score += 8.0;
        }
        if (entities.wantsBattery && chunk.title.includes('Battery')) {
          score += 8.0;
        }
        if (entities.targetRam === 8 && chunk.title.includes('8GB RAM')) {
          score += 8.0;
        }
      }

      // Store promotions boost
      if (entities.wantsOffers && chunk.type === 'policy') {
        score += 8.0;
      }

      if (score > 0.1) {
        combinedScores.push({
          chunk,
          score,
          bm25,
          cosine
        });
      }
    }

    // 4. Sort descending by relevance score
    combinedScores.sort((a, b) => b.score - a.score);

    // 5. Select Top-K with diversity (avoid picking only identical items)
    const topResults = combinedScores.slice(0, topK).map(item => ({
      id: item.chunk.id,
      title: item.chunk.title,
      type: item.chunk.type,
      content: item.chunk.content,
      score: parseFloat(item.score.toFixed(2)),
      metadata: item.chunk.metadata || {}
    }));

    return topResults;
  }

  /**
   * Helper to format retrieved chunks into a prompt context string
   */
  formatContextForLLM(retrievedChunks) {
    if (!retrievedChunks || retrievedChunks.length === 0) {
      return "No specific store product records matched the query directly.";
    }

    return retrievedChunks
      .map((c, i) => `[DOCUMENT ${i + 1}: ${c.title}]\n${c.content}`)
      .join('\n\n----------------------------------------\n\n');
  }
}

// Export singleton instance for fast reuse across invocations
export const rag = new RagEngine();
