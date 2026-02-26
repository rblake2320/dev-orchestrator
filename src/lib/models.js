// ─── Node Templates ─────────────────────────────────────────────────────
// Each template defines a generation step in the software pipeline
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
    systemPrompt: `You are a Database Architect. Design a complete database schema:
- Table definitions with columns, types, constraints
- Relationships (FK, junction tables)
- Indexes for query performance
- Migration SQL (PostgreSQL)
- Seed data examples

Respond with SQL DDL and explanatory notes.`,
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
];

// ─── AI Model Options ───────────────────────────────────────────────────
export const MODEL_OPTIONS = [
  { id: 'claude-opus',    label: 'Claude Opus',         provider: 'anthropic', model: 'claude-opus-4-6',          tier: 'frontier', badge: '⚡', color: '#d97706' },
  { id: 'claude-sonnet',  label: 'Claude Sonnet',       provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', tier: 'frontier', badge: '🔥', color: '#6366f1' },
  { id: 'gpt-4o',         label: 'GPT-4o',              provider: 'openai',    model: 'gpt-4o',                   tier: 'frontier', badge: '🌐', color: '#10b981' },
  { id: 'gpt-4o-mini',    label: 'GPT-4o Mini',         provider: 'openai',    model: 'gpt-4o-mini',              tier: 'mid',      badge: '🌐', color: '#34d399' },
  { id: 'llama-70b',      label: 'Llama 70B (Groq)',    provider: 'groq',      model: 'llama-3.3-70b-versatile',  tier: 'mid',      badge: '🏎️', color: '#8b5cf6' },
  { id: 'ollama-llama',   label: 'Llama (Local)',        provider: 'ollama',    model: 'llama3.1',                 tier: 'local',    badge: '🏠', color: '#f97316' },
  { id: 'ollama-mistral', label: 'Mistral (Local)',      provider: 'ollama',    model: 'mistral',                  tier: 'local',    badge: '🏠', color: '#ec4899' },
  { id: 'ollama-gemma',   label: 'Gemma (Local)',        provider: 'ollama',    model: 'gemma2',                   tier: 'local',    badge: '🏠', color: '#14b8a6' },
];

// Auto-select best model for a tier
export function autoSelectModel(tier) {
  const priority = { frontier: 'claude-sonnet', mid: 'llama-70b', local: 'ollama-llama' };
  return priority[tier] || 'claude-sonnet';
}

// ─── Pipeline Templates ─────────────────────────────────────────────────
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
];
