import { NODE_TEMPLATES } from './models.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveTemplate(node) {
  return NODE_TEMPLATES.find((t) => t.id === (node?.templateId || node?.id));
}

// ─── Sandboxed Payload Builder ────────────────────────────────────────────────

/**
 * Constructs a frozen, minimal payload for the agent.
 * Only includes current project data + direct upstream outputs.
 * Explicitly excludes: API keys, settings, other pipelines, non-ancestor outputs.
 */
export function buildAgentPayload(node, nodes, edges, projectDesc, outputs) {
  const template = resolveTemplate(node);

  const upstreamIds = edges.filter(([, to]) => to === node.id).map(([from]) => from);
  const upstreamContext = {};
  for (const uid of upstreamIds) {
    if (outputs[uid]) {
      const uNode = nodes.find((n) => n.id === uid);
      const uTmpl = resolveTemplate(uNode || { id: uid });
      upstreamContext[uTmpl?.label || uid] = outputs[uid];
    }
  }

  return Object.freeze({
    task: node.customPrompt || template?.systemPrompt || '',
    projectDescription: projectDesc,
    nodeLabel: node.customLabel || template?.label || node.id,
    nodeType: template?.id || node.id,
    upstreamContext,
  });
}

// ─── Response Sanitization ────────────────────────────────────────────────────

/**
 * Sanitize agent output: strip prompt injection patterns, enforce 100KB size cap.
 */
export function sanitizeAgentOutput(text) {
  if (typeof text !== 'string') text = String(text || '');
  if (text.length > 102400) text = text.slice(0, 102400) + '\n\n[Output truncated at 100KB]';
  return text
    .replace(/---\s*SYSTEM\s*---/gi, '[REDACTED]')
    .replace(/<\|system\|>/gi, '[REDACTED]')
    .replace(/<\|assistant\|>/gi, '[REDACTED]')
    .replace(/<\|user\|>/gi, '[REDACTED]')
    .replace(/\[INST\]/gi, '[REDACTED]')
    .replace(/\[\/INST\]/gi, '[REDACTED]');
}

// ─── Protocol Adapters ────────────────────────────────────────────────────────

