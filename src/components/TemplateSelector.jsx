import { PIPELINE_TEMPLATES, NODE_TEMPLATES } from '../lib/models';

export default function TemplateSelector({
  projectDesc,
  onProjectDescChange,
  onSelectTemplate,
  onStartBlank,
  onShowHelp,
}) {
  return (
    <div className="p-8 flex flex-col items-center gap-8 overflow-auto flex-1">
      {/* Hero */}
      <div className="text-center max-w-xl">
        <h2 className="text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-indigo-200 to-violet-400 bg-clip-text text-transparent">
          Build Your Pipeline
        </h2>
        <p className="text-sm text-gray-500">
          Choose a template or start from scratch. Each node is an AI generation
          step — connected by dependency edges, powered by the model you assign.
        </p>
        <button
          onClick={onShowHelp}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
        >
          ❓ New here? Read how it works
        </button>
      </div>

      {/* Project Description */}
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl p-5">
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block mb-2">
          Project Description
        </label>
        <textarea
          value={projectDesc}
          onChange={(e) => onProjectDescChange(e.target.value)}
          placeholder="Describe your project... e.g. 'Build a SaaS invoicing platform with Stripe payments, team roles, and a dashboard'"
          rows={3}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-4 text-sm text-gray-200 resize-vertical outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
        />
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        {PIPELINE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectTemplate(t)}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-left transition-all hover:border-indigo-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10 group"
          >
            <div className="text-3xl mb-2">{t.icon}</div>
            <div className="text-sm font-semibold text-gray-100 mb-1 group-hover:text-indigo-300 transition-colors">
              {t.label}
            </div>
            <div className="text-xs text-gray-500 mb-3">{t.desc}</div>
            <div className="flex gap-1 flex-wrap">
              {t.nodes.slice(0, 5).map((nid) => {
                const tmpl = NODE_TEMPLATES.find((nt) => nt.id === nid);
                return (
                  <span
                    key={nid}
                    className="text-[10px] px-2 py-0.5 rounded-md border"
                    style={{
                      background: `${tmpl?.color}12`,
                      color: tmpl?.color,
                      borderColor: `${tmpl?.color}33`,
                    }}
                  >
                    {tmpl?.icon} {tmpl?.label}
                  </span>
                );
              })}
              {t.nodes.length > 5 && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-800 text-gray-500">
                  +{t.nodes.length - 5} more
                </span>
              )}
            </div>
          </button>
        ))}

        {/* Blank Canvas */}
        <button
          onClick={onStartBlank}
          className="bg-[#0a0a0f] border-2 border-dashed border-gray-800 rounded-xl p-5 text-center flex flex-col items-center justify-center min-h-[160px] transition-all hover:border-gray-600"
        >
          <div className="text-3xl mb-2 opacity-30">➕</div>
          <div className="text-sm font-semibold text-gray-500">Start Blank</div>
          <div className="text-[11px] text-gray-600 mt-1">Add nodes manually</div>
        </button>
      </div>
    </div>
  );
}
