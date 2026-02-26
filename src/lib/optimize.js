import { callModel } from './api.js';
import { NODE_TEMPLATES, MODEL_OPTIONS } from './models.js';
import { getSettings } from './settings.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveTemplate(node) {
  return NODE_TEMPLATES.find((t) => t.id === (node?.templateId || node?.id));
}

/**
 * Returns MODEL_OPTIONS filtered to providers with API keys configured.
 * Ollama is always included (local, no key required).
 */
function getAvailableModels() {
  const settings = getSettings();
  return MODEL_OPTIONS.filter((m) => {
    if (m.provider === 'ollama') return true;
    const key = settings[`${m.provider}Key`] || '';
    return key.trim().length > 0;
  });
}

const OPTIMIZER_PREFERENCE = [
  'claude-sonnet', 'claude-opus', 'gpt-4o',
  'gemini-flash', 'gemini-pro', 'openrouter-claude',
  'deepseek-r1', 'deepseek-chat', 'llama-70b',
  'gpt-4o-mini', 'deepseek-chat', 'llama-8b',
  'ollama-llama', 'ollama-mistral', 'ollama-gemma',
];

/**
 * Pick the best available model to run the optimizer itself.
 */
export function getOptimizerModel() {
  const available = getAvailableModels();
  if (available.length === 0) return null;
  for (const id of OPTIMIZER_PREFERENCE) {
    if (available.find((m) => m.id === id)) return id;
  }
  return available[0]?.id || null;
}

/**
 * Call the optimizer with automatic fallback through all available models.
 * If gpt-4o is configured but returns 403/404, it will try the next model automatically.
 */
async function callOptimizerWithFallback(system, user, signal, onProgress) {
  const available = getAvailableModels();
  if (available.length === 0) {
    throw new Error('No AI model configured — add an API key in ⚙️ Settings first');
  }

  // Build ordered list: preferred models first, then any remaining available
  const ordered = [];
  for (const id of OPTIMIZER_PREFERENCE) {
    if (available.find((m) => m.id === id)) ordered.push(id);
  }
  for (const m of available) {
    if (!ordered.includes(m.id)) ordered.push(m.id);
  }

  let lastErr;
  for (const modelId of ordered) {
    if (signal?.aborted) throw new DOMException('Pipeline aborted', 'AbortError');
    const label = MODEL_OPTIONS.find((m) => m.id === modelId)?.label || modelId;
    onProgress?.(`🧠 Analyzing with ${label}…`);
    try {
      return { raw: await callModel(system, user, modelId, signal, null), modelId };
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      lastErr = err;
      // 4xx on this model — try the next one
    }
  }
  throw lastErr || new Error('All configured models failed');
}

function buildNodeList(nodes, edges) {
  return nodes.map((node) => {
    const tmpl = resolveTemplate(node);
    const upstream = edges
      .filter(([, to]) => to === node.id)
      .map(([from]) => {
        const up = nodes.find((n) => n.id === from);
        return resolveTemplate(up || { id: from })?.label || from;
      });
    const downstream = edges
      .filter(([from]) => from === node.id)
      .map(([, to]) => {
        const dn = nodes.find((n) => n.id === to);
        return resolveTemplate(dn || { id: to })?.label || to;
      });
    const parts = [
      `- id="${node.id}" type="${tmpl?.id || node.id}" label="${node.customLabel || tmpl?.label}" tier=${tmpl?.modelTier || 'mid'}${tmpl?.webSearch ? ' [web-search]' : ''}`,
    ];
    if (node.model)        parts.push(`  current-model=${node.model}`);
    if (upstream.length)   parts.push(`  currently receives from: ${upstream.join(', ')}`);
    if (downstream.length) parts.push(`  currently feeds into: ${downstream.join(', ')}`);
    return parts.join('\n');
  }).join('\n');
}

function buildAvailableModelsList() {
  return getAvailableModels()
    .map((m) => `- ${m.id}: ${m.label} (${m.provider}, tier:${m.tier})`)
    .join('\n');
}

/**
 * Robust JSON extractor — handles markdown fences, leading/trailing prose,
 * and nested JSON objects. Returns the first valid top-level JSON object.
 */
function extractJson(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Empty response from optimizer');

  // 1. Fenced code block (```json ... ``` or ``` ... ```)
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }

  // 2. Walk the string to find the outermost balanced { } object
  let depth = 0;
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (raw[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          return JSON.parse(raw.slice(start, i + 1));
        } catch {
          // Malformed — reset and keep looking
          start = -1;
        }
      }
    }
  }

  throw new Error(`Optimizer returned non-JSON. Preview: "${raw.slice(0, 300)}"`);
}

// ─── Edge validation helper ───────────────────────────────────────────────────

/**
 * Given a raw edges value from the optimizer response and current node list,
 * return only valid [fromId, toId] pairs where both IDs exist and there's no cycle risk.
 */
function validateEdges(rawEdges, nodes) {
  if (!Array.isArray(rawEdges)) return null;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const valid = rawEdges
    .filter((e) => Array.isArray(e) && e.length >= 2)
    .map((e) => [String(e[0]), String(e[1])])
    .filter(([from, to]) => nodeIds.has(from) && nodeIds.has(to) && from !== to);
  return valid;
}

// ─── Pre-run Pipeline Optimizer ───────────────────────────────────────────────

/**
 * Analyzes nodes, edges, and project description.
 * Returns optimal model assignments AND optimal edge connections.
 *
 * Returns: {
 *   strategy: string,
 *   connectionRationale: string,
 *   nodes: { [nodeId]: { model: string|null, reason: string } },
 *   edges: [[fromId, toId], ...]   ← complete desired edge list
 * }
 */
