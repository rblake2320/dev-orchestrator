import { callModel } from './api.js';
import { NODE_TEMPLATES, autoSelectModel } from './models.js';
import { classifyError, getFallbackChain, MAX_HEAL_ATTEMPTS } from './selfheal.js';

/**
 * Topological sort of nodes respecting edges.
 * Returns array of "levels" — each level is an array of node IDs that can run in parallel.
 */
export function topologicalLevels(nodeIds, edges) {
  const inDeg = {};
  const adj = {};
  nodeIds.forEach((id) => {
    inDeg[id] = 0;
    adj[id] = [];
  });
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
  nodeIds
    .filter((id) => !visited.has(id))
    .forEach((id) => levels.push([id]));

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
 * Build the prompt for a node, injecting upstream context.
 */
function buildNodePrompt(node, projectDesc, upstreamOutputs, edges) {
  const template = NODE_TEMPLATES.find((t) => t.id === node.templateId);
  if (!template) return { system: '', user: projectDesc };

  // Gather upstream outputs
  const upstreamIds = edges
    .filter(([, to]) => to === node.id)
    .map(([from]) => from);

  let contextBlock = '';
  for (const uid of upstreamIds) {
    if (upstreamOutputs[uid]) {
      const uTemplate = NODE_TEMPLATES.find((t) => t.id === uid);
      contextBlock += `\n\n--- ${uTemplate?.label || uid} Output ---\n${upstreamOutputs[uid]}`;
    }
  }

  const system = node.customPrompt || template.systemPrompt;
  const user = contextBlock
    ? `PROJECT DESCRIPTION:\n${projectDesc}\n\nUPSTREAM CONTEXT:${contextBlock}`
    : `PROJECT DESCRIPTION:\n${projectDesc}`;

  return { system, user };
}

/**
 * Execute the full pipeline.
 *
 * @param {Object} params
 * @param {Array} params.nodes - Pipeline nodes [{id, templateId, model, customPrompt}]
 * @param {Array} params.edges - Dependency edges [[fromId, toId], ...]
 * @param {string} params.projectDesc - The user's project description
 * @param {string} params.mode - 'dag' | 'parallel' | 'sequential'
 * @param {AbortSignal} params.signal - Abort signal
 * @param {Function} params.onStatusChange - (nodeId, status) => void
 * @param {Function} params.onOutput - (nodeId, output) => void
 * @param {Function} params.onLog - (message) => void
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
}) {
  const outputs = {};
  const failedNodes = new Set(); // tracks errored + skipped nodes for propagation

  // Determine execution order based on mode
  let executionLevels;
  const nodeIds = nodes.map((n) => n.id);

  if (mode === 'parallel') {
    // All nodes in a single level — fire simultaneously
    executionLevels = [nodeIds];
  } else if (mode === 'sequential') {
    // Each node in its own level — strict serial
    const sorted = topologicalLevels(nodeIds, edges).flat();
    executionLevels = sorted.map((id) => [id]);
  } else {
    // DAG mode — respect dependency graph, parallelize within levels
    executionLevels = topologicalLevels(nodeIds, edges);
  }

  // Set all nodes to waiting
  nodes.forEach((n) => onStatusChange(n.id, 'waiting'));

  for (const level of executionLevels) {
    if (signal?.aborted) throw new DOMException('Pipeline aborted', 'AbortError');

    // In DAG/sequential modes: skip nodes whose upstream dependency failed
    const skipped = [];
    const runnable = [];
    for (const nodeId of level) {
      if (mode !== 'parallel') {
        const upstreamDeps = edges
          .filter(([, to]) => to === nodeId)
          .map(([from]) => from);
        if (upstreamDeps.some((id) => failedNodes.has(id))) {
          skipped.push(nodeId);
          continue;
        }
      }
      runnable.push(nodeId);
    }

    // Mark skipped nodes and propagate failure
    for (const nodeId of skipped) {
      failedNodes.add(nodeId);
      const template = NODE_TEMPLATES.find((t) => t.id === nodeId);
      onStatusChange(nodeId, 'skipped');
      onLog(`⊘ ${template?.label || nodeId} skipped (upstream failed)`);
    }

    if (runnable.length === 0) continue;

    const parallelLabel = runnable.length > 1 ? ' (parallel)' : '';
    const names = runnable
      .map((id) => NODE_TEMPLATES.find((t) => t.id === id)?.label || id)
      .join(', ');
    onLog(`▶ Running: ${names}${parallelLabel}`);

    // Mark running
    runnable.forEach((id) => onStatusChange(id, 'running'));

    // Execute all runnable nodes in this level concurrently
    const promises = runnable.map(async (nodeId) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const template = NODE_TEMPLATES.find((t) => t.id === node.templateId);
      const modelId = node.model || autoSelectModel(template?.modelTier || 'mid');
      const { system, user } = buildNodePrompt(node, projectDesc, outputs, edges);

      try {
        const result = await callModel(system, user, modelId, signal);
        outputs[nodeId] = result;
        onOutput(nodeId, result);
        onStatusChange(nodeId, 'done');
        onLog(`✓ ${template?.label || nodeId} complete`);
      } catch (err) {
        if (err.name === 'AbortError') throw err;

        // ── Self-Heal Engine ────────────────────────────────────────────
        // Classify the failure, find fallback models, and retry before
        // permanently marking this node (and its downstream) as failed.
        const errorType = classifyError(err.message);
        const fallbacks = getFallbackChain(modelId, errorType).slice(0, MAX_HEAL_ATTEMPTS);
        let healed = false;

        for (const fallbackModel of fallbacks) {
          if (signal?.aborted) throw new DOMException('Pipeline aborted', 'AbortError');

          onStatusChange(nodeId, 'healing');
          onLog(`🔄 ${template?.label || nodeId} → trying ${fallbackModel.label} (${errorType} error on ${modelId})`);

          try {
            const result = await callModel(system, user, fallbackModel.id, signal);
            outputs[nodeId] = result;
            onOutput(nodeId, result);
            onStatusChange(nodeId, 'done');
            onLog(`✓ ${template?.label || nodeId} healed via ${fallbackModel.label}`);
            healed = true;
            break;
          } catch (healErr) {
            if (healErr.name === 'AbortError') throw healErr;
            const healType = classifyError(healErr.message);
            onLog(`✗ ${fallbackModel.label} failed (${healType}): ${healErr.message.slice(0, 120)}`);
          }
        }

        if (!healed) {
          failedNodes.add(nodeId);
          const summary = `ERROR: ${err.message}`;
          outputs[nodeId] = summary;
          onOutput(nodeId, summary);
          onStatusChange(nodeId, 'error');
          onLog(`✗ ${template?.label || nodeId} — all recovery attempts exhausted`);
        }
        // ── End Self-Heal ───────────────────────────────────────────────
      }
    });

    await Promise.all(promises);
  }

  onLog('🏁 Pipeline finished — all nodes complete');
  return outputs;
}
