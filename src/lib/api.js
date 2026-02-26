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
    // Local Ollama — no auth needed
    url = config.proxyPath + '/api/chat';
    return { url, headers, format: 'ollama' };
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
function buildBody(system, userMessage, model, format) {
  if (format === 'ollama') {
    return {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
      stream: false,
    };
  }
  if (format === 'anthropic') {
    return {
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: userMessage }],
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
  };
}

/**
 * Parse response text from provider-specific format.
 */
function parseResponse(data, format) {
  if (format === 'ollama') {
    return data.message?.content || '';
  }
  if (format === 'anthropic') {
    return (data.content || []).map((b) => b.text || '').join('');
  }
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Call a specific model by modelOptionId (e.g. 'claude-sonnet', 'ollama-llama').
 * This is the core function used by the pipeline engine — each node specifies its model.
 */
export async function callModel(systemPrompt, userMessage, modelOptionId, signal) {
  const modelDef = MODEL_OPTIONS.find((m) => m.id === modelOptionId);
  if (!modelDef) throw new Error(`Unknown model: ${modelOptionId}`);

  const settings = getSettings();
  const apiKeyMap = {
    anthropic: settings.anthropicKey || '',
    openai: settings.openaiKey || '',
    groq: settings.groqKey || '',
    ollama: '', // no key needed
  };

  const { url, headers, format } = getRequestConfig(modelDef.provider, apiKeyMap[modelDef.provider]);
  const body = buildBody(systemPrompt, userMessage, modelDef.model, format);

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

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'API error');

  return parseResponse(data, format);
}
