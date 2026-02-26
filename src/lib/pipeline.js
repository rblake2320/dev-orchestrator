import { callModel } from './api.js';
import { NODE_TEMPLATES, autoSelectModel } from './models.js';
import { classifyError, getFallbackChain, MAX_HEAL_ATTEMPTS } from './selfheal.js';
import { searchWeb, formatSearchResults } from './search.js';
import { getAgentById } from './settings.js';
import { callAgent, buildAgentPayload, sanitizeAgentOutput } from './agentCall.js';

/**
 * Topological sort of nodes respecting edges.
 * Returns array of "levels" — each level is an array of node IDs that can run in parallel.
 */
export function topologicalLevels(nodeIds, edges) {
  const inDeg = {};
  const adj = {};
  nodeIds.forEach((id) => { inDeg[id] = 0; adj[id] = []; });
  edges.forEach(([from, to]) => {
    if (adj[from] !== undefined && inDeg[to] !== undefined) {
      adj[from].push(to);
      inDeg[to]++;
    }
  });

  const levels = [];
  let queue = nodeIds.filter((id) => inDeg[id] === 0);
  const visited = new Set();

  while (queue.length > 0) {
    levels.push([...queue]);
    const next = [];
    queue.forEach((n) => {
      visited.add(n);
      (adj[n] || []).forEach((m) => {
        inDeg[m]--;
        if (inDeg[m] === 0 && !visited.has(m)) next.push(m);
      });
    });
    queue = next;
  }

  // Handle any remaining (cycle detection fallback)
  nodeIds.filter((id) => !visited.has(id)).forEach((id) => levels.push([id]));
  return levels;
}

/**
 * Compute grid layout positions from topological levels.
 */
export function computeLayout(nodeIds, edges) {
  const levels = topologicalLevels(nodeIds, edges);
  const positions = {};
  const CARD_W = 180;
  const CARD_H = 72;
  const GAP_X = 60;
  const GAP_Y = 48;
  const maxPerLevel = Math.max(...levels.map((l) => l.length), 1);
  const totalW = maxPerLevel * (CARD_W + GAP_X) - GAP_X;

  levels.forEach((level, li) => {
    const levelW = level.length * (CARD_W + GAP_X) - GAP_X;
    const offsetX = (totalW - levelW) / 2;
    level.forEach((id, ni) => {
      positions[id] = {
        x: offsetX + ni * (CARD_W + GAP_X),
        y: li * (CARD_H + GAP_Y),
      };
    });
  });

  return {
    positions,
    CARD_W,
    CARD_H,
    totalW,
    totalH: levels.length * (CARD_H + GAP_Y) - GAP_Y,
  };
}

/**
 * Resolve the NODE_TEMPLATE for a node — handles both legacy (id===templateId) and new (unique id + templateId).
 */
function resolveTemplate(node) {
  return NODE_TEMPLATES.find((t) => t.id === (node?.templateId || node?.id));
}

/**
 * Build the prompt for a node, injecting upstream context + optional web search results.
 */
