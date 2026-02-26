import { useState, useCallback } from 'react';
import { PROVIDER_CONFIGS, getSettings, saveSettings } from '../lib/settings';

// ─── Provider definitions for the Settings UI ───────────────────────────
const PROVIDERS = [
  {
    key: 'anthropic',
    label: 'Anthropic',
    icon: '◆',
    color: '#d97706',
    settingKey: 'anthropicKey',
    placeholder: 'sk-ant-api03-…',
    docsUrl: 'console.anthropic.com',
    testModel: 'claude-haiku-4-5-20251001',
    testFormat: 'anthropic',
  },
  {
    key: 'openai',
    label: 'OpenAI',
    icon: '⬡',
    color: '#10b981',
    settingKey: 'openaiKey',
    placeholder: 'sk-proj-…',
    docsUrl: 'platform.openai.com',
    testModel: 'gpt-4o-mini',
    testFormat: 'openai',
  },
  {
    key: 'groq',
    label: 'Groq',
    icon: '⚡',
    color: '#8b5cf6',
    settingKey: 'groqKey',
    placeholder: 'gsk_…',
    docsUrl: 'console.groq.com',
    testModel: 'llama-3.1-8b-instant',
    testFormat: 'openai',
  },
  {
    key: 'gemini',
    label: 'Google Gemini',
    icon: '✦',
    color: '#4285f4',
    settingKey: 'geminiKey',
    placeholder: 'AIza…',
    docsUrl: 'aistudio.google.com',
    testModel: 'gemini-2.0-flash',
    testFormat: 'gemini',
  },
  {
    key: 'openrouter',
    label: 'OpenRouter',
    icon: '🔀',
    color: '#7c3aed',
    settingKey: 'openrouterKey',
    placeholder: 'sk-or-v1-…',
    docsUrl: 'openrouter.ai/keys',
    testModel: 'openai/gpt-4o-mini',
    testFormat: 'openai',
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    icon: '🤖',
    color: '#0891b2',
    settingKey: 'deepseekKey',
    placeholder: 'sk-…',
    docsUrl: 'platform.deepseek.com',
    testModel: 'deepseek-chat',
    testFormat: 'openai',
  },
];

// ─── Test a single provider ─────────────────────────────────────────────
async function testProvider(providerDef, apiKey) {
  const config = PROVIDER_CONFIGS[providerDef.key];
  const signal = AbortSignal.timeout(15000);

  if (!apiKey) throw new Error('No API key entered');

  if (providerDef.testFormat === 'anthropic') {
    const res = await fetch(config.baseUrl + '/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: providerDef.testModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say OK' }],
      }),
      signal,
    });
    if (res.status === 401 || res.status === 403) throw new Error('Invalid API key');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    return true;
  }

  if (providerDef.testFormat === 'gemini') {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: providerDef.testModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say OK' }],
        }),
        signal,
      }
    );
    if (res.status === 401 || res.status === 403) throw new Error('Invalid API key');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    return true;
  }

  // OpenAI-compatible (openai, groq, openrouter, deepseek)
  const res = await fetch(config.baseUrl + '/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: providerDef.testModel,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say OK' }],
    }),
    signal,
  });
  if (res.status === 401 || res.status === 403) throw new Error('Invalid API key');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  return true;
}

