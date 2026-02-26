import { getSettings, SEARCH_PROVIDER_CONFIGS } from './settings.js';

/**
 * Format search results into a readable context block for injection into prompts.
 */
export function formatSearchResults(results, query) {
  if (!results || results.length === 0) return '';
  const lines = [`[Web Search Results for: "${query}"]`, ''];
  results.forEach((r, i) => {
    lines.push(`${i + 1}. **${r.title}**`);
    lines.push(`   URL: ${r.url}`);
    lines.push(`   ${r.snippet}`);
    lines.push('');
  });
  return lines.join('\n');
}

/**
 * Search using Tavily — best for AI agents, returns rich snippets.
 */
async function searchTavily(query, apiKey, signal) {
  const url = apiKey
    ? 'https://api.tavily.com/search'
    : `${SEARCH_PROVIDER_CONFIGS.tavily.proxyPath}/search`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? {} : {}),
    },
    body: JSON.stringify({
      api_key: apiKey || undefined,
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: true,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content?.slice(0, 300) || '',
  }));
}

/**
 * Search using Brave Search API.
 */
async function searchBrave(query, apiKey, signal) {
  const base = apiKey
    ? 'https://api.search.brave.com'
    : SEARCH_PROVIDER_CONFIGS.brave.proxyPath;

  const res = await fetch(
    `${base}/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        ...(apiKey ? { 'X-Subscription-Token': apiKey } : {}),
      },
      signal,
    }
  );
  if (!res.ok) throw new Error(`Brave ${res.status}`);
  const data = await res.json();
  return (data.web?.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description || '',
  }));
}

/**
 * Search using Serper (Google results via API).
 */
async function searchSerper(query, apiKey, signal) {
  const url = apiKey
    ? 'https://google.serper.dev/search'
    : `${SEARCH_PROVIDER_CONFIGS.serper.proxyPath}/search`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-KEY': apiKey } : {}),
    },
    body: JSON.stringify({ q: query, num: 5 }),
    signal,
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  const data = await res.json();
  return (data.organic || []).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet || '',
  }));
}

/**
 * Search using Exa (neural/semantic search).
 */
async function searchExa(query, apiKey, signal) {
  const url = apiKey
    ? 'https://api.exa.ai/search'
    : `${SEARCH_PROVIDER_CONFIGS.exa.proxyPath}/search`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: JSON.stringify({
      query,
      numResults: 5,
      contents: { text: { maxCharacters: 400 } },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Exa ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: r.title || r.url,
    url: r.url,
    snippet: r.text?.slice(0, 300) || '',
  }));
}

/**
 * Search the web using whichever provider the user has a key for.
 * Falls back down the list: Tavily → Brave → Serper → Exa.
 * Returns { results: [{title, url, snippet}], provider } or { results: [], error }.
 */
export async function searchWeb(query, signal) {
  const settings = getSettings();

  const providers = [
    { id: 'tavily',  key: settings.tavilyKey,       fn: searchTavily  },
    { id: 'brave',   key: settings.braveSearchKey,  fn: searchBrave   },
    { id: 'serper',  key: settings.serperKey,        fn: searchSerper  },
    { id: 'exa',     key: settings.exaKey,           fn: searchExa     },
  ].filter((p) => p.key);

  if (providers.length === 0) {
    return { results: [], error: 'No search API key configured. Add one in ⚙️ Settings → Search.' };
  }

  for (const { id, key, fn } of providers) {
    try {
      const results = await fn(query, key, signal);
      return { results, provider: id };
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      // Try next provider
    }
  }

  return { results: [], error: 'All search providers failed' };
}

/**
 * Check whether any search provider is configured.
 */
export function hasSearchProvider() {
  const s = getSettings();
  return !!(s.tavilyKey || s.braveSearchKey || s.serperKey || s.exaKey);
}