async function buildNodePrompt(node, projectDesc, upstreamOutputs, edges, signal) {
  const template = resolveTemplate(node);
  if (!template) return { system: '', user: projectDesc };

  // Gather upstream outputs
  const upstreamIds = edges.filter(([, to]) => to === node.id).map(([from]) => from);
  let contextBlock = '';
  for (const uid of upstreamIds) {
    if (upstreamOutputs[uid]) {
      const upNode = { id: uid, templateId: uid };
      const uTemplate = resolveTemplate(upNode);
      contextBlock += `\n\n[BEGIN UPSTREAM DATA: ${uTemplate?.label || uid}]\n${upstreamOutputs[uid]}\n[END UPSTREAM DATA]`;
    }
  }

  // Web search injection for search-enabled nodes
  let searchBlock = '';
  if (template.webSearch) {
    const searchQuery = `${projectDesc} ${template.label} best practices`;
    try {
      const { results, error } = await searchWeb(searchQuery, signal);
      if (results.length > 0) {
        searchBlock = `\n\n--- Web Search Results ---\n${formatSearchResults(results, searchQuery)}`;
      } else if (error) {
        searchBlock = `\n\n[Web search unavailable: ${error}]`;
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
    }
  }

  const system = node.customPrompt || template.systemPrompt;
  let user = `PROJECT DESCRIPTION:\n${projectDesc}`;
  if (searchBlock) user += `\n\nWEB RESEARCH:${searchBlock}`;
  if (contextBlock) user += `\n\nUPSTREAM CONTEXT:${contextBlock}`;

  return { system, user };
}

/**
 * Run a single node with self-heal support. Used by both the main pipeline and the retry feature.
 */
async function runNode({ node, nodes, edges, projectDesc, outputs, signal, onStatusChange, onOutput, onLog, onChunk }) {
  const template = resolveTemplate(node);
  const modelId = node.model || autoSelectModel(template?.modelTier || 'mid');

  // ── Agent mode (if node has an agentId assigned) ──────────────────────────
  const agentConfig = node.agentId ? getAgentById(node.agentId) : null;
  if (agentConfig) {
    const payload = buildAgentPayload(node, nodes, edges, projectDesc, outputs);
    const progressCb = (msg) => onLog(`⏳ ${template?.label || node.id}: ${msg}`);
    try {
      const raw = await callAgent(agentConfig, payload.task, JSON.stringify(payload.upstreamContext), signal, progressCb);
      const result = sanitizeAgentOutput(raw);
      outputs[node.id] = result;
      onOutput(node.id, result);
      onStatusChange(node.id, 'done');
      onLog(`✓ ${template?.label || node.id} complete (via agent: ${agentConfig.label})`);
      return { healed: false, agentUsed: agentConfig.id };
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      onLog(`✗ Agent "${agentConfig.label}" failed: ${err.message.slice(0, 120)} — falling back to model`);
      // Fall through to callModel() self-heal chain
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { system, user } = await buildNodePrompt(node, projectDesc, outputs, edges, signal);

  const streamCallback = onChunk ? (chunk) => onChunk(node.id, chunk) : null;

  try {
    const result = await callModel(system, user, modelId, signal, streamCallback);
    outputs[node.id] = result;
    onOutput(node.id, result);
    onStatusChange(node.id, 'done');
    onLog(`✓ ${template?.label || node.id} complete`);
    return { healed: false, modelUsed: modelId };
  } catch (err) {
    if (err.name === 'AbortError') throw err;

    // ── Self-Heal Engine ──────────────────────────────────────────────────────
    const errorType = classifyError(err.message);
    const fallbacks = getFallbackChain(modelId, errorType).slice(0, MAX_HEAL_ATTEMPTS);

    const triedModels = [modelId];
    for (const fallbackModel of fallbacks) {
      if (signal?.aborted) throw new DOMException('Pipeline aborted', 'AbortError');
      onStatusChange(node.id, 'healing');
      onLog(`🔄 ${template?.label || node.id} → trying ${fallbackModel.label} (${errorType} error on ${modelId})`);

      try {
        // Healing uses non-streaming to simplify error recovery
        const result = await callModel(system, user, fallbackModel.id, signal, null);
        outputs[node.id] = result;
        onOutput(node.id, result);
        onStatusChange(node.id, 'done');
        onLog(`✓ ${template?.label || node.id} healed via ${fallbackModel.label}`);
        return { healed: true, modelUsed: fallbackModel.id };
      } catch (healErr) {
        if (healErr.name === 'AbortError') throw healErr;
        const healType = classifyError(healErr.message);
        onLog(`✗ ${fallbackModel.label} failed (${healType}): ${healErr.message.slice(0, 120)}`);
        triedModels.push(fallbackModel.id);
      }
    }
    // ── End Self-Heal ─────────────────────────────────────────────────────────

    const noFallbackHint = fallbacks.length === 0
      ? ' No configured fallback models — add API keys in ⚙️ Settings.'
      : ` Tried: ${triedModels.join(', ')}.`;
    const summary = `ERROR: ${err.message}\n\nSelf-heal exhausted.${noFallbackHint}\n\nClick this node → pick a different model → Retry.`;
    outputs[node.id] = summary;
    onOutput(node.id, summary);
    onStatusChange(node.id, 'error');
    onLog(`✗ ${template?.label || node.id} — all recovery attempts exhausted.${noFallbackHint}`);
    return { healed: false, modelUsed: null, failed: true };
  }
}

/**
 * Execute the full pipeline.
 *
 * Returns { outputs, modelsUsed }
 */
export async function executePipeline({
  nodes,
  edges,
  projectDesc,
  mode = 'dag',
  signal,
  onStatusChange,
  onOutput,
  onLog,
  onChunk,
}) {
  const outputs = {};
  const modelsUsed = {};
  const failedNodes = new Set();

  const nodeIds = nodes.map((n) => n.id);

  let executionLevels;
  if (mode === 'parallel') {
    executionLevels = [nodeIds];
  } else if (mode === 'sequential') {
    const sorted = topologicalLevels(nodeIds, edges).flat();
    executionLevels = sorted.map((id) => [id]);
  } else {
    executionLevels = topologicalLevels(nodeIds, edges);
  }

  nodes.forEach((n) => onStatusChange(n.id, 'waiting'));

  for (const level of executionLevels) {
    if (signal?.aborted) throw new DOMException('Pipeline aborted', 'AbortError');

    const skipped = [];
    const runnable = [];
    for (const nodeId of level) {
      if (mode !== 'parallel') {
        const upstreamDeps = edges.filter(([, to]) => to === nodeId).map(([from]) => from);
        if (upstreamDeps.some((id) => failedNodes.has(id))) {
          skipped.push(nodeId);
          continue;
        }
      }
      runnable.push(nodeId);
    }

    for (const nodeId of skipped) {
      failedNodes.add(nodeId);
      const node = nodes.find((n) => n.id === nodeId);
      const template = resolveTemplate(node || { id: nodeId });
      onStatusChange(nodeId, 'skipped');
      onLog(`⊘ ${template?.label || nodeId} skipped (upstream failed)`);
    }

    if (runnable.length === 0) continue;

    const parallelLabel = runnable.length > 1 ? ' (parallel)' : '';
    const names = runnable.map((id) => {
      const node = nodes.find((n) => n.id === id);
      return resolveTemplate(node || { id })?.label || id;
    }).join(', ');
    onLog(`▶ Running: ${names}${parallelLabel}`);

    runnable.forEach((id) => onStatusChange(id, 'running'));

    const promises = runnable.map(async (nodeId) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const result = await runNode({
        node, nodes, edges, projectDesc, outputs, signal,
        onStatusChange, onOutput, onLog, onChunk,
      });

      if (result.failed) {
        failedNodes.add(nodeId);
      }
      if (result.modelUsed) {
        modelsUsed[nodeId] = result.modelUsed;
      }
    });

    await Promise.all(promises);
  }

  onLog('🏁 Pipeline finished — all nodes complete');
  return { outputs, modelsUsed };
}

/**
 * Partial re-run: only execute nodes that previously failed/were skipped.
 * Seeds the internal outputs map from existingOutputs so successful nodes
 * are never re-run but their outputs remain available as upstream context.
 *
 * Returns { modelsUsed }
 */
export async function executePartialPipeline({
  nodes,
  edges,
  projectDesc,
  mode = 'dag',
  existingOutputs,   // outputs from prior successful runs (will not be re-executed)
  signal,
  onStatusChange,
  onOutput,
  onLog,
  onChunk,
}) {
  const outputs = { ...existingOutputs };
  const modelsUsed = {};
  const failedNodes = new Set();

  const nodeIds = nodes.map((n) => n.id);
  let executionLevels;
  if (mode === 'parallel') {
    executionLevels = [nodeIds];
  } else if (mode === 'sequential') {
    executionLevels = topologicalLevels(nodeIds, edges).flat().map((id) => [id]);
  } else {
    executionLevels = topologicalLevels(nodeIds, edges);
  }

  for (const level of executionLevels) {
    if (signal?.aborted) throw new DOMException('Pipeline aborted', 'AbortError');

    const skipped = [];
    const alreadyDone = [];
    const runnable = [];

    for (const nodeId of level) {
      const upstreamDeps = edges.filter(([, to]) => to === nodeId).map(([from]) => from);

      if (mode !== 'parallel' && upstreamDeps.some((id) => failedNodes.has(id))) {
        skipped.push(nodeId);
        continue;
      }

      // Node already succeeded — keep its output, mark done, don't re-run
      if (outputs[nodeId] !== undefined) {
        alreadyDone.push(nodeId);
        continue;
      }

      runnable.push(nodeId);
    }

    for (const nodeId of skipped) {
      failedNodes.add(nodeId);
      const node = nodes.find((n) => n.id === nodeId);
      const template = resolveTemplate(node || { id: nodeId });
      onStatusChange(nodeId, 'skipped');
      onLog(`⊘ ${template?.label || nodeId} skipped (upstream failed)`);
    }

    for (const nodeId of alreadyDone) {
      onStatusChange(nodeId, 'done');
    }

    if (runnable.length === 0) continue;

    const names = runnable.map((id) => {
      const node = nodes.find((n) => n.id === id);
      return resolveTemplate(node || { id })?.label || id;
    }).join(', ');
    onLog(`▶ Re-running: ${names}${runnable.length > 1 ? ' (parallel)' : ''}`);

    runnable.forEach((id) => onStatusChange(id, 'running'));

    const promises = runnable.map(async (nodeId) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const result = await runNode({
        node, nodes, edges, projectDesc, outputs, signal,
        onStatusChange, onOutput, onLog, onChunk,
      });

      if (result.failed) failedNodes.add(nodeId);
      if (result.modelUsed) modelsUsed[nodeId] = result.modelUsed;
    });

    await Promise.all(promises);
  }

  return { modelsUsed };
}

/**
 * Retry (regenerate) a single node with its current upstream context.
 * Supports self-heal and streaming.
 */
export async function retrySingleNode({
  node,
  nodes,
  edges,
  projectDesc,
  currentOutputs,
  signal,
  onStatusChange,
  onOutput,
  onLog,
  onChunk,
}) {
  onStatusChange(node.id, 'running');
  onLog(`↺ Regenerating: ${resolveTemplate(node)?.label || node.id}`);

  const outputs = { ...currentOutputs };

  const result = await runNode({
    node, nodes, edges, projectDesc, outputs, signal,
    onStatusChange, onOutput, onLog, onChunk,
  });

  return result;
}
