import { useState } from 'react';
import { NODE_TEMPLATES, MODEL_OPTIONS } from '../lib/models';

export default function NodeInspector({
  node,
  nodes,
  edges,
  outputs,
  nodeStatuses,
  modelsUsed,
  onUpdateModel,
  onToggleEdge,
  onRemoveNode,
  onUpdatePrompt,
  onUpdateLabel,
  onRetryNode,
  isRunning,
}) {
  const template = NODE_TEMPLATES.find((t) => t.id === (node.templateId || node.id));
  if (!template) return null;

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(node.customLabel || template.label);

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

  return (
    <div className="w-80 border-l border-gray-800 bg-[#0d1117] p-5 overflow-y-auto flex-shrink-0 animate-slide-in">
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
          onClick={() => onRemoveNode(node.id)}
          className="ml-2 flex-shrink-0 text-xs px-2.5 py-1 bg-red-950/30 border border-red-900/40 rounded-md text-red-300 hover:bg-red-950/50 transition-colors"
        >
          ✕ Remove
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

      {/* Retry button — shown when node has output */}
      {outputs[node.id] && (
        <button
          onClick={() => onRetryNode(node.id)}
          disabled={isRunning}
          className="w-full mb-5 px-3 py-2 text-xs font-semibold rounded-lg border border-indigo-700/40 bg-indigo-950/30 text-indigo-300 hover:bg-indigo-950/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          ↺ Regenerate This Node
        </button>
      )}

      {/* Model Selector */}
      <section className="mb-5">
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block mb-2">
          AI Model {!node.model && <span className="text-gray-700 normal-case">(auto)</span>}
        </label>
        <div className="flex flex-col gap-1">
          {/* Auto option */}
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