// ─── Settings Modal ─────────────────────────────────────────────────────
export default function Settings({ onClose }) {
  const [keys, setKeys] = useState(() => {
    const s = getSettings();
    return {
      anthropicKey: s.anthropicKey || '',
      openaiKey: s.openaiKey || '',
      groqKey: s.groqKey || '',
      geminiKey: s.geminiKey || '',
      openrouterKey: s.openrouterKey || '',
      deepseekKey: s.deepseekKey || '',
    };
  });
  const [statuses, setStatuses] = useState({}); // 'testing' | 'ok' | 'error' | null
  const [statusMsgs, setStatusMsgs] = useState({});

  const updateKey = useCallback((settingKey, value) => {
    setKeys((prev) => {
      const next = { ...prev, [settingKey]: value };
      saveSettings({ ...getSettings(), [settingKey]: value });
      return next;
    });
    // Reset status badge when the key changes
    const p = PROVIDERS.find((p) => p.settingKey === settingKey);
    if (p) setStatuses((prev) => ({ ...prev, [p.key]: null }));
  }, []);

  const testOne = useCallback(
    async (providerDef) => {
      const apiKey = keys[providerDef.settingKey];
      setStatuses((prev) => ({ ...prev, [providerDef.key]: 'testing' }));
      setStatusMsgs((prev) => ({ ...prev, [providerDef.key]: '' }));
      try {
        await testProvider(providerDef, apiKey);
        setStatuses((prev) => ({ ...prev, [providerDef.key]: 'ok' }));
      } catch (err) {
        setStatuses((prev) => ({ ...prev, [providerDef.key]: 'error' }));
        setStatusMsgs((prev) => ({ ...prev, [providerDef.key]: err.message }));
      }
    },
    [keys]
  );

  const testAll = useCallback(async () => {
    const withKeys = PROVIDERS.filter((p) => keys[p.settingKey]);
    await Promise.all(withKeys.map((p) => testOne(p)));
  }, [keys, testOne]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-50">⚙️ Settings</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              API keys are saved to your browser's localStorage — never sent to any third-party server.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        {/* Provider cards */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROVIDERS.map((p) => {
            const status = statuses[p.key];
            const key = keys[p.settingKey];
            return (
              <div
                key={p.key}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden transition-all"
                style={{ borderColor: status === 'ok' ? '#059669' : status === 'error' ? '#dc2626' : '' }}
              >
                {/* Card header */}
                <div
                  className="px-4 py-3 border-b border-gray-800 flex items-center gap-2"
                  style={{ background: `${p.color}0d` }}
                >
                  <span className="text-base" style={{ color: p.color }}>
                    {p.icon}
                  </span>
                  <span className="text-sm font-semibold text-gray-100">{p.label}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {status === 'ok' && (
                      <span className="text-[11px] text-emerald-400 font-semibold">✓ Connected</span>
                    )}
                    {status === 'error' && (
                      <span className="text-[11px] text-red-400 font-semibold">✗ Failed</span>
                    )}
                    {status === 'testing' && (
                      <span className="text-[11px] text-indigo-400 animate-pulse">Testing…</span>
                    )}
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={key}
                      onChange={(e) => updateKey(p.settingKey, e.target.value)}
                      placeholder={p.placeholder}
                      className="flex-1 min-w-0 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
                    />
                    <button
                      onClick={() => testOne(p)}
                      disabled={status === 'testing' || !key}
                      className="flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background:
                          status === 'ok'
                            ? '#064e3b33'
                            : status === 'error'
                              ? '#7f1d1d33'
                              : `${p.color}15`,
                        borderColor:
                          status === 'ok'
                            ? '#059669'
                            : status === 'error'
                              ? '#ef4444'
                              : `${p.color}44`,
                        color:
                          status === 'ok'
                            ? '#34d399'
                            : status === 'error'
                              ? '#f87171'
                              : p.color,
                      }}
                    >
                      {status === 'testing' ? '…' : 'Test'}
                    </button>
                  </div>
                  {status === 'error' && statusMsgs[p.key] && (
                    <p
                      className="text-[10px] text-red-400 font-mono leading-snug"
                      title={statusMsgs[p.key]}
                    >
                      {statusMsgs[p.key].slice(0, 120)}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-600">{p.docsUrl}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between gap-4">
          <p className="text-[11px] text-gray-600">
            Keys take effect immediately. Leave empty to use the Vite proxy (env vars).
          </p>
          <button
            onClick={testAll}
            className="flex-shrink-0 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Test All
          </button>
        </div>
      </div>
    </div>
  );
}