export async function optimizePipeline({ nodes, edges, projectDesc, signal, onProgress }) {

  const system = `You are an expert AI pipeline architect. Given a set of pipeline nodes and a project description, you do two things:

1. CONNECT the nodes: design the optimal DAG by specifying which nodes feed into which.
2. ASSIGN models: pick the best available AI model for each node.

═══ CONNECTION RULES ═══
- Requirements → DB Schema, API Contract, UI Wireframes (requirements informs all design)
- Web Research → Requirements (research grounds the requirements)
- DB Schema → Backend Code, API Contract (schema drives implementation)
- API Contract → Frontend Code, Backend Code (contract drives both sides)
- UI Wireframes → Frontend Code (wireframes drive UI implementation)
- Backend Code → Auth & Security (auth wraps the server)
- Backend Code + Frontend Code → Tests (test both sides)
- Tests → Deployment (deploy after tests pass)
- Backend / Frontend / Auth → Peer Review (review the code outputs)
- Any content node → Fact Check (verify any output)
- NEVER create cycles (A→B and B→A is forbidden)
- If a node type has no natural dependency on others, leave it as a root (no incoming edges)
- Custom / unknown node types: use the node's label to infer its role and place it logically

═══ MODEL ASSIGNMENT RULES ═══
- FRONTIER (claude-sonnet, claude-opus, gpt-4o, gemini-flash, openrouter-claude, deepseek-r1): code generation, security, architecture, peer review, payments
- MID (llama-70b, gpt-4o-mini, deepseek-chat): requirements, schemas, documentation, tests, research synthesis
- LOCAL (llama-8b, ollama-*): deployment configs, simple templating only
- Assign null for model if the node's default auto-selection is already correct
- Nodes with many dependents need higher quality

You MUST respond with ONLY a valid JSON object — no markdown, no prose, no explanation outside the JSON.`;

  const user = `PROJECT: ${projectDesc || '(no description provided — use node types to infer)'}

PIPELINE NODES (use exact id values in your response):
${buildNodeList(nodes, edges)}

CURRENT EDGES (you may keep, change, or replace these entirely):
${edges.length > 0 ? edges.map(([f, t]) => `  ["${f}", "${t}"]`).join('\n') : '  (none — no edges defined yet)'}

AVAILABLE MODELS:
${buildAvailableModelsList()}

Respond with this EXACT JSON structure (no other text):
{
  "strategy": "<one sentence: overall model assignment rationale>",
  "connectionRationale": "<one sentence: why you designed these connections>",
  "nodes": {
    "<exact-node-id>": { "model": "<model-id or null>", "reason": "<brief>" }
  },
  "edges": [
    ["<from-node-id>", "<to-node-id>"]
  ]
}

RULES:
- Include EVERY node id in "nodes"
- "edges" must be the COMPLETE desired edge list (not just additions) — use [] if no edges make sense
- Use ONLY the exact id values shown in PIPELINE NODES above`;

  const { raw } = await callOptimizerWithFallback(system, user, signal, onProgress);
  const result = extractJson(raw);

  // Validate and attach cleaned edges
  if (result.edges !== undefined) {
    result.edges = validateEdges(result.edges, nodes);
  }

  return result;
}

// ─── Post-failure Auto-Fix ────────────────────────────────────────────────────

/**
 * Diagnoses failed/skipped nodes and prescribes fixes (model swaps + prompt additions).
 *
 * Returns: { summary: string, fixes: { [nodeId]: { model, promptAddition, reason } } }
 */
export async function autoFixPipeline({
  nodes, edges, projectDesc, nodeStatuses, outputs, executionLog, signal, onProgress,
}) {
  onProgress?.(`🔧 Diagnosing failures…`);

  const failureCtx = nodes.map((node) => {
    const tmpl = resolveTemplate(node);
    const status = nodeStatuses[node.id] || 'idle';
    const output = outputs[node.id] || '';
    if (status !== 'error' && status !== 'skipped') return null;
    return [
      `Node: "${node.customLabel || tmpl?.label}" (id: ${node.id})`,
      `  Status: ${status.toUpperCase()}`,
      `  Current model: ${node.model || 'auto'}`,
      `  Output snippet: ${output.slice(0, 400)}`,
    ].join('\n');
  }).filter(Boolean).join('\n\n');

  const logCtx = executionLog.slice(-40).map((e) => `[${e.time}] ${e.msg}`).join('\n');

  const system = `You are an expert AI pipeline debugger. Diagnose failed nodes and prescribe targeted fixes.

Rules:
- "401" / "auth" / "Unauthorized" → different provider
- "429" / "rate_limit" / "quota" → different provider
- "500" / "overloaded" → more reliable model
- "context_length" / "too many tokens" → larger context model (claude-sonnet, gpt-4o)
- Skipped nodes → fix their failed upstream dependency
- Empty/garbled output → frontier model + promptAddition

For promptAddition: SHORT instruction to append. Empty string if not needed.
You MUST respond with ONLY valid JSON — no markdown, no prose outside the JSON.`;

  const user = `PROJECT: ${projectDesc || '(no description)'}

PIPELINE NODES:
${buildNodeList(nodes, edges)}

FAILED / SKIPPED NODES:
${failureCtx || '(none)'}

EXECUTION LOG (last 40):
${logCtx || '(empty)'}

AVAILABLE MODELS:
${buildAvailableModelsList()}

Respond with ONLY this JSON:
{
  "summary": "<root cause and fix strategy>",
  "fixes": {
    "<exact-node-id>": { "model": "<model-id or null>", "promptAddition": "<instruction or empty>", "reason": "<brief>" }
  }
}

Only include nodes that need changes. Include ALL failed/skipped nodes.`;

  const { raw } = await callOptimizerWithFallback(system, user, signal, onProgress);
  return extractJson(raw);
}
