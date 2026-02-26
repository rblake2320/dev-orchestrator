import { useState } from 'react';
import { MODEL_OPTIONS } from '../lib/models';
import { getSettings } from '../lib/settings';
import { getRunHistory } from '../lib/runHistory';

const GITHUB_REPO = 'rblake2320/dev-orchestrator';

export default function BugReport({
  nodes,
  edges,
  projectDesc,
  executionLog,
  nodeStatuses,
  outputs,
  modelsUsed,
  onClose,
}) {
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);

  // ── Build the full report text ──────────────────────────────────────────────
  function buildReport() {
    const settings = getSettings();

    // Which providers have keys — never include the actual key values
    const configuredProviders = [...new Set(
      MODEL_OPTIONS
        .filter((m) => m.provider !== 'ollama' && (settings[`${m.provider}Key`] || '').trim().length > 0)
        .map((m) => m.provider)
    )];

    const failedNodes  = nodes.filter((n) => nodeStatuses[n.id] === 'error');
    const skippedNodes = nodes.filter((n) => nodeStatuses[n.id] === 'skipped');

    const topology = edges.map(([f, t]) => {
      const fn = nodes.find((n) => n.id === f);
      const tn = nodes.find((n) => n.id === t);
      return `  ${fn?.templateId || f} → ${tn?.templateId || t}`;
    }).join('\n');

    const logLines = executionLog.slice(-40).map((e) => `[${e.time}] ${e.msg}`).join('\n');

    const failureDetails = [...failedNodes, ...skippedNodes].map((n) => {
      const out = outputs[n.id] || '';
      const modelId = modelsUsed[n.id] || n.model || 'auto';
      return [
        `**${n.customLabel || n.templateId || n.id}** — status: ${nodeStatuses[n.id]} — model: ${modelId}`,
        out ? `\`\`\`\n${out.slice(0, 600)}\n\`\`\`` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    // Last 3 runs from history for pattern context
    const history = getRunHistory().slice(0, 3).map((r, i) =>
      `  Run ${i + 1} (${new Date(r.timestamp).toLocaleString()}): ` +
      `${r.successCount}/${r.totalNodes} success, ${r.failedCount} failed, ` +
      `${r.healCount} healed, ${Math.round((r.durationMs || 0) / 1000)}s`
    ).join('\n');

    return `## Dev Orchestrator — Bug Report

**Date:** ${new Date().toLocaleString()}
**Browser:** ${navigator.userAgent}
**Screen:** ${window.innerWidth}×${window.innerHeight}

---

### What went wrong
${description.trim() || '_(no description provided)_'}

---

### Pipeline Config
- **Nodes (${nodes.length}):** ${nodes.map((n) => n.customLabel || n.templateId || n.id).join(', ')}
- **Edges (${edges.length}):**
${topology || '  (none)'}
- **Project description:** ${(projectDesc || '').slice(0, 200) || '_(none)_'}
- **Configured providers:** ${configuredProviders.join(', ') || 'none'}
- **Models assigned:** ${Object.entries(modelsUsed).map(([k, v]) => `${k}=${v}`).join(', ') || 'auto'}

---

### Failures (${failedNodes.length} error, ${skippedNodes.length} skipped)
${failureDetails || '_(no failures)_'}

---

### Execution Log (last 40 entries)
\`\`\`
${logLines || '(empty)'}
\`\`\`

---

### Recent Run History
${history || '_(no previous runs)_'}
`;
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  function handleCopy() {
    navigator.clipboard.writeText(buildReport()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function handleGitHub() {
    const title = encodeURIComponent(
      `Bug: ${description.trim().slice(0, 80) || 'pipeline failure'}`
    );
    // GitHub URL limit ~8k — trim body
    const body = encodeURIComponent(buildReport().slice(0, 5000));
    window.open(
      `https://github.com/${GITHUB_REPO}/issues/new?title=${title}&body=${body}`,
      '_blank'
    );
  }

  // ── Summary counts for the preview card ─────────────────────────────────────
  const failedCount  = nodes.filter((n) => nodeStatuses[n.id] === 'error').length;
  const skippedCount = nodes.filter((n) => nodeStatuses[n.id] === 'skipped').length;
  const settings = getSettings();
  const providerCount = [...new Set(
    MODEL_OPTIONS
      .filter((m) => m.provider !== 'ollama' && (settings[`${m.provider}Key`] || '').trim().length > 0)
      .map((m) => m.provider)
  )].length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0d1117] border border-gray-800 rounded-xl shadow-2xl w-[560px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-100">🐛 Report a Bug</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Pipeline state &amp; logs captured automatically — no API keys included
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-600 hover:text-gray-300 text-xl leading-none transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Description */}
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block mb-2">
            What went wrong?
          </label>
          <textarea
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you expected vs. what actually happened…"
            rows={3}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 resize-none outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 mb-5 font-mono"
          />

          {/* Auto-captured summary */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 mb-5 space-y-1.5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-2">
              Auto-captured snapshot
            </p>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-400">
              <span>🗺️ Nodes</span>
              <span className="text-gray-300">{nodes.length} nodes, {edges.length} edges</span>
              <span>🔴 Failures</span>
              <span className="text-gray-300">{failedCount} error · {skippedCount} skipped</span>
              <span>📜 Log entries</span>
              <span className="text-gray-300">{executionLog.length}</span>
              <span>🔑 Configured APIs</span>
              <span className="text-gray-300">{providerCount} provider{providerCount !== 1 ? 's' : ''}</span>
              <span>🕐 History records</span>
              <span className="text-gray-300">{getRunHistory().length} runs saved</span>
              <span>🌐 Browser</span>
              <span className="text-gray-300 truncate">{navigator.userAgent.split(') ').at(-1) || 'unknown'}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleCopy}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg border transition-all ${
                copied
                  ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
                  : 'border-indigo-700/60 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-950/70'
              }`}
            >
              {copied ? '✓ Copied!' : '📋 Copy Report to Clipboard'}
            </button>
            <button
              onClick={handleGitHub}
              className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg border border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              🐙 Open GitHub Issue
            </button>
          </div>

          <p className="text-[10px] text-gray-700 text-center">
            Your API keys are never included in the report. Only pipeline structure, log messages, and error text.
          </p>
        </div>
      </div>
    </div>
  );
}
