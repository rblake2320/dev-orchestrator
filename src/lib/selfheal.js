import { MODEL_OPTIONS } from './models.js';
import { getSettings, getStoredOllamaModels } from './settings.js';

/**
 * Classify an error message so the healing strategy knows what to do.
 *   'auth'         → API key missing/invalid — skip the whole provider
 *   'rate_limit'   → Too many requests — skip this provider temporarily
 *   'server_error' → 5xx — retry same or fallback
 *   'unavailable'  → Network/CORS/fetch failure
 *   'timeout'      → Request timed out
 *   'unknown'      → Any other failure — try fallbacks
 */
export function classifyError(message) {
  const msg = (message || '').toLowerCase();
  if (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('authentication') ||
    msg.includes('invalid api key') ||
    msg.includes('invalid_api_key') ||
    msg.includes('cors') ||
    msg.includes('unauthorized') ||
    msg.includes('permission') ||
    msg.includes('missing authorization') ||
    msg.includes('no api key') ||
    msg.includes('api key required')
  ) return 'auth';
  if (
    msg.includes('429') ||
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  ) return 'rate_limit';
  if (
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('service unavailable') ||
    msg.includes('server error')
  ) return 'server_error';
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('deadline')
  ) return 'timeout';
  if (
    msg.includes('econnrefused') ||
    msg.includes('network') ||
    msg.includes('unreachable') ||
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch')
  ) return 'unavailable';
  return 'unknown';
}

/**
 * Fallback model priority — free/local tiers first so healing succeeds
 * even without paid API keys configured.
 */
const FALLBACK_PRIORITY = [
  'llama-70b',         // Groq — fast, generous free tier
  'deepseek-chat',     // DeepSeek — very affordable
  'gemini-flash',      // Gemini — free tier available
  'gpt-4o-mini',       // OpenAI — cheapest GPT
  'ollama-gemma',      // Local — always free if Ollama running
  'ollama-llama',      // Local
  'ollama-mistral',    // Local
  'gpt-4o',            // OpenAI
  'gemini-pro',        // Gemini
  'deepseek-r1',       // DeepSeek reasoning
  'openrouter-claude', // OpenRouter
  'claude-sonnet',     // Anthropic
  'claude-opus',       // Anthropic
];

/**
 * Returns an ordered list of fallback ModelOption objects to try when a node fails.
 *
 * Strategy:
 *   - Only includes models whose provider has an API key configured (or is Ollama/local)
 *   - auth error    → also skip every model from the same provider (key is definitely broken)
 *   - rate_limit    → skip only models from the same provider temporarily
 *   - other errors  → skip only the exact model that just failed
 *
 * @param {string} failedModelId  - the model ID that triggered the error
 * @param {string} errorType      - result of classifyError()
 * @returns {Array} ordered array of ModelOption objects
 */
export function getFallbackChain(failedModelId, errorType) {
  const settings = getSettings();

  // Merge static non-Ollama models with dynamically discovered Ollama models
  const storedOllama = getStoredOllamaModels();
  const effectiveModels = [
    ...MODEL_OPTIONS.filter((m) => m.provider !== 'ollama'),
    ...(storedOllama.length > 0 ? storedOllama : MODEL_OPTIONS.filter((m) => m.provider === 'ollama')),
  ];

  const failedModel = effectiveModels.find((m) => m.id === failedModelId)
    || MODEL_OPTIONS.find((m) => m.id === failedModelId);
  const failedProvider = failedModel?.provider;

  // Only try providers that actually have keys configured
  function isConfigured(provider) {
    if (provider === 'ollama') return true; // local, no key needed
    const key = settings[`${provider}Key`] || '';
    return key.trim().length > 0;
  }

  // Static priority list + any dynamic Ollama models appended
  const dynamicOllamaIds = storedOllama.map((m) => m.id);
  const extendedPriority = [
    ...FALLBACK_PRIORITY.filter((id) => !id.startsWith('ollama-')),
    ...dynamicOllamaIds,
    ...FALLBACK_PRIORITY.filter((id) => id.startsWith('ollama-')),
  ];

  return extendedPriority
    .filter((id) => {
      if (id === failedModelId) return false;
      const m = effectiveModels.find((opt) => opt.id === id);
      if (!m) return false;
      // Skip any model whose provider has no configured API key
      if (!isConfigured(m.provider)) return false;
      // Auth/rate_limit on a provider: skip ALL models from that provider
      if ((errorType === 'auth' || errorType === 'rate_limit') && m.provider === failedProvider) return false;
      return true;
    })
    .map((id) => effectiveModels.find((m) => m.id === id))
    .filter(Boolean);
}

/** Max fallback attempts per node before the node is permanently marked as error. */
export const MAX_HEAL_ATTEMPTS = 3;
