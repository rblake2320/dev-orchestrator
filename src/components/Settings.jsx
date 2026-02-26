import { useState, useCallback, useEffect } from 'react';
import { PROVIDER_CONFIGS, SEARCH_PROVIDER_CONFIGS, getSettings, saveSettings } from '../lib/settings';
import { discoverOllamaModels } from '../lib/api';

// ─── AI Provider definitions ─────────────────────────────────────────────────
const AI_PROVIDERS = [
  { key: 'anthropic',   label: 'Anthropic',      icon: '◆',  color: '#d97706', settingKey: 'anthropicKey',  placeholder: 'sk-ant-api03-…',  docsUrl: 'console.anthropic.com', testModel: 'claude-haiku-4-5-20251001', testFormat: 'anthropic' },
  { key: 'openai',      label: 'OpenAI',          icon: '⬡',  color: '#10b981', settingKey: 'openaiKey',     placeholder: 'sk-proj-…',        docsUrl: 'platform.openai.com',   testModel: 'gpt-4o-mini',              testFormat: 'openai'    },
  { key: 'groq',        label: 'Groq',            icon: '⚡',  color: '#8b5cf6', settingKey: 'groqKey',       placeholder: 'gsk_…',            docsUrl: 'console.groq.com',      testModel: 'llama-3.1-8b-instant',     testFormat: 'openai'    },
  { key: 'gemini',      label: 'Google Gemini',   icon: '✦',  color: '#4285f4', settingKey: 'geminiKey',     placeholder: 'AIza…',            docsUrl: 'aistudio.google.com',   testModel: 'gemini-2.0-flash',         testFormat: 'gemini'    },
  { key: 'openrouter',  label: 'OpenRouter',      icon: '🔀', color: '#7c3aed', settingKey: 'openrouterKey', placeholder: 'sk-or-v1-…',       docsUrl: 'openrouter.ai/keys',    testModel: 'openai/gpt-4o-mini',       testFormat: 'openai'    },
  { key: 'deepseek',    label: 'DeepSeek',        icon: '🤖', color: '#0891b2', settingKey: 'deepseekKey',   placeholder: 'sk-…',             docsUrl: 'platform.deepseek.com', testModel: 'deepseek-chat',            testFormat: 'openai'    },
];

// ─── Search Provider definitions ─────────────────────────────────────────────
const SEARCH_PROVIDERS = Object.entries(SEARCH_PROVIDER_CONFIGS).map(([key, cfg]) => ({
  key,
  ...cfg,
  settingKey: key === 'brave' ? 'braveSearchKey' : `${key}Key`,
}));

// ─── Test a single AI provider ────────────────────────────────────────────────
async function testAIProvider(providerDef, apiKey) {
  const config = PROVIDER_CONFIGS[providerDef.key];
  const signal = AbortSignal.timeout(15000);
  if (!apiKey) throw new Error('No API key entered');

  if (providerDef.testFormat === 'anthropic') {
    const res = await fetch(config.baseUrl + '/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: providerDef.testModel, max_tokens: 10, messages: [{ role: 'user', content: 'Say OK' }] }),
      signal,
    });
    if (res.status === 401 || res.status === 403) throw new Error('Invalid API key');
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
    return true;
  }

  if (providerDef.testFormat === 'gemini') {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: providerDef.testModel, max_tokens: 10, messages: [{ role: 'user', content: 'Say OK' }] }),
      signal,
    });
    if (res.status === 401 || res.status === 403) throw new Error('Invalid API key');
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
    return true;
  }

  const res = await fetch(config.baseUrl + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: providerDef.testModel, max_tokens: 10, messages: [{ role: 'user', content: 'Say OK' }] }),
    signal,
  });
  if (res.status === 401 || res.status === 403) throw new Error('Invalid API key');
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  return true;
}

