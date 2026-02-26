/**
 * Run History — persists a summary of each pipeline execution to localStorage.
 * Used for: bug reports, model performance patterns, improvement tracking.
 *
 * No outputs stored — only metadata + error info. Max 25 records.
 */

const HISTORY_KEY = 'devo_run_history';
const MAX_RECORDS  = 25;

/**
 * Save a completed run summary.
 * @param {object} record
 */
export function saveRunRecord(record) {
  try {
    const existing = getRunHistory();
    existing.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...record,
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(existing.slice(0, MAX_RECORDS)));
  } catch { /* storage full — silently drop */ }
}

export function getRunHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

export function clearRunHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

/**
 * Build a run record from pipeline result data.
 * Call this after executePipeline() resolves.
 */
export function buildRunRecord({
  projectDesc,
  nodes,
  edges,
  execMode,
  nodeStatuses,
  modelsUsed,
  executionLog,
  durationMs,
}) {
  const successNodes  = nodes.filter((n) => nodeStatuses[n.id] === 'done');
  const failedNodes   = nodes.filter((n) => nodeStatuses[n.id] === 'error');
  const skippedNodes  = nodes.filter((n) => nodeStatuses[n.id] === 'skipped');

  // Detect healed nodes — ran via fallback (log line contains '✓ ... healed via')
  const healedLabels = executionLog
    .filter((e) => e.msg.includes('healed via'))
    .map((e) => e.msg);

  // Unique error patterns from log
  const errorLines = executionLog.filter((e) => e.msg.startsWith('✗'));
  const errorPatterns = [...new Set(
    errorLines.map((e) => {
      if (e.msg.includes('auth'))       return 'auth_failure';
      if (e.msg.includes('rate_limit')) return 'rate_limit';
      if (e.msg.includes('unavailable'))return 'network';
      if (e.msg.includes('timeout'))    return 'timeout';
      if (e.msg.includes('server_error')) return 'server_error';
      return 'unknown';
    })
  )];

  return {
    projectDescShort: (projectDesc || '').slice(0, 120),
    execMode,
    totalNodes:  nodes.length,
    edgeCount:   edges.length,
    successCount: successNodes.length,
    failedCount:  failedNodes.length,
    skippedCount: skippedNodes.length,
    healCount:    healedLabels.length,
    nodeTypes:    nodes.map((n) => n.templateId || n.id),
    failedNodeTypes: failedNodes.map((n) => n.templateId || n.id),
    modelsUsed,
    errorPatterns,
    durationMs: Math.round(durationMs),
  };
}
