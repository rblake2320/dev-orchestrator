// ─── AI Provider Configs ─────────────────────────────────────────────────────
export const PROVIDER_CONFIGS = {
  anthropic: {
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    proxyPath: '/api/proxy/anthropic',
    defaultModel: 'claude-sonnet-4-5-20250929',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    proxyPath: '/api/proxy/openai',
    defaultModel: 'gpt-4o',
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai',
    proxyPath: '/api/proxy/groq',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  ollama: {
    label: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    proxyPath: '/api/proxy/ollama',
    defaultModel: 'llama3.1',
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    proxyPath: '/api/proxy/gemini',
    defaultModel: 'gemini-2.0-flash',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api',
    proxyPath: '/api/proxy/openrouter',
    defaultModel: 'anthropic/claude-sonnet-4-5',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    proxyPath: '/api/proxy/deepseek',
    defaultModel: 'deepseek-chat',
  },
};

// ─── Search Provider Configs ──────────────────────────────────────────────────
export const SEARCH_PROVIDER_CONFIGS = {
  tavily: {
    label: 'Tavily',
    proxyPath: '/api/proxy/tavily',
    baseUrl: 'https://api.tavily.com',
    placeholder: 'tvly-…',
    docsUrl: 'app.tavily.com',
    icon: '🔍',
    color: '#0f766e',
    desc: 'Best for AI agents — 1k free/mo',
  },
  brave: {
    label: 'Brave Search',
    proxyPath: '/api/proxy/brave',
    baseUrl: 'https://api.search.brave.com',
    placeholder: 'BSAv…',
    docsUrl: 'api.search.brave.com',
    icon: '🦁',
    color: '#fb923c',
    desc: '2k free queries/mo',
  },
  serper: {
    label: 'Serper',
    proxyPath: '/api/proxy/serper',
    baseUrl: 'https://google.serper.dev',
    placeholder: 'xxxxxxxx-…',
    docsUrl: 'serper.dev',
    icon: '🔎',
    color: '#4f46e5',
    desc: 'Google results — 2.5k free',
  },
  exa: {
    label: 'Exa',
    proxyPath: '/api/proxy/exa',
    baseUrl: 'https://api.exa.ai',
    placeholder: 'exa-…',
    docsUrl: 'exa.ai',
    icon: '✦',
    color: '#7c3aed',
    desc: 'Neural search — 1k free/mo',
  },
};

const SETTINGS_KEY = 'devo_settings';
const PIPELINES_KEY = 'devo_pipelines';
const STATE_KEY = 'devo_state';

// ─── Settings CRUD ────────────────────────────────────────────────────────────
export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Pipeline State Persistence ───────────────────────────────────────────────
export function loadPipelineState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function savePipelineState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch { /* storage full */ }
}

export function clearPipelineState() {
  localStorage.removeItem(STATE_KEY);
}

// ─── Saved Pipelines ──────────────────────────────────────────────────────────
export function getSavedPipelines() {
  try {
    return JSON.parse(localStorage.getItem(PIPELINES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function savePipeline(pipeline) {
  const existing = getSavedPipelines();
  const idx = existing.findIndex((p) => p.id === pipeline.id);
  if (idx >= 0) {
    existing[idx] = pipeline;
  } else {
    existing.unshift(pipeline);
  }
  localStorage.setItem(PIPELINES_KEY, JSON.stringify(existing.slice(0, 50)));
}

export function deleteSavedPipeline(id) {
  const existing = getSavedPipelines().filter((p) => p.id !== id);
  localStorage.setItem(PIPELINES_KEY, JSON.stringify(existing));
}

// ─── Agent Config Persistence ─────────────────────────────────────────────────
const AGENTS_KEY = 'devo_agents';

export function getAgentConfigs() {
  try { return JSON.parse(localStorage.getItem(AGENTS_KEY) || '[]'); }
  catch { return []; }
}

export function saveAgentConfigs(agents) {
  localStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
}

export function getAgentById(id) {
  return getAgentConfigs().find((a) => a.id === id) || null;
}

// ─── Discovered Ollama Models ─────────────────────────────────────────────────
const OLLAMA_MODELS_KEY = 'devo_ollama_models';

export function getStoredOllamaModels() {
  try { return JSON.parse(localStorage.getItem(OLLAMA_MODELS_KEY) || '[]'); }
  catch { return []; }
}

export function saveStoredOllamaModels(models) {
  localStorage.setItem(OLLAMA_MODELS_KEY, JSON.stringify(models));
}
