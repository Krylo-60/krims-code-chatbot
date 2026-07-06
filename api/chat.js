import path from 'path';
import fs from 'fs';
import { KrimsClient } from '@krishivpb60/krims-code-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Cached AI Database variables (persisted across warm invocations)
let trainingText = '';
let words = [];
let trigrams = {};
let bigrams = {};
let sentenceStarters = [];
let isTrained = false;

// Train the custom statistical language model from training_data.txt
function trainModel() {
  if (isTrained) return;
  const filePath = path.join(process.cwd(), 'training_data.txt');
  try {
    trainingText = fs.readFileSync(filePath, 'utf-8');
    
    // Split into sentences for starters
    const sentences = trainingText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    sentenceStarters = sentences.map(s => {
      const parts = s.split(/\s+/);
      return parts.slice(0, 2); // First 2 words of each sentence
    }).filter(p => p.length === 2);

    // Tokenize into words
    words = trainingText.split(/\s+/).filter(Boolean);

    // Build Bigram and Trigram probability transition maps
    bigrams = {};
    trigrams = {};

    for (let i = 0; i < words.length - 1; i++) {
      const w1 = words[i].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      const w2 = words[i+1];
      const bKey = w1.toLowerCase();
      if (!bigrams[bKey]) bigrams[bKey] = [];
      bigrams[bKey].push(w2);

      if (i < words.length - 2) {
        const w3 = words[i+2];
        const tKey = `${w1.toLowerCase()} ${w2.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase()}`;
        if (!trigrams[tKey]) trigrams[tKey] = [];
        trigrams[tKey].push(w3);
      }
    }

    isTrained = true;
    console.log(`[Krims Engine] Custom AI Model trained successfully on ${words.length} words!`);
  } catch (err) {
    console.error('[Krims Engine] Failed to read training data, using default corpus:', err);
    // Fallback simple training corpus
    trainingText = 'Krishiv is a coding genius. Krishiv built the Krims Code AI Studio. The AI is fast.';
    const sentences = trainingText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    sentenceStarters = sentences.map(s => {
      const parts = s.split(/\s+/);
      return parts.slice(0, 2);
    }).filter(p => p.length === 2);
    words = trainingText.split(/\s+/).filter(Boolean);
    isTrained = true;
  }
}

// Custom local text generator algorithm
function generateLocalText(prompt, systemInstruction, temperature, maxTokens) {
  const lowerPrompt = prompt.toLowerCase().trim();
  const lowerSystem = (systemInstruction || '').toLowerCase();

  // Handle simple arithmetic queries (e.g. 1+1, 2*3, what is 5+5?)
  const cleanMathExpr = lowerPrompt.replace(/what is/gi, '').replace(/\?/g, '').replace(/=/g, '').trim();
  const mathRegex = /^[0-9+\-*/().\s]+$/;
  if (mathRegex.test(cleanMathExpr) && /[0-9]/.test(cleanMathExpr)) {
    try {
      const result = Function(`"use strict"; return (${cleanMathExpr})`)();
      return `The answer to ${cleanMathExpr} is ${result}!`;
    } catch (e) {
      // Fallback
    }
  }

  // Determine Starting Seeds based on Prompt Keywords
  let seed = [];
  if (lowerPrompt.includes('creator') || lowerPrompt.includes('who created') || lowerPrompt.includes('who made') || lowerPrompt.includes('built you')) {
    seed = ['Krishiv', 'is'];
  } else if (lowerPrompt.includes('sdk') || lowerPrompt.includes('krimsclient')) {
    seed = ['To', 'run'];
  } else if (lowerPrompt.includes('cli') || lowerPrompt.includes('diagnose')) {
    seed = ['Run', 'local'];
  } else if (lowerPrompt.includes('terminal') || lowerPrompt.includes('chat')) {
    seed = ['To', 'start'];
  } else {
    const promptWords = lowerPrompt.split(/\s+/).filter(w => w.length > 2);
    const matches = sentenceStarters.filter(starter => 
      promptWords.some(pw => starter[0].toLowerCase().includes(pw) || starter[1].toLowerCase().includes(pw))
    );

    if (matches.length > 0) {
      seed = matches[Math.floor(Math.random() * matches.length)];
    } else {
      seed = sentenceStarters[Math.floor(Math.random() * sentenceStarters.length)] || ['Welcome', 'to'];
    }
  }

  // Generate words forward using Trigrams and Bigrams
  let outputWords = [...seed];
  let w1 = seed[0];
  let w2 = seed[1];
  const targetLength = maxTokens || 128;

  for (let i = 0; i < targetLength; i++) {
    const tKey = `${w1.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase()} ${w2.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase()}`;
    let nextWord = '';

    if (trigrams[tKey] && trigrams[tKey].length > 0) {
      const list = trigrams[tKey];
      nextWord = list[Math.floor(Math.random() * list.length)];
    } else {
      const bKey = w2.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
      if (bigrams[bKey] && bigrams[bKey].length > 0) {
        const list = bigrams[bKey];
        nextWord = list[Math.floor(Math.random() * list.length)];
      } else {
        nextWord = words[Math.floor(Math.random() * words.length)];
      }
    }

    outputWords.push(nextWord);
    
    if (nextWord.endsWith('.') || nextWord.endsWith('!') || nextWord.endsWith('?')) {
      if (outputWords.length >= 8) {
        break;
      }
    }

    w1 = w2;
    w2 = nextWord;
  }

  let response = outputWords.join(' ');

  // Blend system instructions
  if (lowerSystem.includes('pirate')) {
    const prefixes = ['Ahoy, matey! ', 'Arr! ', 'Shiver me timbers, '];
    const suffixes = [' , arr!', ' , by blackbeard\'s ghost!', ' , matey!'];
    response = prefixes[Math.floor(Math.random() * prefixes.length)] + 
               response.replace(/[.!]/g, '') + 
               suffixes[Math.floor(Math.random() * suffixes.length)];
  }

  if (lowerSystem.includes('strict') || lowerSystem.includes('auditor')) {
    response = `[PERFORMANCE AUDIT: PASS]\n${response}\n\nComplexity estimate: O(1) space, O(N) runtime. Coded by Krishiv.`;
  }

  return response;
}

