// ─── Provider Configs ────────────────────────────────────────────────────
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
};

const SETTINGS_KEY = 'devo_settings';
const PIPELINES_KEY = 'devo_pipelines';

// ─── Settings CRUD ──────────────────────────────────────────────────────
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

// ─── Saved Pipelines ────────────────────────────────────────────────────
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