async function callHttpSimple(agentConfig, task, context, signal, onProgress) {
  const headers = { 'Content-Type': 'application/json' };
  if (agentConfig.bearerToken) headers.Authorization = `Bearer ${agentConfig.bearerToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), agentConfig.timeoutMs || 120000);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(timeoutId); controller.abort(); });

  onProgress?.('Sending task to HTTP agent…');

  try {
    const res = await fetch(agentConfig.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ task, context }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const body = await res.json().catch(async () => ({ result: await res.text() }));
    return body.result ?? body.output ?? body.content ?? body.message ?? JSON.stringify(body);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenAIAssistant(agentConfig, task, context, signal, onProgress) {
  const { apiKey, assistantId } = agentConfig;
  const base = 'https://api.openai.com/v1';
  const h = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'OpenAI-Beta': 'assistants=v2',
  };

  onProgress?.('Creating assistant thread…');
  const threadRes = await fetch(`${base}/threads`, { method: 'POST', headers: h, signal });
  if (!threadRes.ok) throw new Error(`Thread creation failed: HTTP ${threadRes.status}`);
  const { id: threadId } = await threadRes.json();

  const msgRes = await fetch(`${base}/threads/${threadId}/messages`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ role: 'user', content: `${task}\n\nContext:\n${context}` }),
    signal,
  });
  if (!msgRes.ok) throw new Error(`Message add failed: HTTP ${msgRes.status}`);

  const runRes = await fetch(`${base}/threads/${threadId}/runs`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ assistant_id: assistantId }),
    signal,
  });
  if (!runRes.ok) throw new Error(`Run creation failed: HTTP ${runRes.status}`);
  const { id: runId } = await runRes.json();

  const deadline = Date.now() + (agentConfig.timeoutMs || 120000);
  let status = 'queued';
  while (status === 'queued' || status === 'in_progress') {
    if (Date.now() > deadline) throw new Error(`Agent timeout after ${(agentConfig.timeoutMs || 120000) / 1000}s`);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(`${base}/threads/${threadId}/runs/${runId}`, { headers: h, signal });
    if (!pollRes.ok) throw new Error(`Run poll failed: HTTP ${pollRes.status}`);
    ({ status } = await pollRes.json());
    onProgress?.(`Assistant: ${status}…`);
  }
  if (status !== 'completed') throw new Error(`Assistant run ended with status: ${status}`);

  const msgsRes = await fetch(`${base}/threads/${threadId}/messages?order=desc&limit=1`, { headers: h, signal });
  if (!msgsRes.ok) throw new Error(`Messages fetch failed: HTTP ${msgsRes.status}`);
  const { data } = await msgsRes.json();
  const msg = data?.find((m) => m.role === 'assistant');
  if (!msg) throw new Error('No assistant response in thread');
  const part = msg.content?.[0];
  return part?.type === 'text' ? part.text.value : JSON.stringify(msg.content);
}

function openWS(wsEndpoint, payload, timeoutMs, signal) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(wsEndpoint);
    } catch (e) {
      reject(new Error(`Cannot connect to ${wsEndpoint}: ${e.message}`));
      return;
    }

    const timeout = setTimeout(() => {
      try { ws.close(); } catch (_) {}
      reject(new Error(`Agent timeout after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        try { ws.close(); } catch (_) {}
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }

    ws.onopen = () => ws.send(JSON.stringify(payload));

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const result = data.result ?? data.output ?? data.content ?? data.message;
        if (result !== undefined) {
          clearTimeout(timeout);
          try { ws.close(); } catch (_) {}
          resolve(typeof result === 'string' ? result : JSON.stringify(result));
        }
      } catch (_) { /* wait for next message */ }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error connecting to ${wsEndpoint}`));
    };

    ws.onclose = (e) => {
      if (!e.wasClean) {
        clearTimeout(timeout);
        reject(new Error(`WebSocket closed unexpectedly (code ${e.code})`));
      }
    };
  });
}

async function callOpenClawGateway(agentConfig, task, context, signal, onProgress) {
  onProgress?.('Connecting to OpenClaw Gateway…');
  const taskId = crypto.randomUUID();
  return openWS(
    agentConfig.wsEndpoint,
    { method: 'sessions_send', id: taskId, params: { message: `${task}\n\nContext:\n${context}` } },
    agentConfig.timeoutMs || 120000,
    signal,
  );
}

async function callWebSocketAgent(agentConfig, task, context, signal, onProgress) {
  onProgress?.('Connecting to WebSocket agent…');
  const taskId = crypto.randomUUID();
  return openWS(
    agentConfig.wsEndpoint,
    { task, context, taskId },
    agentConfig.timeoutMs || 120000,
    signal,
  );
}

// ─── Core callAgent ───────────────────────────────────────────────────────────

/**
 * Call an external agent and return its output as a string.
 *
 * @param {object}   agentConfig - from getAgentById()
 * @param {string}   task        - system/task instruction
 * @param {string}   context     - upstream context (JSON string)
 * @param {AbortSignal} signal
 * @param {function} onProgress  - (msg: string) => void
 * @returns {Promise<string>}
 */
export async function callAgent(agentConfig, task, context, signal, onProgress) {
  const { protocol } = agentConfig;
  if (protocol === 'http_simple')      return callHttpSimple(agentConfig, task, context, signal, onProgress);
  if (protocol === 'openai_assistant') return callOpenAIAssistant(agentConfig, task, context, signal, onProgress);
  if (protocol === 'openclaw_gateway') return callOpenClawGateway(agentConfig, task, context, signal, onProgress);
  if (protocol === 'websocket_agent')  return callWebSocketAgent(agentConfig, task, context, signal, onProgress);
  throw new Error(`Unknown agent protocol: ${protocol}`);
}

// ─── Health Check ─────────────────────────────────────────────────────────────

/**
 * Ping an agent to check if it's reachable.
 * Returns true if reachable, false otherwise.
 */
export async function testAgent(agentConfig) {
  const signal = AbortSignal.timeout(8000);
  try {
    if (agentConfig.protocol === 'http_simple') {
      const headers = agentConfig.bearerToken
        ? { Authorization: `Bearer ${agentConfig.bearerToken}` }
        : {};
      const health = await fetch(`${agentConfig.endpoint}/health`, { headers, signal }).catch(() => null);
      if (health?.ok) return true;
      const post = await fetch(agentConfig.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ task: '__ping__', context: '', projectDescription: '', nodeLabel: '', nodeType: '', upstreamContext: {} }),
        signal,
      }).catch(() => null);
      return post != null && (post.ok || post.status < 500);
    }

    if (agentConfig.protocol === 'openai_assistant') {
      const res = await fetch(`https://api.openai.com/v1/assistants/${agentConfig.assistantId}`, {
        headers: { Authorization: `Bearer ${agentConfig.apiKey}`, 'OpenAI-Beta': 'assistants=v2' },
        signal,
      }).catch(() => null);
      return res?.ok === true;
    }

    if (agentConfig.protocol === 'openclaw_gateway' || agentConfig.protocol === 'websocket_agent') {
      return await new Promise((resolve) => {
        try {
          const ws = new WebSocket(agentConfig.wsEndpoint);
          const t = setTimeout(() => { try { ws.close(); } catch (_) {} resolve(false); }, 5000);
          ws.onopen  = () => { clearTimeout(t); try { ws.close(); } catch (_) {} resolve(true); };
          ws.onerror = () => { clearTimeout(t); resolve(false); };
        } catch {
          resolve(false);
        }
      });
    }
  } catch {
    return false;
  }
  return false;
}
