// ─── Node Templates ───────────────────────────────────────────────────────────
export const NODE_TEMPLATES = [
  {
    id: 'requirements',
    label: 'Requirements',
    icon: '📋',
    color: '#6366f1',
    modelTier: 'mid',
    desc: 'User stories & acceptance criteria',
    systemPrompt: `You are a Requirements Analyst. Given a project description, produce structured requirements:
- User stories with acceptance criteria
- Non-functional requirements (performance, security, scalability)
- Prioritized feature list (MoSCoW)
- Edge cases and constraints

Respond with well-structured markdown.`,
  },
  {
    id: 'db_schema',
    label: 'DB Schema',
    icon: '🗃️',
    color: '#8b5cf6',
    modelTier: 'mid',
    desc: 'Tables, relationships, migrations',
    systemPrompt: `You are a Database Architect. Design a complete production database schema.

Write complete PostgreSQL DDL:
- Every table definition with ALL columns, types, NOT NULL constraints, defaults
- Every table gets: id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at, updated_at
- Foreign keys with explicit ON DELETE behavior
- Indexes for every foreign key and frequently-queried column
- CHECK constraints for status/enum columns
- CREATE OR REPLACE FUNCTION + TRIGGER for updated_at auto-update
- Sample seed data: 5–10 realistic INSERT rows per core table

CRITICAL: Write the COMPLETE SQL. No truncation. No "-- add more tables here". Every table fully defined with all columns and constraints.`,
  },
  {
    id: 'wireframes',
    label: 'UI Wireframes',
    icon: '🎨',
    color: '#ec4899',
    modelTier: 'mid',
    desc: 'Component layout & UX specs',
    systemPrompt: `You are a UX Designer. Generate detailed wireframe specifications:
- Screen-by-screen layout descriptions
- Component hierarchy and naming
- User interaction flows
- Responsive breakpoints (mobile, tablet, desktop)
- Accessibility requirements (ARIA, keyboard nav)

Describe each screen with enough detail to build from.`,
  },
  {
    id: 'api_contract',
    label: 'API Contract',
    icon: '📡',
    color: '#14b8a6',
    modelTier: 'mid',
    desc: 'Endpoints, request/response shapes',
    systemPrompt: `You are an API Architect. Generate a complete API specification:
- RESTful endpoints with HTTP methods
- Request body schemas (JSON)
- Response schemas with status codes
- Authentication/authorization requirements
- Rate limiting and pagination strategy
- Error response format

Use OpenAPI 3.0 YAML format.`,
  },
  {
    id: 'frontend',
    label: 'Front-End Code',
    icon: '⚛️',
    color: '#3b82f6',
    modelTier: 'frontier',
    desc: 'React/Vue components & routing',
    systemPrompt: `You are a Senior Front-End Engineer. Generate production-ready front-end code:
- React components with TypeScript
- Routing setup (React Router)
- State management (hooks, context, or Zustand)
- API integration layer (fetch/axios with error handling)
- Responsive CSS (Tailwind)
- Loading states, error boundaries

Write complete, runnable code files.`,
  },
  {
    id: 'backend',
    label: 'Back-End Code',
    icon: '⚙️',
    color: '#f59e0b',
    modelTier: 'frontier',
    desc: 'Server routes, middleware, logic',
    systemPrompt: `You are a Senior Back-End Engineer. Generate production-ready server code:
- Express/Fastify route handlers
- Input validation middleware (Zod/Joi)
- Database queries (Drizzle/Prisma ORM)
- Error handling middleware
- Request logging
- Environment configuration

Write complete, runnable code files.`,
  },
  {
    id: 'auth',
    label: 'Auth & Security',
    icon: '🔐',
    color: '#ef4444',
    modelTier: 'frontier',
    desc: 'Auth flows, JWT, RBAC',
    systemPrompt: `You are a Security Engineer. Implement authentication and authorization:
- JWT token generation and validation
- Password hashing (bcrypt/argon2)
- Role-based access control (RBAC)
- Session management
- CORS configuration
- Rate limiting
- Input sanitization (XSS, SQL injection prevention)
- CSRF protection

Write complete, security-hardened code.`,
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: '💳',
    color: '#10b981',
    modelTier: 'frontier',
    desc: 'Stripe/Square integration',
    systemPrompt: `You are a Payments Integration Specialist. Implement payment processing:
- Stripe/Square SDK integration
- Checkout session creation
- Webhook handler for payment events
- Subscription management (if applicable)
- Invoice generation
- Refund handling
- PCI compliance notes
- Error recovery and idempotency

Write complete integration code with webhook verification.`,
  },
  {
    id: 'tests',
    label: 'Tests',
    icon: '🧪',
    color: '#a855f7',
    modelTier: 'mid',
    desc: 'Unit & integration tests',
    systemPrompt: `You are a QA Engineer. Generate comprehensive test suites:
- Unit tests for business logic (Vitest/Jest)
- API integration tests (supertest)
- Component tests (React Testing Library)
- E2E test scenarios (Playwright)
- Test fixtures and factories
- Coverage targets and CI integration

Write complete, runnable test files.`,
  },
  {
    id: 'deploy',
    label: 'Deployment',
    icon: '🚀',
    color: '#06b6d4',
    modelTier: 'local',
    desc: 'Docker, CI/CD, env config',
    systemPrompt: `You are a DevOps Engineer. Generate deployment configuration:
- Dockerfile (multi-stage build)
- docker-compose.yml for local dev
- CI/CD pipeline (GitHub Actions)
- Environment variable management
- Health check endpoints
- Logging and monitoring setup
- Production deployment checklist

Write complete, copy-paste-ready config files.`,
  },
  // ── Intelligence & Review Nodes ──────────────────────────────────────────────
  {
    id: 'web_research',
    label: 'Web Research',
    icon: '🌐',
    color: '#0ea5e9',
    modelTier: 'mid',
    webSearch: true,
    desc: 'Search the internet for relevant context',
    systemPrompt: `You are a Research Analyst with access to current web search results.
Based on the search results and project description provided, synthesize relevant findings:

- Summarize key industry practices and standards relevant to this project
- Identify recommended libraries, frameworks, or tools and their current versions
- Note potential risks, known pitfalls, or common mistakes in this domain
- Highlight any recent developments that should influence the design
- List authoritative resources for the team to reference

Be specific, factual, and always cite which search result supports each finding.
Organize output as structured markdown with clear sections.`,
  },
  {
    id: 'peer_review',
    label: 'Peer Review',
    icon: '🔍',
    color: '#f97316',
    modelTier: 'frontier',
    desc: 'Skeptical critical review of all upstream work',
    systemPrompt: `You are a skeptical Senior Technical Reviewer conducting a rigorous peer review.

Your mandate: be CRITICAL and SPECIFIC. Do not soften findings for politeness. Your job is to catch problems BEFORE they reach production.

For EVERY section you review, challenge:
1. **Correctness** — Logical errors, false assumptions, incorrect technical claims
2. **Completeness** — Missing requirements, unhandled edge cases, gaps in coverage
3. **Consistency** — Contradictions between sections (e.g. API contract vs backend implementation)
4. **Feasibility** — Is this actually buildable as described? Unrealistic scope?
5. **Security** — Vulnerabilities, missing auth checks, exposed secrets, injection risks
6. **Scalability** — Will this break under real load? N+1 queries? Missing indexes?
7. **Maintainability** — Will another developer understand and extend this?

Format your output as:

## Overall Verdict: [APPROVED ✓ | NEEDS REVISION ⚠ | REJECTED ✗]

## Critical Issues (blocking — must fix before proceeding)
- [issue]: [specific problem] → [recommended fix]

## Moderate Issues (important — should fix)
- [issue]: [specific problem] → [recommended fix]

## Minor Issues (polish)
- [issue]: [specific problem] → [recommended fix]

## What Was Done Well
(Be brief — focus on problems, not praise)

Be direct. Vague feedback is useless.`,
  },
  {
    id: 'fact_check',
    label: 'Fact Check',
    icon: '✅',
    color: '#22c55e',
    modelTier: 'frontier',
    webSearch: true,
    desc: 'Verify technical claims against live web sources',
    systemPrompt: `You are a rigorous Fact-Checker and Technical Verification Specialist.

Using the web search results provided, systematically verify the technical claims in the upstream outputs.

For each claim, classify as:
- ✓ **VERIFIED** — Confirmed accurate by search results (cite source)
- ? **UNVERIFIED** — Cannot confirm; insufficient evidence found
- ✗ **INCORRECT** — Factually wrong — state the correct information and source
- ⚠ **OUTDATED** — Was accurate but superseded; state current correct info
- ⚠ **MISLEADING** — Technically true but creates a false impression

Focus your verification on:
- Library/framework versions and whether they are current
- API endpoints and whether they still exist as described
- Security recommendations — are they current best practice or obsolete?
- Performance claims and benchmarks
- Availability of mentioned third-party services
- Licensing and pricing of tools mentioned
- Breaking changes in recent versions

## Summary
**Confidence Score**: X/10
**Verified Claims**: N
**Issues Found**: N
**Recommended Corrections**: [list]

Do not make up sources. If you cannot verify something from the search results, say so.`,
  },
];

