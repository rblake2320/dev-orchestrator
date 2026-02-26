# ⚡ Dev Orchestrator

DAG-based AI development pipeline builder. Sequence, parallelize, and route multi-model generation for complete software projects.

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> Evolution of the [Prompt Compiler](https://github.com/rblake2320/prompt-compiler) — same shell, now with dependency-aware, multi-model pipeline execution.

## Quick Start

```bash
git clone https://github.com/rblake2320/dev-orchestrator.git
cd dev-orchestrator
npm install
cp .env.example .env   # Add your API keys
npm run dev
```

Open `http://localhost:5173`

## What It Does

Instead of generating everything at once (like the Prompt Compiler), Dev Orchestrator lets you define **what depends on what** and executes nodes in the correct order — with each node powered by a different AI model.

```
[Requirements] ──┬──→ [API Contract] ──→ [Back-End Code] ──┐
                 │                                          ├──→ [Tests]
[DB Schema] ─────┤                                          │
                 │                                          │
[Wireframes] ────┴──→ [Front-End Code] ────────────────────┘
```

## Features

- **Visual DAG Canvas** — nodes auto-layout via topological sort with Bézier edge rendering
- **3 Execution Modes** — Parallel (all at once), Sequential (strict order), DAG (dependency-aware)
- **Multi-Model Routing** — assign Claude Opus, Sonnet, GPT-4o, Groq, or local Ollama models per node
- **Pipeline Templates** — pre-built DAGs for Full-Stack App, Landing Page, API Service, Rapid MVP
- **Node Inspector** — per-node model selection, dependency editing, custom prompt overrides
- **Upstream Context Injection** — completed node outputs automatically feed into downstream prompts
- **Execution Log** — real-time pipeline progress with timing

## Architecture

```
┌─────────────────────────────────────────┐
│  React Frontend (Vite + Tailwind)       │
│  ├─ TemplateSelector (pipeline presets) │
│  ├─ Canvas (SVG DAG visualization)      │
│  ├─ NodeInspector (config panel)        │
│  └─ Outputs / Log viewers              │
└──────────────┬──────────────────────────┘
               │ Per-node API calls
┌──────────────▼──────────────────────────┐
│  Pipeline Engine (DAG executor)         │
│  ├─ Topological sort → execution levels │
│  ├─ Parallel execution within levels    │
│  └─ Context injection from upstream     │
└──────────────┬──────────────────────────┘
               │ Multi-provider routing
┌──────────────▼──────────────────────────┐
│  AI Providers                           │
│  ├─ Anthropic (Claude Opus / Sonnet)    │
│  ├─ OpenAI (GPT-4o / GPT-4o-mini)      │
│  ├─ Groq (Llama 70B)                   │
│  └─ Ollama (Local: Llama, Mistral, etc) │
└─────────────────────────────────────────┘
```

## Pipeline Nodes

| Node | What It Generates | Default Tier |
|------|-------------------|--------------|
| 📋 Requirements | User stories, acceptance criteria | Mid |
| 🗃️ DB Schema | Tables, relationships, migrations | Mid |
| 🎨 UI Wireframes | Component layout, UX specs | Mid |
| 📡 API Contract | OpenAPI spec, endpoints, schemas | Mid |
| ⚛️ Front-End | React components, routing, state | Frontier |
| ⚙️ Back-End | Server routes, middleware, ORM | Frontier |
| 🔐 Auth & Security | JWT, RBAC, security middleware | Frontier |
| 💳 Payments | Stripe integration, webhooks | Frontier |
| 🧪 Tests | Unit, integration, E2E tests | Mid |
| 🚀 Deployment | Docker, CI/CD, env config | Local |

## API Key Setup

| Provider | Environment Variable |
|----------|---------------------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Ollama (Local) | `OLLAMA_HOST` (default: `http://localhost:11434`) |

> ⚠️ API keys are never shipped in frontend code. All requests route through a server-side proxy.

## Deploy

**Cloudflare Pages:**

```bash
wrangler secret put ANTHROPIC_API_KEY
npm run build
wrangler pages deploy dist
```

**Vercel:**

```bash
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

## Project Structure

```
dev-orchestrator/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── components/
│   │   ├── DevOrchestrator.jsx    # Main UI + state management
│   │   ├── Canvas.jsx             # SVG DAG visualization
│   │   ├── NodeInspector.jsx      # Node config panel
│   │   └── TemplateSelector.jsx   # Pipeline template chooser
│   └── lib/
│       ├── api.js                 # Multi-provider API client
│       ├── models.js              # Node templates, model defs, pipeline presets
│       ├── pipeline.js            # DAG execution engine
│       └── settings.js            # Settings + localStorage persistence
├── functions/
│   └── api/proxy/
│       └── [[path]].js            # Cloudflare Pages proxy (multi-provider)
├── index.html
├── vite.config.js
├── tailwind.config.js
├── wrangler.toml
├── package.json
└── .env.example
```

## Roadmap

- [ ] React Flow integration (drag-and-drop node positioning, edge drawing)
- [ ] Save/load custom pipeline configurations
- [ ] Streaming output display per node
- [ ] Export all outputs as a zip (complete project scaffold)
- [ ] Gate nodes (human review before downstream execution)
- [ ] Fine-tuned model support (custom Ollama models)
- [ ] Cost estimation per pipeline run

## License

MIT
