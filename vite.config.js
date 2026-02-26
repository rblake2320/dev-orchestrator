import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      proxy: {
        '/api/proxy/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/anthropic/, ''),
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
          },
        },
        '/api/proxy/openai': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/openai/, ''),
          ...(env.OPENAI_API_KEY && {
            headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
          }),
        },
        '/api/proxy/groq': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/groq/, '/openai'),
          ...(env.GROQ_API_KEY && {
            headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
          }),
        },
        '/api/proxy/ollama': {
          target: env.OLLAMA_HOST || 'http://localhost:11434',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/ollama/, ''),
        },
        '/api/proxy/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/gemini/, '/v1beta/openai'),
          ...(env.GEMINI_API_KEY && {
            headers: { Authorization: `Bearer ${env.GEMINI_API_KEY}` },
          }),
        },
        '/api/proxy/openrouter': {
          target: 'https://openrouter.ai',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/openrouter/, '/api'),
          ...(env.OPENROUTER_API_KEY && {
            headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
          }),
        },
        '/api/proxy/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/deepseek/, ''),
          ...(env.DEEPSEEK_API_KEY && {
            headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
          }),
        },
        // ── Search providers ────────────────────────────────────────────────
        '/api/proxy/brave': {
          target: 'https://api.search.brave.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/brave/, ''),
          ...(env.BRAVE_SEARCH_API_KEY && {
            headers: { 'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY },
          }),
        },
        '/api/proxy/serper': {
          target: 'https://google.serper.dev',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/serper/, ''),
          ...(env.SERPER_API_KEY && {
            headers: { 'X-API-KEY': env.SERPER_API_KEY },
          }),
        },
        '/api/proxy/tavily': {
          target: 'https://api.tavily.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/tavily/, ''),
        },
        '/api/proxy/exa': {
          target: 'https://api.exa.ai',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/exa/, ''),
        },
        // ── Agent bridge (OpenClaw HTTP bridge on port 9000) ────────────────
        '/api/proxy/agent-bridge': {
          target: 'http://localhost:9000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/proxy\/agent-bridge/, ''),
        },
      },
    },
  };
});
