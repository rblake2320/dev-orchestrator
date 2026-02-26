import { callModel } from './api.js';
import { NODE_TEMPLATES, MODEL_OPTIONS } from './models.js';
import { getSettings } from './settings.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveTemplate(node) {
  return NODE_TEMPLATES.find((t) => t.id === (node?.templateId || node?.id));
}

/**
 * Returns MODEL_OPTIONS filtered to providers that have API keys configured.
 * Ollama is always included (local, no key required).
 */
function getAvailableModels() {
  const settings = getSettings();
  return MODEL_OPTIONS.filter((m) => {
    if (m.provider === 'ollama') return true;
    const key = settings[`${m.provider}_key`] || '';
    return key.trim().length > 0;
  });
}

/**
 * Pick the best available model to run the optimizer itself.
 * Prefers frontier models; falls back to whatever is available.
 */
export function getOptimizerModel() {
  const available = getAvailableModels();
  const preferredIds = [
    'claude-sonnet', 'claude-opus', 'gpt-4o',
    'gemini-flash', 'gemini-pro', 'openrouter-claude',
    'deepseek-r1', 'deepseek-chat', 'llama-70b',
  ];
  for (const id of preferredIds) {
    if (available.find((m) => m.id === id)) return id;
  }
  return available[0]?.id || 'llama-70b';
}

function buildPipelineContext(nodes, edges) {
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
      `- "${node.customLabel || tmpl?.label}" (id: ${node.id}, type: ${tmpl?.id || node.id}, tier: ${tmpl?.modelTier || 'mid'})`,
    ];
    if (upstream.length)   parts.push(`  Receives from: ${upstream.join(', ')}`);
    if (downstream.length) parts.push(`  Feeds into: ${downstream.join(', ')}`);
    if (node.model)        parts.push(`  Current override: ${node.model}`);
    if (tmpl?.webSearch)   parts.push(`  Uses web search`);
    return parts.join('\n');
  }).join('\n');
}

function buildAvailableModelsList() {
  return getAvailableModels()
    .map((m) => `- ${m.id}: ${m.label} (${m.provider}, tier: ${m.tier})`)
    .join('\n');
}

function extractJson(raw) {
  // Handle markdown fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return JSON.parse(fenced[1].trim());
  // Bare JSON object
  const bare = raw.match(/\{[\s\S]*\}/);
  if (bare) return JSON.parse(bare[0]);
  throw new Error('No JSON found in optimizer response');
}

// ─── Pre-run Pipeline Optimizer ───────────────────────────────────────────────

/**
 * Analyzes the pipeline + project description + available models,
 * then recommends the optimal model for every node.
 *
 * Returns: { strategy: string, nodes: { [nodeId]: { model: string|null, reason: string } } }
 */
export async function optimizePipeline({ nodes, edges, projectDesc, signal, onProgress }) {
  const modelId = getOptimizerModel();
  const modelLabel = MODEL_OPTIONS.find((m) => m.id === modelId)?.label || modelId;
  onProgress?.(`🧠 Analyzing with ${modelLabel}…`);

  const system = `You are an expert AI pipeline optimizer. You assign optimal AI models to each node in a development pipeline DAG to maximize output quality and success probability.

Model assignment guidelines:
- FRONTIER tier (claude-sonnet, claude-opus, gpt-4o, gemini-flash, openrouter-claude, deepseek-r1): for complex tasks — code generation, security, architecture, payments, peer review, fact checking
- MID tier (llama-70b, gpt-4o-mini, deepseek-chat, llama-70b): for analytical tasks — requirements, schemas, documentation, tests
- LOCAL/FAST tier (llama-8b, ollama-*): only for structured, low-complexity tasks — deployment configs, simple templating
- Groq models (llama-70b, llama-8b) are fast and free — prefer them for mid-tier tasks when available
- Nodes with many downstream dependents need higher quality outputs
- Assign null when the node's default auto-selection is already optimal
- Web-search nodes benefit from models good at synthesizing diverse sources

You MUST respond with ONLY valid JSON — no markdown fences, no prose outside the JSON object.`;

  const user = `PROJECT: ${projectDesc}

PIPELINE NODES:
${buildPipelineContext(nodes, edges)}

AVAILABLE MODELS:
${buildAvailableModelsList()}

Respond with this exact JSON structure:
{
  "strategy": "<one sentence: overall optimization rationale>",
  "nodes": {
    "<exact-node-id>": { "model": "<model-id or null>", "reason": "<brief reason>" }
  }
}

Include EVERY node ID. Use null for model if default auto-selection is already optimal.`;

  const raw = await callModel(system, user, modelId, signal, null);
  return extractJson(raw);
}

// ─── Post-failure Auto-Fix ────────────────────────────────────────────────────

/**
 * Analyzes failed/skipped nodes, execution logs, and current config,
 * then prescribes specific model swaps and prompt additions.
 *
 * Returns: { summary: string, fixes: { [nodeId]: { model: string|null, promptAddition: string, reason: string } } }
 */
export async function autoFixPipeline({
  nodes, edges, projectDesc, nodeStatuses, outputs, executionLog, signal, onProgress,
}) {
  const modelId = getOptimizerModel();
  const modelLabel = MODEL_OPTIONS.find((m) => m.id === modelId)?.label || modelId;
  onProgress?.(`🔧 Diagnosing failures with ${modelLabel}…`);

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

  const system = `You are an expert AI pipeline debugger. You diagnose failed pipeline nodes and prescribe targeted fixes.

Diagnostic rules:
- "401" / "auth" / "Unauthorized" → switch to a model from a DIFFERENT provider
- "429" / "rate_limit" / "quota" → switch to a model on a DIFFERENT provider
- "500" / "server_error" / "overloaded" → switch to a more reliable model (different provider)
- "context_length" / "too many tokens" → switch to a model with larger context (claude-sonnet, gpt-4o)
- Skipped nodes → their upstream dependencies likely caused the chain; fix the upstream
- Poor output (empty or garbled) → try a frontier model and/or add a promptAddition

For promptAddition: write a SHORT, specific instruction to append to the node's prompt that directly addresses the likely failure cause. Leave as empty string if not needed.

You MUST respond with ONLY valid JSON — no markdown fences, no prose outside the JSON object.`;

  const user = `PROJECT: ${projectDesc}

PIPELINE NODES:
${buildPipelineContext(nodes, edges)}

FAILED / SKIPPED NODES:
${failureCtx || '(none — all nodes succeeded)'}

EXECUTION LOG (last 40 entries):
${logCtx || '(no log entries)'}

AVAILABLE MODELS:
${buildAvailableModelsList()}

Respond with this exact JSON structure:
{
  "summary": "<one sentence: root cause and fix strategy>",
  "fixes": {
    "<exact-node-id>": { "model": "<model-id or null>", "promptAddition": "<extra instruction or empty string>", "reason": "<brief reason>" }
  }
}

Only include nodes in "fixes" that actually need a change. Include ALL failed and skipped nodes.`;

  const raw = await callModel(system, user, modelId, signal, null);
  return extractJson(raw);
}
