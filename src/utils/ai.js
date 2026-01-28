import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const AI_CACHE_PATH = path.join(STORAGE_DIR, 'ai_cache.json');
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const rateLimiter = {
  lastRequest: 0,
  minInterval: 2000,
  requestCount: 0,
  resetTime: 0,
  maxRequestsPerMinute: 25
};

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function loadCache() {
  try {
    ensureStorageDir();
    if (fs.existsSync(AI_CACHE_PATH)) {
      const raw = fs.readFileSync(AI_CACHE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (error) {
    logger.error('Error loading AI cache:', error);
  }
  return {
    wouldYouRather: [],
    trivia: [],
    truth: [],
    dare: [],
    riddles: [],
    akinator: { questions: [], guessPatterns: {} },
    lastUpdated: {}
  };
}

function saveCache(cache) {
  try {
    ensureStorageDir();
    fs.writeFileSync(AI_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Error saving AI cache:', error);
  }
}

async function checkRateLimit() {
  const now = Date.now();
  
  if (now - rateLimiter.resetTime > 60000) {
    rateLimiter.requestCount = 0;
    rateLimiter.resetTime = now;
  }
  
  if (rateLimiter.requestCount >= rateLimiter.maxRequestsPerMinute) {
    const waitTime = 60000 - (now - rateLimiter.resetTime);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    rateLimiter.requestCount = 0;
    rateLimiter.resetTime = Date.now();
  }
  
  const timeSinceLastRequest = now - rateLimiter.lastRequest;
  if (timeSinceLastRequest < rateLimiter.minInterval) {
    await new Promise(resolve => setTimeout(resolve, rateLimiter.minInterval - timeSinceLastRequest));
  }
  
  rateLimiter.lastRequest = Date.now();
  rateLimiter.requestCount++;
}

async function callGroq(messages, options = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }
  
  await checkRateLimit();
  
  const body = {
    model: options.model || MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens || 2048,
    top_p: options.topP || 1,
    stream: false
  };
  
  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    logger.error('Groq API call failed:', error);
    throw error;
  }
}

async function askAI(question, context = '') {
  const messages = [
    {
      role: 'system',
      content: 'You are a helpful, friendly, and knowledgeable AI assistant. Keep responses concise but informative. Be conversational and engaging.'
    }
  ];
  
  if (context) {
    messages.push({ role: 'system', content: `Context: ${context}` });
  }
  
  messages.push({ role: 'user', content: question });
  
  return await callGroq(messages, { maxTokens: 1024 });
}

async function generateBulkContent(type, count = 50) {
  const cache = loadCache();
  
  const prompts = {
    wouldYouRather: `Generate ${count} unique "Would You Rather" questions for a chat game. Make them fun, thought-provoking, and appropriate for all ages. Mix between silly, philosophical, and creative scenarios.

Return as JSON array with objects having "a" and "b" properties for each option.
Example: [{"a": "Be able to fly", "b": "Be invisible"}, ...]`,

    trivia: `Generate ${count} unique trivia questions covering various topics (science, history, geography, entertainment, sports, etc). Mix difficulty levels.

Return as JSON array with objects having "question", "answer" (single word or short phrase, lowercase), and "options" (array of 4 choices including the answer).
Example: [{"question": "What planet is known as the Red Planet?", "answer": "mars", "options": ["Venus", "Mars", "Jupiter", "Saturn"]}, ...]`,

    truth: `Generate ${count} unique "Truth" questions for a Truth or Dare game. Make them fun, revealing but appropriate. Mix between embarrassing, thoughtful, and silly questions.

Return as JSON array of strings.
Example: ["What's your most embarrassing moment?", "Who was your first crush?", ...]`,

    dare: `Generate ${count} unique "Dare" challenges for a Truth or Dare game played in a chat/messaging app. Dares should be doable via phone/chat (like send a message, take a selfie, etc). Keep them fun and appropriate.

Return as JSON array of strings.
Example: ["Send a voice note singing your favorite song", "Send a selfie with a silly face", ...]`,

    riddles: `Generate ${count} unique riddles with answers. Include a mix of classic-style riddles and clever wordplay. Keep them challenging but solvable.

Return as JSON array with objects having "riddle", "answer" (single word, lowercase), and "hint" properties.
Example: [{"riddle": "What has keys but no locks?", "answer": "piano", "hint": "Musical instrument"}, ...]`
  };
  
  if (!prompts[type]) {
    throw new Error(`Unknown content type: ${type}`);
  }
  
  const messages = [
    {
      role: 'system',
      content: 'You are a content generator for a chat bot game. Generate creative, engaging, and appropriate content. Always respond with valid JSON only, no extra text.'
    },
    {
      role: 'user',
      content: prompts[type]
    }
  ];
  
  try {
    const response = await callGroq(messages, { 
      maxTokens: 4096, 
      temperature: 0.9,
      jsonMode: true 
    });
    
    const parsed = JSON.parse(response);
    const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.questions || parsed.data || []);
    
    if (items.length > 0) {
      cache[type] = [...(cache[type] || []), ...items];
      cache.lastUpdated[type] = Date.now();
      saveCache(cache);
      logger.info(`Generated ${items.length} new ${type} items`);
    }
    
    return items;
  } catch (error) {
    logger.error(`Failed to generate ${type} content:`, error);
    return [];
  }
}

function getCachedItem(type, fallbackArray = []) {
  const cache = loadCache();
  const items = cache[type] || [];
  
  if (items.length > 0) {
    const item = items.shift();
    cache[type] = items;
    saveCache(cache);
    
    if (items.length < 10) {
      generateBulkContent(type, 50).catch(err => 
        logger.error(`Background generation failed for ${type}:`, err)
      );
    }
    
    return item;
  }
  
  generateBulkContent(type, 50).catch(err => 
    logger.error(`Background generation failed for ${type}:`, err)
  );
  
  if (fallbackArray.length > 0) {
    return fallbackArray[Math.floor(Math.random() * fallbackArray.length)];
  }
  
  return null;
}

async function getOrFetchItem(type, fallbackArray = []) {
  const cache = loadCache();
  let items = cache[type] || [];
  
  if (items.length === 0) {
    try {
      const newItems = await generateBulkContent(type, 50);
      if (newItems && newItems.length > 0) {
        items = newItems;
      }
    } catch (err) {
      logger.error(`Failed to fetch ${type}:`, err);
    }
  }
  
  const updatedCache = loadCache();
  items = updatedCache[type] || [];
  
  if (items.length > 0) {
    const item = items.shift();
    updatedCache[type] = items;
    saveCache(updatedCache);
    
    if (items.length < 10) {
      generateBulkContent(type, 50).catch(err => 
        logger.error(`Background generation failed for ${type}:`, err)
      );
    }
    
    return item;
  }
  
  if (fallbackArray.length > 0) {
    return fallbackArray[Math.floor(Math.random() * fallbackArray.length)];
  }
  
  return null;
}

function getCacheCount(type) {
  const cache = loadCache();
  return (cache[type] || []).length;
}

async function ensureCacheHasItems(type, minCount = 10, generateCount = 50) {
  const count = getCacheCount(type);
  if (count < minCount) {
    await generateBulkContent(type, generateCount);
  }
}

async function analyzeAkinatorAnswers(answers, questionHistory) {
  const messages = [
    {
      role: 'system',
      content: `You are playing a 20 questions guessing game. Based on the yes/no answers to questions, you need to make an intelligent guess about what the person is thinking of.

Analyze the pattern of answers carefully:
- "yes" or "y" = confirms the trait
- "no" or "n" = denies the trait
- "maybe" or "idk" = uncertain

Make a specific, confident guess based on the evidence. Think about what could match ALL the confirmed traits while NOT matching denied traits.`
    },
    {
      role: 'user',
      content: `Here are the questions asked and answers received:

${questionHistory.map((q, i) => `Q${i+1}: ${q.question}\nA: ${q.answer}`).join('\n\n')}

Based on these ${answers.length} answers, what is your best guess? Give just the guess, be specific (e.g., "a golden retriever" not just "a dog", "Taylor Swift" not just "a singer").`
    }
  ];
  
  try {
    const response = await callGroq(messages, { maxTokens: 100, temperature: 0.3 });
    return response.trim();
  } catch (error) {
    logger.error('Akinator analysis failed:', error);
    return null;
  }
}

async function generateAkinatorQuestion(questionHistory, answers) {
  const messages = [
    {
      role: 'system',
      content: `You are playing 20 questions. Generate smart, strategic yes/no questions to narrow down what the person is thinking of.

Good questions:
- Start broad (Is it alive? Is it a person? Is it bigger than a car?)
- Get more specific based on previous answers
- Avoid redundant questions
- Target distinguishing features

Previous questions asked: ${questionHistory.map(q => q.question).join('; ') || 'None yet'}`
    },
    {
      role: 'user',
      content: `Based on the answers so far, generate the next strategic yes/no question to ask. Previous answers: ${answers.join(', ') || 'None yet'}. Just give the question, nothing else.`
    }
  ];
  
  try {
    const response = await callGroq(messages, { maxTokens: 100, temperature: 0.7 });
    return response.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    logger.error('Akinator question generation failed:', error);
    return null;
  }
}

export default {
  askAI,
  callGroq,
  generateBulkContent,
  getCachedItem,
  getOrFetchItem,
  getCacheCount,
  ensureCacheHasItems,
  analyzeAkinatorAnswers,
  generateAkinatorQuestion,
  loadCache,
  saveCache
};

export {
  askAI,
  callGroq,
  generateBulkContent,
  getCachedItem,
  getOrFetchItem,
  getCacheCount,
  ensureCacheHasItems,
  analyzeAkinatorAnswers,
  generateAkinatorQuestion
};
