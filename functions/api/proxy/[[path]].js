const PROVIDER_TARGETS = {
  anthropic: { base: 'https://api.anthropic.com',                              authType: 'anthropic' },
  openai:    { base: 'https://api.openai.com',                                 authType: 'bearer'    },
  groq:      { base: 'https://api.groq.com/openai',                            authType: 'bearer'    },
  ollama:    { base: 'http://localhost:11434',                                  authType: 'none'      },
};

const SERVER_KEYS = {
  anthropic: (env) => env.ANTHROPIC_API_KEY,
  openai:    (env) => env.OPENAI_API_KEY,
  groq:      (env) => env.GROQ_API_KEY,
};

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, x-api-key, Authorization, anthropic-version',
      },
    });
  }

  const [provider = 'anthropic', ...rest] = params.path || [];
  const target = PROVIDER_TARGETS[provider] || PROVIDER_TARGETS.anthropic;

  // For Ollama, use env-configured host or default
  const base = provider === 'ollama'
    ? (env.OLLAMA_HOST || target.base)
    : target.base;

  const url = new URL(request.url);
  const targetUrl = base + '/' + rest.join('/') + url.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('anthropic-dangerous-direct-browser-access');

  if (target.authType === 'anthropic') {
    if (!headers.has('x-api-key')) {
      const key = SERVER_KEYS[provider]?.(env);
      if (key) headers.set('x-api-key', key);
    }
    if (!headers.has('anthropic-version')) {
      headers.set('anthropic-version', '2023-06-01');
    }
  } else if (target.authType === 'bearer') {
    if (!headers.has('Authorization')) {
      const key = SERVER_KEYS[provider]?.(env);
      if (key) headers.set('Authorization', `Bearer ${key}`);
    }
  }

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
  });

  const respHeaders = new Headers(upstream.headers);
  respHeaders.set('Access-Control-Allow-Origin', '*');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}
