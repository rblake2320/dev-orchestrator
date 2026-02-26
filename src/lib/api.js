import { PROVIDER_CONFIGS, getSettings } from './settings.js';
import { MODEL_OPTIONS } from './models.js';

/**
 * Get request URL and headers for a given provider + API key.
 */
function getRequestConfig(provider, apiKey) {
  const config = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.anthropic;
  const headers = { 'Content-Type': 'application/json' };
  let url;

  if (provider === 'ollama') {
    url = config.proxyPath + '/api/chat';
    return { url, headers, format: 'ollama' };
  }

  // Gemini uses OpenAI-compat but at a non-standard path
  if (provider === 'gemini') {
    if (apiKey) {
      url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      url = config.proxyPath + '/chat/completions';
    }
    return { url, headers, format: 'openai' };
  }

  if (apiKey) {
    if (provider === 'anthropic') {
      url = config.baseUrl + '/v1/messages';
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    } else {
      url = config.baseUrl + '/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  } else {
    if (provider === 'anthropic') {
      url = config.proxyPath + '/v1/messages';
      headers['anthropic-version'] = '2023-06-01';
    } else {
      url = config.proxyPath + '/v1/chat/completions';
    }
  }

  return { url, headers, format: provider === 'anthropic' ? 'anthropic' : 'openai' };
}

/**
 * Build request body based on provider format.
 */
function buildBody(system, userMessage, model, format, stream = false) {
  if (format === 'ollama') {
    return {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
      stream,
    };
  }
  if (format === 'anthropic') {
    return {
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: userMessage }],
      ...(stream ? { stream: true } : {}),
    };
  }
  // OpenAI-compatible
  return {
    model,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
    ...(stream ? { stream: true } : {}),
  };
}

/**
 * Parse a streaming SSE response and call onChunk for each text delta.
 * Returns the full accumulated text.
 */
async function parseStreamResponse(res, format, onChunk) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // hold incomplete last line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Ollama: newline-delimited JSON
      if (format === 'ollama') {
        try {
          const data = JSON.parse(trimmed);
          const text = data.message?.content || '';
          if (text) { fullText += text; onChunk(text); }
        } catch { /* skip */ }
        continue;
      }

      // SSE line
      if (trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(trimmed.slice(6));
        let text = '';
        if (format === 'anthropic') {
          text = data.delta?.text || '';
        } else {
          text = data.choices?.[0]?.delta?.content || '';
        }
        if (text) { fullText += text; onChunk(text); }
      } catch { /* skip malformed chunk */ }
    }
  }

  return fullText;
}

/**
 * Parse non-streaming response.
 */
function parseResponse(data, format) {
  if (format === 'ollama') return data.message?.content || '';
  if (format === 'anthropic') return (data.content || []).map((b) => b.text || '').join('');
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Call a specific model by modelOptionId.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {string} modelOptionId  e.g. 'claude-sonnet', 'llama-70b'
 * @param {AbortSignal} signal
 * @param {Function|null} onChunk  If provided, enables streaming — called with each text chunk
 * @returns {Promise<string>}  Full response text
 */
export async function callModel(systemPrompt, userMessage, modelOptionId, signal, onChunk = null) {
  const modelDef = MODEL_OPTIONS.find((m) => m.id === modelOptionId);
  if (!modelDef) throw new Error(`Unknown model: ${modelOptionId}`);

  const settings = getSettings();
  const apiKeyMap = {
    anthropic:   settings.anthropicKey   || '',
    openai:      settings.openaiKey      || '',
    groq:        settings.groqKey        || '',
    gemini:      settings.geminiKey      || '',
    openrouter:  settings.openrouterKey  || '',
    deepseek:    settings.deepseekKey    || '',
    ollama:      '',
  };

  const { url, headers, format } = getRequestConfig(modelDef.provider, apiKeyMap[modelDef.provider]);

  // Streaming — enabled when onChunk provided and provider isn't Ollama in non-stream mode
  const useStream = !!onChunk;
  const body = buildBody(systemPrompt, userMessage, modelDef.model, format, useStream);

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`${modelDef.label} API ${res.status}: ${errText.slice(0, 300) || res.statusText}`);
  }

  if (useStream) {
    return parseStreamResponse(res, format, onChunk);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'API error');
  return parseResponse(data, format);
}

/**
 * Discover locally running Ollama models.
 * Returns array of { id, label, model, provider, tier, badge, color }
 */
export async function discoverOllamaModels() {
  try {
    const res = await fetch('/api/proxy/ollama/api/tags', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m) => {
      const name = m.name.replace(':latest', '');
      return {
        id: `ollama-${name}`,
        label: `${name} (Local)`,
        model: m.name,
        provider: 'ollama',
        tier: 'local',
        badge: '🏠',
        color: '#f97316',
        dynamic: true,
      };
    });
  } catch {
    return [];
  }
}