// ─── AI Model Options ─────────────────────────────────────────────────────────
export const MODEL_OPTIONS = [
  { id: 'claude-opus',       label: 'Claude Opus',          provider: 'anthropic',   model: 'claude-opus-4-6',             tier: 'frontier', badge: '⚡', color: '#d97706' },
  { id: 'claude-sonnet',     label: 'Claude Sonnet',        provider: 'anthropic',   model: 'claude-sonnet-4-5-20250929',  tier: 'frontier', badge: '🔥', color: '#6366f1' },
  { id: 'gpt-4o',            label: 'GPT-4o',               provider: 'openai',      model: 'gpt-4o',                      tier: 'frontier', badge: '🌐', color: '#10b981' },
  { id: 'gpt-4o-mini',       label: 'GPT-4o Mini',          provider: 'openai',      model: 'gpt-4o-mini',                 tier: 'mid',      badge: '🌐', color: '#34d399' },
  { id: 'llama-70b',         label: 'Llama 70B (Groq)',     provider: 'groq',        model: 'llama-3.3-70b-versatile',     tier: 'mid',      badge: '🏎️', color: '#8b5cf6' },
  { id: 'llama-8b',          label: 'Llama 8B (Groq)',      provider: 'groq',        model: 'llama-3.1-8b-instant',        tier: 'local',    badge: '🏎️', color: '#a78bfa' },
  { id: 'ollama-llama',      label: 'Llama (Local)',         provider: 'ollama',      model: 'llama3.1',                    tier: 'local',    badge: '🏠', color: '#f97316' },
  { id: 'ollama-mistral',    label: 'Mistral (Local)',       provider: 'ollama',      model: 'mistral',                     tier: 'local',    badge: '🏠', color: '#ec4899' },
  { id: 'ollama-gemma',      label: 'Gemma (Local)',         provider: 'ollama',      model: 'gemma2',                      tier: 'local',    badge: '🏠', color: '#14b8a6' },
  { id: 'gemini-flash',      label: 'Gemini 2.0 Flash',     provider: 'gemini',      model: 'gemini-2.0-flash',            tier: 'frontier', badge: '✦',  color: '#4285f4' },
  { id: 'gemini-pro',        label: 'Gemini 1.5 Pro',       provider: 'gemini',      model: 'gemini-1.5-pro',              tier: 'frontier', badge: '✦',  color: '#34a853' },
  { id: 'openrouter-claude', label: 'Claude (OpenRouter)',   provider: 'openrouter',  model: 'anthropic/claude-sonnet-4-5', tier: 'frontier', badge: '🔀', color: '#7c3aed' },
  { id: 'deepseek-chat',     label: 'DeepSeek Chat',        provider: 'deepseek',    model: 'deepseek-chat',               tier: 'mid',      badge: '🤖', color: '#0891b2' },
  { id: 'deepseek-r1',       label: 'DeepSeek R1',          provider: 'deepseek',    model: 'deepseek-reasoner',           tier: 'frontier', badge: '🧠', color: '#0e7490' },
];

