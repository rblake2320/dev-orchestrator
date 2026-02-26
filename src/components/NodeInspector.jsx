import { useState } from 'react';
import { NODE_TEMPLATES, MODEL_OPTIONS } from '../lib/models';
import { AGENT_PROTOCOLS } from '../lib/agents';

export default function NodeInspector({
  node,
  nodes,
  edges,
  outputs,
  nodeStatuses,
  modelsUsed,
  agents,
  agentStatuses,
  onUpdateModel,
  onUpdateAgent,
  onToggleEdge,
  onRemoveNode,
  onUpdatePrompt,
  onUpdateLabel,
  onRetryNode,
  onClose,
  isRunning,
}) {
  const template = NODE_TEMPLATES.find((t) => t.id === (node.templateId || node.id));
  if (!template) return null;

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(node.customLabel || template.label);
  const driverMode = node.agentId ? 'agent' : 'model';

  const upstreamIds = edges.filter(([, to]) => to === node.id).map(([from]) => from);
  const status = nodeStatuses?.[node.id] || 'idle';
  const modelUsedId = modelsUsed?.[node.id];
  const modelUsed = modelUsedId ? MODEL_OPTIONS.find((m) => m.id === modelUsedId) : null;
  const assignedModel = node.model ? MODEL_OPTIONS.find((m) => m.id === node.model) : null;

  const statusBadge = {
    done:    { label: '✓ Done',    cls: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/40' },
    error:   { label: '✗ Error',   cls: 'text-red-400 bg-red-950/40 border-red-900/40' },
    running: { label: '● Running', cls: 'text-indigo-400 bg-indigo-950/40 border-indigo-900/40' },
    healing: { label: '🔄 Healing',cls: 'text-amber-400 bg-amber-950/40 border-amber-900/40' },
    waiting: { label: '○ Waiting', cls: 'text-yellow-600 bg-yellow-950/30 border-yellow-900/30' },
    skipped: { label: '⊘ Skipped', cls: 'text-gray-600 bg-gray-800/40 border-gray-700/40' },
    idle:    { label: '◌ Idle',    cls: 'text-gray-500 bg-gray-900/40 border-gray-800/40' },
  };

  const isCustom = (node.templateId || node.id) === 'custom';

  return (
    <div className="w-80 border-l border-gray-800 bg-[#0d1117] p-5 overflow-y-auto flex-shrink-0 animate-slide-in">
      {/* Close button — separate from Remove */}
      {onClose && (
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="text-gray-700 hover:text-gray-400 text-sm transition-colors"
            title="Close inspector (does not remove node)"
          >
            ✕ Close
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <div className="text-2xl mb-1">{template.icon}</div>
          {editingLabel ? (
            <input
              autoFocus
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={() => { onUpdateLabel(node.id, labelDraft); setEditingLabel(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateLabel(node.id, labelDraft); setEditingLabel(false); } if (e.key === 'Escape') setEditingLabel(false); }}
              className="w-full bg-gray-900 border border-indigo-500 rounded px-2 py-1 text-sm font-bold text-gray-100 outline-none"
            />
          ) : (
            <h3
              className="text-base font-bold text-gray-100 cursor-pointer hover:text-indigo-300 transition-colors"
              title="Click to rename"
              onClick={() => { setLabelDraft(node.customLabel || template.label); setEditingLabel(true); }}
            >
              {node.customLabel || template.label} ✎
            </h3>
          )}
          <p className="text-xs text-gray-500 mt-1">{template.desc}</p>
          {template.webSearch && (
            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-sky-900/30 border border-sky-800/30 text-sky-400 rounded">🌐 web-enabled</span>
          )}
        </div>
        <button
          onClick={() => {
            if (window.confirm(`Remove "${node.customLabel || template.label}"? This cannot be undone.`)) {
              onRemoveNode(node.id);
            }
          }}
          className="ml-2 flex-shrink-0 text-xs px-2.5 py-1 bg-red-950/30 border border-red-900/40 rounded-md text-red-300 hover:bg-red-950/50 transition-colors"
        >
          🗑 Remove
        </button>
      </div>

      {/* Status + model used */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {statusBadge[status] && (
          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusBadge[status].cls}`}>
            {statusBadge[status].label}
          </span>
        )}
        {modelUsed && (
          <span className="text-[10px] px-2 py-0.5 rounded border text-gray-400 bg-gray-900/40 border-gray-700/40" title="Model that generated this output">
            ran: {modelUsed.label}
          </span>
        )}
      </div>

      {/* Custom node guidance */}
      {isCustom && !node.customPrompt && (
        <div className="mb-4 p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/40">
          <p className="text-[11px] text-indigo-300 font-semibold mb-1">🛠️ Custom Step</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            1. Click the name above to rename this step.<br />
            2. Write a system prompt below to define what it does — be specific.<br />
            3. Connect it to other nodes using the Depends On section.
          </p>
        </div>
      )}

      {/* Recovery panel — shown when node failed or was skipped */}
      {(status === 'error' || status === 'skipped') && (
        <div className="mb-5 p-3 rounded-lg bg-red-950/20 border border-red-900/50">
          <p className="text-[11px] text-red-300 font-semibold mb-1">
            {status === 'error' ? '✗ All self-heal attempts exhausted' : '⊘ Skipped — upstream node failed'}
          </p>
          <p className="text-[11px] text-gray-400 mb-3">
            {status === 'error'
              ? 'Pick a different model in the Driver section below, then retry.'
              : 'Fix or retry the upstream node first, then retry this one.'}
          </p>
          <button
            onClick={() => onRetryNode(node.id)}
            disabled={isRunning}
            className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-red-700/60 bg-red-950/40 text-red-300 hover:bg-red-950/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            ↺ Retry This Node
          </button>
        </div>
      )}

      {/* Regenerate button — shown on successful/output nodes */}
      {outputs[node.id] && status !== 'error' && status !== 'skipped' && (
        <button
          onClick={() => onRetryNode(node.id)}
          disabled={isRunning}
          className="w-full mb-5 px-3 py-2 text-xs font-semibold rounded-lg border border-indigo-700/40 bg-indigo-950/30 text-indigo-300 hover:bg-indigo-950/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          ↺ Regenerate This Node
        </button>
      )}

      {/* Driver Mode Toggle */}
      <section className="mb-5">
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block mb-2">Driver</label>
        <div className="flex bg-gray-950 rounded-lg border border-gray-800 overflow-hidden mb-3">
          {[{ id: 'model', label: '✦ Model' }, { id: 'agent', label: '🤖 Agent' }].map((m) => (
            <button
              key={m.id}
              onClick={() => {
                if (m.id === 'model') { onUpdateAgent(node.id, null); }
                else if ((agents || []).length === 0) { /* no agents configured yet */ }
                else { onUpdateAgent(node.id, (agents || [])[0]?.id || null); }
              }}
              className={`flex-1 py-1.5 text-[11px] font-medium transition-all ${driverMode === m.id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >{m.label}</button>
          ))}
        </div>

        {/* Model list */}
        {driverMode === 'model' && (
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onUpdateModel(node.id, null)}
              className="px-3 py-2 rounded-lg text-xs text-left flex items-center gap-2 transition-all border"
              style={{
                background: !node.model ? '#6366f115' : '#111827',
                borderColor: !node.model ? '#6366f155' : '#1f2937',
                color: !node.model ? '#818cf8' : '#9ca3af',
              }}
            >
              <span>✦</span>
              <span className="font-medium">Auto (recommended)</span>
              <span className="ml-auto opacity-60 text-[10px]">{template.modelTier}</span>
            </button>
            {MODEL_OPTIONS.map((m) => {
              const active = node.model === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onUpdateModel(node.id, m.id)}
                  className="px-3 py-2 rounded-lg text-xs text-left flex items-center gap-2 transition-all border"
                  style={{
                    background: active ? `${m.color}15` : '#111827',
                    borderColor: active ? `${m.color}55` : '#1f2937',
                    color: active ? m.color : '#9ca3af',
                  }}
                >
                  <span>{m.badge}</span>
                  <span className="font-medium">{m.label}</span>
                  <span className="ml-auto opacity-60 text-[10px]">{m.tier}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Agent list */}
        {driverMode === 'agent' && (
          <div className="flex flex-col gap-1">
            {(agents || []).length === 0 ? (
              <p className="text-[11px] text-gray-600 px-3 py-3 bg-gray-900 rounded-lg border border-gray-800">
                No agents configured. Add one in <strong className="text-gray-400">⚙️ Settings → Agents</strong>.
              </p>
            ) : (
              (agents || []).map((a) => {
                const proto = AGENT_PROTOCOLS[a.protocol];
                const active = node.agentId === a.id;
                const status = agentStatuses?.[a.id];
                return (
                  <button
                    key={a.id}
                    onClick={() => onUpdateAgent(node.id, a.id)}
                    className="px-3 py-2 rounded-lg text-xs text-left flex items-center gap-2 transition-all border"
                    style={{
                      background: active ? `${proto?.color || '#6366f1'}15` : '#111827',
                      borderColor: active ? `${proto?.color || '#6366f1'}55` : '#1f2937',
                      color: active ? (proto?.color || '#818cf8') : '#9ca3af',
                    }}
                  >
                    <span>{proto?.icon || '🤖'}</span>
                    <span className="font-medium">{a.label}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: status === 'online' ? '#10b981' : status === 'offline' ? '#ef4444' : '#4b5563' }}
                      />
                      <span className="opacity-60 text-[10px]">{proto?.label || a.protocol}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Dependency Checkboxes */}
      <section className="mb-5">
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block mb-2">Depends On</label>
        <div className="flex flex-col gap-1">
          {nodes.filter((n) => n.id !== node.id).map((n) => {
            const tmpl = NODE_TEMPLATES.find((t) => t.id === (n.templateId || n.id));
            const isDep = upstreamIds.includes(n.id);
            return (
              <button
                key={n.id}
                onClick={() => onToggleEdge(n.id, node.id)}
                className="px-2.5 py-1.5 rounded-md text-xs text-left flex items-center gap-2 transition-all border"
                style={{
                  background: isDep ? `${tmpl?.color}12` : '#111827',
                  borderColor: isDep ? `${tmpl?.color}44` : '#1f2937',
                  color: isDep ? tmpl?.color : '#6b7280',
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center text-[9px] text-white"
                  style={{ border: `2px solid ${isDep ? tmpl?.color : '#374151'}`, background: isDep ? tmpl?.color : 'transparent' }}
                >
                  {isDep ? '✓' : ''}
                </span>
                {tmpl?.icon} {n.customLabel || tmpl?.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Custom System Prompt */}
      <section className="mb-5">
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block mb-2">System Prompt Override</label>
        <textarea
          value={node.customPrompt || ''}
          onChange={(e) => onUpdatePrompt(node.id, e.target.value)}
          placeholder={template.systemPrompt.slice(0, 120) + '...'}
          rows={4}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 resize-vertical font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none"
        />
        <p className="text-[10px] text-gray-600 mt-1">Leave empty to use the default prompt</p>
      </section>

      {/* Output Preview */}
      {outputs[node.id] && (
        <section>
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block mb-2">Output Preview</label>
          <pre className="text-[11px] text-gray-400 bg-gray-950 border border-gray-800 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
            {outputs[node.id].slice(0, 600)}{outputs[node.id].length > 600 ? '\n…(see Outputs tab)' : ''}
          </pre>
        </section>
      )}
    </div>
  );
}