// ─── Test a search provider ───────────────────────────────────────────────────
async function testSearchProvider(providerKey, apiKey) {
  if (!apiKey) throw new Error('No API key entered');
  const cfg = SEARCH_PROVIDER_CONFIGS[providerKey];
  const signal = AbortSignal.timeout(10000);

  if (providerKey === 'tavily') {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query: 'test', max_results: 1 }),
      signal,
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.detail || e?.message || `HTTP ${res.status}`); }
    return true;
  }
  if (providerKey === 'brave') {
    const res = await fetch('https://api.search.brave.com/res/v1/web/search?q=test&count=1', {
      headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  }
  if (providerKey === 'serper') {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ q: 'test', num: 1 }),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  }
  if (providerKey === 'exa') {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ query: 'test', numResults: 1 }),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  }
  throw new Error('Unknown search provider');
}

// ─── Reusable provider card ───────────────────────────────────────────────────
function ProviderCard({ p, value, onChange, onTest, status, statusMsg }) {
  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden transition-all"
      style={{ borderColor: status === 'ok' ? '#059669' : status === 'error' ? '#dc2626' : '' }}
    >
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2" style={{ background: `${p.color}0d` }}>
        <span className="text-base" style={{ color: p.color }}>{p.icon}</span>
        <span className="text-sm font-semibold text-gray-100">{p.label}</span>
        <div className="ml-auto flex items-center gap-2">
          {status === 'ok'      && <span className="text-[11px] text-emerald-400 font-semibold">✓ Connected</span>}
          {status === 'error'   && <span className="text-[11px] text-red-400 font-semibold">✗ Failed</span>}
          {status === 'testing' && <span className="text-[11px] text-indigo-400 animate-pulse">Testing…</span>}
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={p.placeholder}
            className="flex-1 min-w-0 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
          />
          <button
            onClick={onTest}
            disabled={status === 'testing' || !value}
            className="flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: status === 'ok' ? '#064e3b33' : status === 'error' ? '#7f1d1d33' : `${p.color}15`,
              borderColor: status === 'ok' ? '#059669' : status === 'error' ? '#ef4444' : `${p.color}44`,
              color: status === 'ok' ? '#34d399' : status === 'error' ? '#f87171' : p.color,
            }}
          >
            {status === 'testing' ? '…' : 'Test'}
          </button>
        </div>
        {status === 'error' && statusMsg && (
          <p className="text-[10px] text-red-400 font-mono leading-snug" title={statusMsg}>{statusMsg.slice(0, 120)}</p>
        )}
        <p className="text-[10px] text-gray-600">{p.docsUrl || p.desc}</p>
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
export default function Settings({ onClose }) {
  const [keys, setKeys] = useState(() => {
    const s = getSettings();
    return {
      anthropicKey:  s.anthropicKey  || '',
      openaiKey:     s.openaiKey     || '',
      groqKey:       s.groqKey       || '',
      geminiKey:     s.geminiKey     || '',
      openrouterKey: s.openrouterKey || '',
      deepseekKey:   s.deepseekKey   || '',
      // Search
      tavilyKey:     s.tavilyKey     || '',
      braveSearchKey: s.braveSearchKey || '',
      serperKey:     s.serperKey     || '',
      exaKey:        s.exaKey        || '',
    };
  });
  const [statuses, setStatuses] = useState({});
  const [statusMsgs, setStatusMsgs] = useState({});
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ai');

  const updateKey = useCallback((settingKey, value) => {
    setKeys((prev) => {
      const next = { ...prev, [settingKey]: value };
      saveSettings({ ...getSettings(), [settingKey]: value });
      return next;
    });
    const pKey = settingKey.replace('Key', '').replace('Search', 'Search');
    setStatuses((prev) => ({ ...prev, [pKey]: null }));
  }, []);

  const testAI = useCallback(async (p) => {
    setStatuses((prev) => ({ ...prev, [p.key]: 'testing' }));
    setStatusMsgs((prev) => ({ ...prev, [p.key]: '' }));
    try {
      await testAIProvider(p, keys[p.settingKey]);
      setStatuses((prev) => ({ ...prev, [p.key]: 'ok' }));
    } catch (err) {
      setStatuses((prev) => ({ ...prev, [p.key]: 'error' }));
      setStatusMsgs((prev) => ({ ...prev, [p.key]: err.message }));
    }
  }, [keys]);

  const testSearch = useCallback(async (p) => {
    setStatuses((prev) => ({ ...prev, [`search_${p.key}`]: 'testing' }));
    setStatusMsgs((prev) => ({ ...prev, [`search_${p.key}`]: '' }));
    try {
      await testSearchProvider(p.key, keys[p.settingKey]);
      setStatuses((prev) => ({ ...prev, [`search_${p.key}`]: 'ok' }));
    } catch (err) {
      setStatuses((prev) => ({ ...prev, [`search_${p.key}`]: 'error' }));
      setStatusMsgs((prev) => ({ ...prev, [`search_${p.key}`]: err.message }));
    }
  }, [keys]);

  const testAll = useCallback(async () => {
    if (activeTab === 'ai') {
      await Promise.all(AI_PROVIDERS.filter((p) => keys[p.settingKey]).map(testAI));
    } else {
      await Promise.all(SEARCH_PROVIDERS.filter((p) => keys[p.settingKey]).map(testSearch));
    }
  }, [keys, activeTab, testAI, testSearch]);

  const discoverOllama = useCallback(async () => {
    setOllamaLoading(true);
    const models = await discoverOllamaModels();
    setOllamaModels(models);
    setOllamaLoading(false);
  }, []);

  useEffect(() => { discoverOllama(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-50">⚙️ Settings</h2>
            <p className="text-xs text-gray-500 mt-0.5">API keys saved to localStorage — never sent to any third-party server.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800">✕</button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-800 px-6">
          {[
            { id: 'ai',     label: '🤖 AI Models'  },
            { id: 'search', label: '🔍 Web Search'  },
            { id: 'ollama', label: '🏠 Local Models' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === t.id ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* AI Models tab */}
        {activeTab === 'ai' && (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AI_PROVIDERS.map((p) => (
              <ProviderCard
                key={p.key}
                p={p}
                value={keys[p.settingKey]}
                onChange={(v) => updateKey(p.settingKey, v)}
                onTest={() => testAI(p)}
                status={statuses[p.key]}
                statusMsg={statusMsgs[p.key]}
              />
            ))}
          </div>
        )}

        {/* Web Search tab */}
        {activeTab === 'search' && (
          <div className="p-6">
            <p className="text-xs text-gray-500 mb-4 p-3 bg-gray-900 rounded-lg border border-gray-800">
              🌐 Search keys power the <strong className="text-gray-300">Web Research</strong> and <strong className="text-gray-300">Fact Check</strong> nodes. Add at least one to enable internet connectivity. Priority order: Tavily → Brave → Serper → Exa.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SEARCH_PROVIDERS.map((p) => (
                <ProviderCard
                  key={p.key}
                  p={p}
                  value={keys[p.settingKey]}
                  onChange={(v) => updateKey(p.settingKey, v)}
                  onTest={() => testSearch(p)}
                  status={statuses[`search_${p.key}`]}
                  statusMsg={statusMsgs[`search_${p.key}`]}
                />
              ))}
            </div>
          </div>
        )}

        {/* Ollama / Local Models tab */}
        {activeTab === 'ollama' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-200">Local Ollama Models</p>
                <p className="text-xs text-gray-500 mt-0.5">Discovered from http://localhost:11434</p>
              </div>
              <button
                onClick={discoverOllama}
                disabled={ollamaLoading}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600/20 border border-orange-600/30 text-orange-300 hover:bg-orange-600/30 transition-colors disabled:opacity-50"
              >
                {ollamaLoading ? 'Scanning…' : '↺ Refresh'}
              </button>
            </div>
            {ollamaModels.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                <div className="text-3xl mb-2">🏠</div>
                <p className="text-sm">No local models found</p>
                <p className="text-xs mt-1">Make sure Ollama is running: <code className="font-mono text-gray-500">ollama serve</code></p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {ollamaModels.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl">
                    <span className="text-lg">🏠</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-100">{m.label}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{m.model}</p>
                    </div>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-900/30">✓ Available</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between gap-4">
          <p className="text-[11px] text-gray-600">Keys take effect immediately. Leave empty to use Vite proxy (env vars).</p>
          <button onClick={testAll} className="flex-shrink-0 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            Test All
          </button>
        </div>
      </div>
    </div>
  );
}
