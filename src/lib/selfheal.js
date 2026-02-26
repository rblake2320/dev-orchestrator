import { MODEL_OPTIONS } from './models.js';

/**
 * Classify an error message so the healing strategy knows what to do.
 *   'auth'         → API key missing/invalid — skip the whole provider
 *   'rate_limit'   → Too many requests — skip this provider temporarily
 *   'server_error' → 5xx — retry same or fallback
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
    msg.includes('permission')
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
 *   - auth error    → skip every model from the same provider (key likely absent for all)
 *   - other errors  → skip only the exact model that just failed
 *
 * @param {string} failedModelId  - the model ID that triggered the error
 * @param {string} errorType      - result of classifyError()
 * @returns {Array} ordered array of ModelOption objects
 */
export function getFallbackChain(failedModelId, errorType) {
  const failedModel = MODEL_OPTIONS.find((m) => m.id === failedModelId);
  const failedProvider = failedModel?.provider;

  return FALLBACK_PRIORITY
    .filter((id) => {
      if (id === failedModelId) return false;
      const m = MODEL_OPTIONS.find((opt) => opt.id === id);
      if (!m) return false;
      // Auth error: entire provider is likely broken — skip all of its models
      if (errorType === 'auth' && m.provider === failedProvider) return false;
      return true;
    })
    .map((id) => MODEL_OPTIONS.find((m) => m.id === id))
    .filter(Boolean);
}

/** Max fallback attempts per node before the node is permanently marked as error. */
export const MAX_HEAL_ATTEMPTS = 3;
