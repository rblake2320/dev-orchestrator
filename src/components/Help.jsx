const SECTIONS = [
  {
    id: 'what',
    icon: '⚡',
    title: 'What Dev Orchestrator Is',
    content: (
      <div className="space-y-4">
        <p className="text-gray-300 leading-relaxed text-sm">
          Dev Orchestrator is a <strong className="text-white">multi-model AI pipeline builder</strong> — a system that takes your project description and routes it through a chain of specialized AI nodes, each one an expert in its domain, all working in parallel where possible.
        </p>
        <p className="text-gray-300 leading-relaxed text-sm">
          The result is not a prototype or a starting point. It is <strong className="text-white">complete, production-ready code</strong> — requirements, database schema, API contract, front-end, back-end, auth, payments, tests, and deployment configs — all generated as a coherent, cross-referenced system where every piece fits the others.
        </p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { icon: '🍔', label: 'Food delivery app', desc: 'Full stack in one run' },
            { icon: '💼', label: 'SaaS platform', desc: 'Auth + billing + dashboard' },
            { icon: '🏥', label: 'Healthcare portal', desc: 'HIPAA-aware design' },
            { icon: '🛒', label: 'E-commerce store', desc: 'Stripe + inventory + cart' },
            { icon: '🎮', label: 'Gaming backend', desc: 'Realtime + leaderboards' },
            { icon: '📊', label: 'Analytics dashboard', desc: 'Data pipelines + viz' },
          ].map((ex) => (
            <div key={ex.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="text-xl mb-1">{ex.icon}</div>
              <div className="text-xs font-semibold text-gray-200">{ex.label}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{ex.desc}</div>
            </div>
          ))}
        </div>
        <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-lg p-4 mt-2">
          <p className="text-indigo-300 text-sm font-semibold mb-1">This is not a toy.</p>
          <p className="text-gray-400 text-xs leading-relaxed">
            Every node in the pipeline has access to frontier AI models (Claude Opus, GPT-4o, Gemini), web search for up-to-date best practices, external agents (OpenClaw, OpenAI Assistants, custom HTTP agents), and a self-healing engine that retries failures automatically. A 3-node MVP pipeline and a 15-node enterprise system are equally possible — and both produce code you can run.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'quickstart',
    icon: '🚀',
    title: 'Quick Start — 3 Steps',
    content: (
      <div className="space-y-3">
        {[
          {
            step: '1',
            title: 'Describe your project',
            desc: 'Click the project description bar and type what you want to build. Be specific — "AI-powered food tasting app with user reviews, Stripe billing, and a React dashboard" gives better results than "food app".',
            color: '#6366f1',
          },
          {
            step: '2',
            title: 'Choose a template or build your pipeline',
            desc: 'Pick a pre-built template (Rapid MVP, Full-Stack App, API-First, etc.) or add nodes manually with "+ Add Node". Connect nodes by clicking a node → Node Inspector → "Depends On". The pipeline runs nodes in the correct dependency order automatically.',
            color: '#10b981',
          },
          {
            step: '3',
            title: 'Auto-Configure then Run',
            desc: 'Click "🧠 Auto-Configure" to let an AI assign the optimal model to every node based on complexity. Then click "▶ Run Pipeline". If anything fails, click "🔄 Self-Heal" — it diagnoses, fixes, and re-runs automatically.',
            color: '#f59e0b',
          },
        ].map((s) => (
          <div key={s.step} className="flex gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 mt-0.5" style={{ background: `${s.color}20`, color: s.color, border: `2px solid ${s.color}40` }}>
              {s.step}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-100 mb-1">{s.title}</div>
              <div className="text-xs text-gray-400 leading-relaxed">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'nodes',
    icon: '🗂️',
    title: 'Node Catalog — What Each Node Builds',
    content: (
      <div className="space-y-2">
        {[
          { icon: '📋', name: 'Requirements', color: '#6366f1', tier: 'Mid', output: 'User stories with acceptance criteria, MoSCoW prioritization, non-functional requirements, edge cases, and constraints. This node feeds every downstream node with shared product context.' },
          { icon: '🗃️', name: 'DB Schema', color: '#8b5cf6', tier: 'Mid', output: 'Full PostgreSQL/MySQL schema — CREATE TABLE statements, indexes, foreign keys, migration SQL, and seed data. References the Requirements node to match every feature.' },
          { icon: '📡', name: 'API Contract', color: '#06b6d4', tier: 'Mid', output: 'Complete OpenAPI 3.0 specification — every endpoint, request/response schema, auth strategy (JWT/OAuth), rate limiting, and error codes. Front-end and back-end both use this as their source of truth.' },
          { icon: '⚛️', name: 'Front-End Code', color: '#3b82f6', tier: 'Frontier', output: 'React/TypeScript components, custom hooks, routing, state management, and API integration. Implements the API Contract and references the UI Wireframes if present.' },
          { icon: '⚙️', name: 'Back-End Code', color: '#10b981', tier: 'Frontier', output: 'Express/Node or FastAPI server with ORM models, business logic, middleware, and environment config. Implements every endpoint in the API Contract.' },
          { icon: '🎨', name: 'UI Wireframes', color: '#ec4899', tier: 'Mid', output: 'Component hierarchy, layout descriptions, interaction flows, and responsive design notes. Guides the Front-End Code node.' },
          { icon: '🔐', name: 'Auth & Security', color: '#ef4444', tier: 'Frontier', output: 'JWT/OAuth implementation, RBAC definitions, rate limiting config, CSRF protection, input validation, and security headers. Integrates with the Back-End Code.' },
          { icon: '💳', name: 'Payments', color: '#f59e0b', tier: 'Frontier', output: 'Full Stripe integration — checkout, webhooks, subscription management, billing portal, and failed payment handling.' },
          { icon: '🧪', name: 'Tests', color: '#84cc16', tier: 'Mid', output: 'Jest unit tests, Playwright E2E tests, API integration tests, and test data factories. Covers all endpoints and critical user flows.' },
          { icon: '🚀', name: 'Deployment', color: '#f97316', tier: 'Local', output: 'Dockerfile, docker-compose.yml, Kubernetes manifests, GitHub Actions CI/CD workflow, and environment variable templates.' },
          { icon: '🔍', name: 'Peer Review', color: '#a78bfa', tier: 'Frontier', output: 'Cross-checks all upstream outputs for consistency, security issues, missing edge cases, and architectural problems. A second set of AI eyes on everything.' },
          { icon: '✓', name: 'Fact Check', color: '#34d399', tier: 'Frontier', output: 'Verifies claims, API compatibility, library versions, and code correctness. Flags anything that might not work as written. Web-enabled for current docs.' },
        ].map((n) => (
          <div key={n.name} className="flex gap-3 bg-gray-900 border border-gray-800 rounded-lg p-3">
            <span className="text-xl flex-shrink-0 mt-0.5">{n.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold" style={{ color: n.color }}>{n.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-500">{n.tier}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{n.output}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'pipeline',
    icon: '🔗',
    title: 'How the Pipeline Executes',
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          {[
            { icon: '◈', title: 'DAG Mode (default)', desc: 'Nodes execute in topological order. Independent nodes run in parallel — DB Schema and Requirements can run at the same time if neither depends on the other. The pipeline finds the critical path automatically.' },
            { icon: '↓', title: 'Sequential Mode', desc: 'Every node waits for the previous one to finish. Slower but each node has full context from all prior nodes. Best for chains where context builds heavily.' },
            { icon: '⫘', title: 'Parallel Mode', desc: 'All nodes run simultaneously regardless of dependencies. Maximum speed. Best for independent nodes that don\'t need each other\'s outputs.' },
          ].map((m) => (
            <div key={m.title} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex gap-3">
              <span className="text-indigo-400 font-mono text-lg flex-shrink-0">{m.icon}</span>
              <div>
                <div className="text-sm font-semibold text-gray-200 mb-1">{m.title}</div>
                <p className="text-xs text-gray-400 leading-relaxed">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-200 mb-2">Context flows through edges</div>
          <p className="text-xs text-gray-400 leading-relaxed">When a node runs, it receives the full outputs of every upstream node it depends on. The Back-End Code node sees the DB Schema, API Contract, Auth design, and Payments spec all at once — so it generates code that implements all of them coherently, not in isolation.</p>
        </div>
      </div>
    ),
  },
  {
    id: 'features',
    icon: '🧠',
    title: 'Smart Features',
    content: (
      <div className="space-y-3">
        {[
          {
            icon: '🧠',
            name: 'Auto-Configure',
            color: '#8b5cf6',
            desc: 'Before you run, click Auto-Configure. An LLM analyzes your project description and the full pipeline topology — which nodes have many dependents, which tasks are complex vs. simple — and assigns the optimal model to every node. Frontier models (Claude, GPT-4o) go on code generation. Mid-tier (Llama 70B, Groq) go on analytical tasks. Fast local models handle structured output. You get maximum quality without paying frontier prices for every node.',
          },
          {
            icon: '🔄',
            name: 'Self-Heal',
            color: '#f59e0b',
            desc: 'When nodes fail — rate limits, auth errors, model overloads — Self-Heal kicks in. It diagnoses root cause, swaps failed models for available alternatives, clears only the failed nodes (preserving all successful outputs), re-runs the broken subtree, and repeats up to 5 times. You don\'t lose work. The pipeline keeps going until everything is green or it genuinely has no more options.',
          },
          {
            icon: '🌐',
            name: 'Web Search',
            color: '#06b6d4',
            desc: 'Web-enabled nodes (marked with a 🌐 badge) can search the internet before generating output. This means your Payments node knows current Stripe API versions. Your Security node knows about recent CVEs. Your Deployment node uses current Docker best practices. Enable web search in Settings → Web Search with a Tavily, Brave, or Serper API key.',
          },
          {
            icon: '🤖',
            name: 'External Agents',
            color: '#10b981',
            desc: 'Any node can be driven by an external AI agent instead of a raw model call. Click a node → Node Inspector → toggle to Agent mode. Supports OpenAI Assistants, OpenClaw Gateway, any HTTP POST agent, and WebSocket agents. Agents are sandboxed — they only see the current project and their direct upstream outputs. Configure agents in Settings → Agents.',
          },
          {
            icon: '✎',
            name: 'Custom Prompts',
            color: '#6366f1',
            desc: 'Click any node → Node Inspector → System Prompt Override. Add custom instructions that augment or replace the default prompt for that node. "Generate in FastAPI not Express", "Use Supabase not Prisma", "Focus on HIPAA compliance" — per-node specialization at the prompt level.',
          },
          {
            icon: '↺',
            name: 'Regenerate Single Node',
            color: '#ec4899',
            desc: 'Don\'t like one node\'s output? Click Outputs tab → ↺ button on that node. It re-runs only that one node with all its upstream context intact. Tweak the prompt, change the model, regenerate — without touching anything else.',
          },
        ].map((f) => (
          <div key={f.name} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{f.icon}</span>
              <span className="text-sm font-bold" style={{ color: f.color }}>{f.name}</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'outputs',
    icon: '📦',
    title: 'Your Outputs Are Real, Runnable Code',
    content: (
      <div className="space-y-4">
        <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-xl p-4">
          <p className="text-emerald-300 font-semibold text-sm mb-2">The code works. Here's how to use it.</p>
          <p className="text-gray-400 text-xs leading-relaxed">
            Every output panel in the Outputs tab contains production-grade code — not pseudocode, not a sketch. The DB Schema is valid PostgreSQL you can run directly. The API Contract is a valid OpenAPI spec you can import into Postman, Swagger, or any code generator. The front-end is React/TypeScript components you drop into a Vite project. The back-end is a runnable Express server.
          </p>
        </div>
        <div className="space-y-2">
          {[
            { step: '1', action: 'Click "📦 Download Files" in the Outputs tab', detail: 'Each node\'s primary code block downloads as a named file — schema.sql, openapi.yaml, server.js, App.tsx, etc.' },
            { step: '2', action: 'Create your project folder', detail: 'mkdir my-app && cd my-app — or clone your existing repo. Place the downloaded files in the appropriate locations.' },
            { step: '3', action: 'Install dependencies', detail: 'The back-end output lists every npm package. Run npm install express prisma stripe zod etc. The front-end output includes a package.json you can use directly.' },
            { step: '4', action: 'Set environment variables', detail: 'Every output includes a .env template. Fill in your database URL, Stripe keys, JWT secret, etc.' },
            { step: '5', action: 'Run it', detail: 'node server.js or npm run dev. Your application starts. It connects to your database, processes payments, handles auth — everything the pipeline designed.' },
          ].map((s) => (
            <div key={s.step} className="flex gap-3 items-start">
              <div className="w-5 h-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-400 font-bold flex-shrink-0 mt-0.5">{s.step}</div>
              <div>
                <div className="text-xs font-semibold text-gray-200">{s.action}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mt-2">
          <p className="text-xs text-gray-400"><span className="text-gray-200 font-semibold">Pro tip: </span>Run the pipeline again with a more specific description if you want to refine. "Use Supabase instead of Prisma" or "add WebSocket support for real-time notifications" — re-run and you get a revised, complete codebase. Each run is independent and takes 30–120 seconds.</p>
        </div>
      </div>
    ),
  },
  {
    id: 'models',
    icon: '✦',
    title: 'Model Guide — What Each Tier Does',
    content: (
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Auto-Configure assigns models automatically. This guide explains what each tier is best at so you can override manually if needed.</p>
        {[
          {
            tier: 'Frontier',
            color: '#818cf8',
            models: 'Claude Opus/Sonnet, GPT-4o, Gemini Pro, OpenRouter Claude',
            best: 'Complex code generation, security implementation, payment systems, peer review, anything where correctness is non-negotiable. Use frontier for nodes whose failures cascade to many downstream nodes.',
          },
          {
            tier: 'Mid',
            color: '#34d399',
            models: 'Llama 70B (Groq), GPT-4o Mini, DeepSeek Chat, Gemini Flash',
            best: 'Requirements analysis, schema design, API contracts, documentation, test generation. Strong reasoning, fast, cost-effective. Groq is free-tier and extremely fast — ideal for mid-tier nodes.',
          },
          {
            tier: 'Local',
            color: '#fb923c',
            models: 'Ollama (Llama, Mistral, Gemma, DeepSeek), any local model',
            best: 'Deployment configs, simple templating, structured output that doesn\'t require deep reasoning. Runs on your machine — free and private. Configure in Settings → Local Models.',
          },
        ].map((t) => (
          <div key={t.tier} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-black px-2 py-0.5 rounded" style={{ background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }}>{t.tier}</span>
              <span className="text-[11px] text-gray-500">{t.models}</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{t.best}</p>
          </div>
        ))}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400"><span className="text-gray-200 font-semibold">Keys to add for full power: </span>Groq (free, fast mid-tier), Anthropic (best frontier), Gemini (great free tier). With all three configured, Auto-Configure and Self-Heal have maximum fallback coverage — the pipeline almost never gets stuck.</p>
        </div>
      </div>
    ),
  },
  {
    id: 'faq',
    icon: '❓',
    title: 'FAQ',
    content: (
      <div className="space-y-3">
        {[
          {
            q: 'The pipeline is fast but the outputs look like markdown with code blocks. Is that really working code?',
            a: 'Yes. The markdown is the wrapper — inside it are complete, syntactically valid code files. Click "📦 Download Files" to extract them as actual .sql, .yaml, .ts, .js files you can run. Or click "Raw" on any output panel to see the clean code.',
          },
          {
            q: 'Nodes keep failing with rate limit errors. What do I do?',
            a: 'Click 🔄 Self-Heal. It will diagnose the rate limit, swap to a different model on a different provider, and re-run. Add more API keys (Groq is free, Gemini has a generous free tier) to give the self-heal engine more fallback options.',
          },
          {
            q: 'How do I make the pipeline produce code for a specific stack (FastAPI, Next.js, etc.)?',
            a: 'Click any node → Node Inspector → System Prompt Override. Add "Generate using FastAPI with SQLAlchemy" or "Use Next.js 15 App Router". The node will use that constraint while still incorporating all upstream context.',
          },
          {
            q: 'Can I save and reuse pipelines?',
            a: 'Pipelines auto-save to your browser localStorage. Add more nodes, change models, run again — everything persists. You can also build your own template by configuring the pipeline the way you want it.',
          },
          {
            q: 'What\'s the difference between Auto-Configure and just running the pipeline?',
            a: 'Running without Auto-Configure uses "auto" mode for every node — the system picks a default model based on node tier. Auto-Configure does a pre-run analysis: it reads your project description and pipeline topology and assigns the smartest model to each specific node. It costs one extra API call but significantly improves output quality on complex projects.',
          },
          {
            q: 'How do external agents work?',
            a: 'Instead of calling an AI model API directly, an agent node sends the task to an external system — an OpenAI Assistant, an OpenClaw session, a custom HTTP API. The agent processes the task and returns the result. Useful for specialized agents (a security audit agent, a domain-expert agent, a company-specific code style agent) that outperform raw model calls for specific tasks.',
          },
        ].map((faq, i) => (
          <details key={i} className="bg-gray-900 border border-gray-800 rounded-lg group">
            <summary className="px-4 py-3 text-xs font-semibold text-gray-300 cursor-pointer list-none flex items-center justify-between hover:text-white transition-colors">
              {faq.q}
              <span className="text-gray-600 group-open:rotate-180 transition-transform text-base">▾</span>
            </summary>
            <div className="px-4 pb-3 text-xs text-gray-400 leading-relaxed border-t border-gray-800 pt-3">
              {faq.a}
            </div>
          </details>
        ))}
      </div>
    ),
  },
];

export default function Help() {
  return (
    <div className="flex-1 overflow-auto">
      {/* Hero */}
      <div className="border-b border-gray-800 bg-gradient-to-br from-indigo-950/40 via-gray-900 to-gray-900 px-8 py-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">⚡</span>
            <h1 className="text-2xl font-black text-white">Dev Orchestrator</h1>
          </div>
          <p className="text-gray-300 text-base leading-relaxed font-medium">
            A multi-model AI pipeline that builds complete, runnable applications — front to back — from a single project description.
          </p>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed">
            Not a code snippet generator. Not a chat assistant. A <strong className="text-gray-300">workhorse system</strong> that coordinates frontier AI models in a directed graph, each node an expert, all producing output that connects into a working whole.
          </p>
          <div className="flex gap-4 mt-5">
            {[
              { n: '12+', label: 'Node types' },
              { n: '10+', label: 'AI models' },
              { n: '4', label: 'Agent protocols' },
              { n: '5×', label: 'Self-heal attempts' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-black text-indigo-400">{s.n}</div>
                <div className="text-[11px] text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="p-8 max-w-3xl space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.id}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">{s.icon}</span>
              <h2 className="text-base font-bold text-white">{s.title}</h2>
            </div>
            {s.content}
          </section>
        ))}
      </div>
    </div>
  );
}
