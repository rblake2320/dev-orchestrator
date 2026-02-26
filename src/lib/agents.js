// ─── Agent Protocol Definitions ───────────────────────────────────────────────

export const AGENT_PROTOCOLS = {
  http_simple: {
    label: 'HTTP Agent',
    desc: 'POST {task, context} → {result} — works with any custom agent, CrewAI wrapper, etc.',
    icon: '🔌',
    color: '#3b82f6',
    fields: ['endpoint', 'bearerToken'],
  },
  openai_assistant: {
    label: 'OpenAI Assistant',
    desc: 'Assistants API — create thread, run, poll for result.',
    icon: '⬡',
    color: '#10b981',
    fields: ['apiKey', 'assistantId'],
  },
  openclaw_gateway: {
    label: 'OpenClaw Gateway',
    desc: 'Native WebSocket connection to OpenClaw Gateway (ws://host:18789).',
    icon: '🦞',
    color: '#ef4444',
    fields: ['wsEndpoint', 'bearerToken'],
  },
  websocket_agent: {
    label: 'WebSocket Agent',
    desc: 'Generic WS agent — send JSON task, receive JSON result.',
    icon: '🔗',
    color: '#8b5cf6',
    fields: ['wsEndpoint', 'bearerToken'],
  },
};

export const AGENT_CAPABILITIES = ['code', 'review', 'research', 'testing', 'deployment', 'analysis'];

/**
 * Create a default agent config object with sensible defaults.
 */
export function createAgentConfig(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    label: 'New Agent',
    protocol: 'http_simple',
    endpoint: '',
    wsEndpoint: '',
    bearerToken: '',
    apiKey: '',
    assistantId: '',
    capabilities: [],
    timeoutMs: 120000,
    trusted: true,
    ...overrides,
  };
}