// Auto-select best available model for a tier
export function autoSelectModel(tier) {
  const priority = { frontier: 'claude-sonnet', mid: 'llama-70b', local: 'ollama-llama' };
  return priority[tier] || 'claude-sonnet';
}

// ─── Pipeline Templates ───────────────────────────────────────────────────────
export const PIPELINE_TEMPLATES = [
  {
    id: 'fullstack',
    label: 'Full-Stack App',
    icon: '🏗️',
    desc: 'Complete app with auth, payments, testing',
    nodes: ['requirements', 'db_schema', 'wireframes', 'api_contract', 'frontend', 'backend', 'auth', 'payments', 'tests', 'deploy'],
    edges: [
      ['requirements', 'api_contract'], ['requirements', 'wireframes'],
      ['db_schema', 'api_contract'], ['db_schema', 'backend'],
      ['wireframes', 'frontend'], ['api_contract', 'frontend'], ['api_contract', 'backend'],
      ['backend', 'auth'], ['backend', 'payments'],
      ['frontend', 'tests'], ['backend', 'tests'],
      ['tests', 'deploy'],
    ],
  },
  {
    id: 'landing',
    label: 'Landing Page',
    icon: '📄',
    desc: '5-node pipeline for marketing sites',
    nodes: ['requirements', 'wireframes', 'frontend', 'tests', 'deploy'],
    edges: [
      ['requirements', 'wireframes'], ['wireframes', 'frontend'],
      ['frontend', 'tests'], ['tests', 'deploy'],
    ],
  },
  {
    id: 'api_service',
    label: 'API Service',
    icon: '🔌',
    desc: 'Backend-focused: schema → API → auth → tests',
    nodes: ['requirements', 'db_schema', 'api_contract', 'backend', 'auth', 'tests', 'deploy'],
    edges: [
      ['requirements', 'db_schema'], ['requirements', 'api_contract'],
      ['db_schema', 'backend'], ['api_contract', 'backend'],
      ['backend', 'auth'], ['backend', 'tests'],
      ['auth', 'tests'], ['tests', 'deploy'],
    ],
  },
  {
    id: 'mvp',
    label: 'Rapid MVP',
    icon: '⚡',
    desc: 'Minimal viable: req → schema → API → frontend',
    nodes: ['requirements', 'db_schema', 'api_contract', 'frontend', 'backend'],
    edges: [
      ['requirements', 'db_schema'], ['requirements', 'api_contract'],
      ['db_schema', 'backend'], ['api_contract', 'frontend'], ['api_contract', 'backend'],
    ],
  },
  {
    id: 'research_first',
    label: 'Research-First',
    icon: '🌐',
    desc: 'Web research informs every decision',
    nodes: ['web_research', 'requirements', 'wireframes', 'api_contract', 'frontend', 'tests'],
    edges: [
      ['web_research', 'requirements'], ['web_research', 'api_contract'],
      ['requirements', 'wireframes'], ['wireframes', 'frontend'],
      ['api_contract', 'frontend'],
      ['frontend', 'tests'],
    ],
  },
  {
    id: 'reviewed',
    label: 'With Peer Review',
    icon: '🔍',
    desc: 'Full-stack + skeptical review + fact check',
    nodes: ['web_research', 'requirements', 'db_schema', 'api_contract', 'backend', 'frontend', 'tests', 'peer_review', 'fact_check'],
    edges: [
      ['web_research', 'requirements'],
      ['requirements', 'db_schema'], ['requirements', 'api_contract'],
      ['db_schema', 'backend'], ['api_contract', 'backend'], ['api_contract', 'frontend'],
      ['backend', 'tests'], ['frontend', 'tests'],
      ['tests', 'peer_review'],
      ['tests', 'fact_check'],
    ],
  },
];