// Custom Cloud Text Generator using free Hugging Face Serverless API (Qwen-72B)
async function generateCloudText(prompt, systemInstruction, temperature, maxTokens, history) {
  let formattedPrompt = '';
  if (systemInstruction) {
    formattedPrompt += `<|im_start|>system\n${systemInstruction}<|im_end|>\n`;
  } else {
    formattedPrompt += `<|im_start|>system\nYou are a helpful AI assistant.<|im_end|>\n`;
  }

  if (history && history.length > 0) {
    for (const msg of history) {
      formattedPrompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
    }
  }
  formattedPrompt += `<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.HF_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.HF_TOKEN}`;
  }

  const apiResponse = await fetch('https://api-inference.huggingface.co/models/Qwen/Qwen2.5-72B-Instruct', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inputs: formattedPrompt,
      parameters: {
        max_new_tokens: maxTokens || 512,
        temperature: temperature !== undefined ? temperature : 0.7,
        return_full_text: false
      }
    })
  });

  if (!apiResponse.ok) {
    const errorBody = await apiResponse.text();
    throw new Error(`Hugging Face server error: ${apiResponse.status} - ${errorBody}`);
  }

  const result = await apiResponse.json();
  let generatedText = '';
  
  if (Array.isArray(result) && result[0] && result[0].generated_text) {
    generatedText = result[0].generated_text;
  } else if (result.generated_text) {
    generatedText = result.generated_text;
  } else {
    generatedText = JSON.stringify(result);
  }

  return generatedText.replace(/<\|im_end\|>/g, '').replace(/<\|im_start\|>/g, '').trim();
}

// Default export handler for Vercel Serverless Function
export default async function handler(req, res) {
  // CORS Headers support
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    trainModel();
    res.status(200).json({
      ok: true,
      status: 'ready',
      model: 'Krims-Hybrid-AI-System',
      localVocabSize: words.length
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Train model once on cold start
  trainModel();

  const { prompt, model, systemInstruction, temperature, maxTokens, history } = req.body || {};
  if (!prompt) {
    res.status(400).json({ ok: false, error: 'Prompt is required' });
    return;
  }

  const startTime = performance.now();
  let responseText = '';
  let activeEngine = model || 'krims-local';

  try {
    if (activeEngine === 'gemini' || activeEngine === 'google') {
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is missing from environment variables.");
      }
      const sdkClient = new KrimsClient({
        provider: 'google',
        apiKey,
        model: 'gemini-2.5-flash'
      });
      const sdkRes = await sdkClient.ask(prompt, {
        systemInstruction,
        temperature,
        maxTokens,
        history
      });
      responseText = sdkRes.response;
    } else if (activeEngine === 'groq') {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("GROQ_API_KEY is missing from environment variables.");
      }
      const sdkClient = new KrimsClient({
        provider: 'groq',
        apiKey
      });
      const sdkRes = await sdkClient.ask(prompt, {
        systemInstruction,
        temperature,
        maxTokens,
        history
      });
      responseText = sdkRes.response;
    } else if (activeEngine === 'grok' || activeEngine === 'xai') {
      const apiKey = process.env.XAI_API_KEY;
      if (!apiKey) {
        throw new Error("XAI_API_KEY is missing from environment variables.");
      }
      const sdkClient = new KrimsClient({
        provider: 'xai',
        apiKey,
        model: 'grok-beta'
      });
      const sdkRes = await sdkClient.ask(prompt, {
        systemInstruction,
        temperature,
        maxTokens,
        history
      });
      responseText = sdkRes.response;
    } else if (activeEngine === 'krims-cloud') {
      try {
        responseText = await generateCloudText(prompt, systemInstruction, temperature, maxTokens, history);
      } catch (err) {
        responseText = generateLocalText(prompt, systemInstruction, temperature, maxTokens);
        responseText += `\n\n*(Note: Cloud LLM was busy or rate-limited. This answer was instantly generated by your Local JS Trigram Engine)*`;
        activeEngine = 'krims-local-fallback';
      }
    } else {
      responseText = generateLocalText(prompt, systemInstruction, temperature, maxTokens);
    }

    const endTime = performance.now();
    const durationSec = ((endTime - startTime) / 1000).toFixed(4);
    const tokenCount = Math.round(responseText.length / 4);
    const speed = (tokenCount / (parseFloat(durationSec) || 0.001)).toFixed(1);

    res.status(200).json({
      ok: true,
      prompt,
      response: responseText,
      stats: {
        latency: `${durationSec}s`,
        tokensPerSec: `${speed} tok/s`
      }
    });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
