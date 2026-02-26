import { NODE_TEMPLATES, MODEL_OPTIONS } from '../lib/models';

export default function NodeInspector({
  node,
  nodes,
  edges,
  outputs,
  onUpdateModel,
  onToggleEdge,
  onRemoveNode,
  onUpdatePrompt,
}) {
  const template = NODE_TEMPLATES.find((t) => t.id === node.templateId);
  if (!template) return null;

  const upstreamIds = edges
    .filter(([, to]) => to === node.id)
    .map(([from]) => from);

  return (
    <div className="w-80 border-l border-gray-800 bg-[#0d1117] p-5 overflow-y-auto flex-shrink-0 animate-slide-in">
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="text-2xl mb-1">{template.icon}</div>
          <h3 className="text-base font-bold text-gray-100">{template.label}</h3>
          <p className="text-xs text-gray-500 mt-1">{template.desc}</p>
        </div>
        <button
          onClick={() => onRemoveNode(node.id)}
          className="text-xs px-2.5 py-1 bg-red-950/30 border border-red-900/40 rounded-md text-red-300 hover:bg-red-950/50 transition-colors"
        >
          ✕ Remove
        </button>
      </div>

      {/* Model Selector */}
      <section className="mb-5">
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block mb-2">
          AI Model
        </label>
        <div className="flex flex-col gap-1">
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
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block mb-2">
          Depends On
        </label>
        <div className="flex flex-col gap-1">
          {nodes
            .filter((n) => n.id !== node.id)
            .map((n) => {
              const tmpl = NODE_TEMPLATES.find((t) => t.id === n.templateId);
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
                    style={{
                      border: `2px solid ${isDep ? tmpl?.color : '#374151'}`,
                      background: isDep ? tmpl?.color : 'transparent',
                    }}
                  >
                    {isDep ? '✓' : ''}
                  </span>
                  {tmpl?.icon} {tmpl?.label}
                </button>
              );
            })}
        </div>
      </section>

      {/* Custom System Prompt */}
      <section className="mb-5">
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block mb-2">
          System Prompt Override
        </label>
        <textarea
          value={node.customPrompt || ''}
          onChange={(e) => onUpdatePrompt(node.id, e.target.value)}
          placeholder={template.systemPrompt.slice(0, 120) + '...'}
          rows={4}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 resize-vertical font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none"
        />
        <p className="text-[10px] text-gray-600 mt-1">
          Leave empty to use the default prompt
        </p>
      </section>

      {/* Output Preview */}
      {outputs[node.id] && (
        <section>
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block mb-2">
            Output
          </label>
          <pre className="text-[11px] text-gray-400 bg-gray-950 border border-gray-800 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
            {outputs[node.id]}
          </pre>
        </section>
      )}
    </div>
  );
}
