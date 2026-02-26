import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NODE_TEMPLATES, MODEL_OPTIONS, NODE_TEMPLATE_CATEGORIES } from '../lib/models';
import { executePipeline, retrySingleNode, executePartialPipeline } from '../lib/pipeline';
import { loadPipelineState, savePipelineState, clearPipelineState, getAgentConfigs, getStoredOllamaModels, saveStoredOllamaModels } from '../lib/settings';
import { optimizePipeline, autoFixPipeline, getOptimizerModel } from '../lib/optimize';
import { testAgent } from '../lib/agentCall';
import { discoverOllamaModels } from '../lib/api';
import { saveRunRecord, buildRunRecord } from '../lib/runHistory';
import Canvas from './Canvas';
import NodeInspector from './NodeInspector';
import TemplateSelector from './TemplateSelector';
import Settings from './Settings';
import Help from './Help';
import BugReport from './BugReport';
import MediaViewer from './MediaViewer';
import { isMediaOutput } from '../lib/mediaApi';

// ─── Unique node ID generator ─────────────────────────────────────────────────
let _nodeSeq = 0;
function makeNodeId(templateId) {
  return `${templateId}-${++_nodeSeq}`;
}

// ─── File map: templateId → download filename ─────────────────────────────────
const FILE_MAP = {
  // Code & Architecture
  requirements:    { name: 'requirements.md',       ext: 'md'   },
  db_schema:       { name: 'schema.sql',             ext: 'sql'  },
  api_contract:    { name: 'openapi.yaml',           ext: 'yaml' },
  frontend:        { name: 'frontend.tsx',           ext: 'tsx'  },
  backend:         { name: 'server.ts',              ext: 'ts'   },
  wireframes:      { name: 'wireframes.md',          ext: 'md'   },
  auth:            { name: 'auth.ts',                ext: 'ts'   },
  payments:        { name: 'payments.ts',            ext: 'ts'   },
  tests:           { name: 'tests.spec.ts',          ext: 'ts'   },
  deploy:          { name: 'docker-compose.yml',     ext: 'yml'  },
  web_research:    { name: 'research-notes.md',      ext: 'md'   },
  peer_review:     { name: 'peer-review.md',         ext: 'md'   },
  fact_check:      { name: 'fact-check.md',          ext: 'md'   },
  // Content & Marketing
  blog_post:       { name: 'blog-post.md',           ext: 'md'   },
  social_media:    { name: 'social-posts.md',        ext: 'md'   },
  email_campaign:  { name: 'email-campaign.md',      ext: 'md'   },
  marketing_copy:  { name: 'marketing-copy.md',      ext: 'md'   },
  seo:             { name: 'seo-strategy.md',        ext: 'md'   },
  brand_guide:     { name: 'brand-guide.md',         ext: 'md'   },
  // Media & Creative
  image_prompt:    { name: 'image-prompts.md',       ext: 'md'   },
  video_script:    { name: 'video-script.md',        ext: 'md'   },
  audio_script:    { name: 'audio-script.md',        ext: 'md'   },
  storyboard:      { name: 'storyboard.md',          ext: 'md'   },
  music_prompt:    { name: 'music-prompts.md',       ext: 'md'   },
  // Data & AI
  data_analysis:   { name: 'data-analysis.md',       ext: 'md'   },
  ml_pipeline:     { name: 'ml-pipeline.md',         ext: 'md'   },
  chatbot_design:  { name: 'chatbot-design.md',      ext: 'md'   },
  // Custom
  custom:          { name: 'custom-step.md',         ext: 'md'   },
  // Real media generation nodes
  image_gen:       { name: 'generated-images',       ext: 'media' },
  tts_audio:       { name: 'narration.mp3',          ext: 'media' },
  video_compose:   { name: 'video.webm',             ext: 'media' },
};

// ─── Markdown output renderer ─────────────────────────────────────────────────
function OutputMarkdown({ content }) {
  return (
    <div className="prose prose-invert prose-xs max-w-none text-gray-300 p-4 text-xs leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-base font-bold text-gray-100 mt-3 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold text-gray-100 mt-2 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-bold text-gray-200 mt-2 mb-0.5">{children}</h3>,
          p:  ({ children }) => <p  className="mb-2 text-gray-300">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 text-gray-300 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 text-gray-300 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-gray-300">{children}</li>,
          code: ({ inline, children }) =>
            inline
              ? <code className="bg-gray-800 text-indigo-300 px-1 rounded text-[10px] font-mono">{children}</code>
              : <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 overflow-x-auto my-2"><code className="text-[10px] font-mono text-gray-300">{children}</code></pre>,
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-600 pl-3 text-gray-400 italic my-2">{children}</blockquote>,
          table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
          th: ({ children }) => <th className="border border-gray-700 px-2 py-1 bg-gray-800 text-gray-100 font-semibold text-left">{children}</th>,
          td: ({ children }) => <td className="border border-gray-700 px-2 py-1 text-gray-300">{children}</td>,
          strong: ({ children }) => <strong className="font-bold text-gray-100">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-400">{children}</em>,
          hr: () => <hr className="border-gray-800 my-3" />,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">{children}</a>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className={`text-[10px] px-2 py-0.5 rounded border transition-all ${copied ? 'text-emerald-400 border-emerald-700/40 bg-emerald-950/30' : 'text-gray-500 border-gray-700/40 bg-gray-900/40 hover:text-gray-300'} ${className}`}
    >
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
  );
}

// ─── Optimizer / Auto-fix result banner ───────────────────────────────────────
function OptimizeBanner({ banner, nodes, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const { type, result, prevEdgeCount } = banner;
  const isOptimize = type === 'optimize';

  const summary = isOptimize ? result?.strategy : result?.summary;
  const changes = isOptimize ? result?.nodes : result?.fixes;
  const changeEntries = changes ? Object.entries(changes) : [];

  const modelChanges = changeEntries.filter(([, v]) => v?.model);
  const promptChanges = !isOptimize ? changeEntries.filter(([, v]) => v?.promptAddition) : [];
  const edgeCount = isOptimize && Array.isArray(result?.edges) ? result.edges.length : 0;
  const edgesChanged = isOptimize && edgeCount !== prevEdgeCount;

  const accentCls = isOptimize
    ? { border: 'border-violet-800/50', bg: 'bg-violet-950/25', text: 'text-violet-300', badge: 'bg-violet-900/40 text-violet-300 border-violet-800/40' }
    : { border: 'border-amber-800/50', bg: 'bg-amber-950/25', text: 'text-amber-300', badge: 'bg-amber-900/40 text-amber-300 border-amber-800/40' };

  return (
    <div className={`border-b ${accentCls.border} ${accentCls.bg} px-4 py-2.5`}>
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5 flex-shrink-0">{isOptimize ? '🧠' : '🔄'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${accentCls.text}`}>{isOptimize ? 'Auto-Configure' : 'Self-Heal'} Complete</span>
            {modelChanges.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${accentCls.badge}`}>
                {modelChanges.length} model{modelChanges.length !== 1 ? 's' : ''} assigned
              </span>
            )}
            {edgesChanged && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${accentCls.badge}`}>
                {edgeCount} connection{edgeCount !== 1 ? 's' : ''} configured
              </span>
            )}
            {promptChanges.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${accentCls.badge}`}>
                {promptChanges.length} prompt{promptChanges.length !== 1 ? 's' : ''} enhanced
              </span>
            )}
          </div>
          {summary && <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{summary}</p>}
          {isOptimize && result?.connectionRationale && (
            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">↔ {result.connectionRationale}</p>
          )}

          {changeEntries.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className={`mt-1 text-[10px] ${accentCls.text} hover:opacity-80 transition-opacity`}
            >
              {expanded ? '▲ Hide details' : `▼ Show ${changeEntries.length} node details`}
            </button>
          )}
          {expanded && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {changeEntries.map(([nodeId, rec]) => {
                const node = nodes.find((n) => n.id === nodeId);
                const tmpl = NODE_TEMPLATES.find((t) => t.id === (node?.templateId || nodeId));
                return (
                  <div key={nodeId} className="bg-gray-900/60 border border-gray-800/60 rounded-lg px-3 py-2 text-[10px]">
                    <div className="font-semibold text-gray-300">{tmpl?.icon} {node?.customLabel || tmpl?.label || nodeId}</div>
                    {rec.model && <div className="text-gray-500 mt-0.5">Model → <span className="text-gray-300">{MODEL_OPTIONS.find((m) => m.id === rec.model)?.label || rec.model}</span></div>}
                    {rec.promptAddition && <div className="text-gray-500 mt-0.5">Prompt + <span className="text-gray-400 italic">"{rec.promptAddition.slice(0, 80)}{rec.promptAddition.length > 80 ? '…' : ''}"</span></div>}
                    {rec.reason && <div className="text-gray-600 mt-0.5 italic">{rec.reason}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button onClick={onDismiss} className="flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors text-sm mt-0.5" title="Dismiss">✕</button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DevOrchestrator() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [projectDesc, setProjectDesc] = useState('');
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [execMode, setExecMode] = useState('dag');
  const [nodeStatuses, setNodeStatuses] = useState({});
  const [modelsUsed, setModelsUsed] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [runPhase, setRunPhase] = useState('');
  const [showTemplates, setShowTemplates] = useState(true);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [outputs, setOutputs] = useState({});
  const [streamingChunks, setStreamingChunks] = useState({}); // live token accumulation
  const [activeTab, setActiveTab] = useState('canvas');
  const [executionLog, setExecutionLog] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [rawMode, setRawMode] = useState({}); // nodeId → bool: show raw vs markdown
  const [showBugReport, setShowBugReport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const abortRef = useRef(null);
  const runStartRef = useRef(null); // timestamp when current run started

  // ── Optimizer / Auto-fix state ────────────────────────────────────────────
  const [optimizing, setOptimizing] = useState(false);
  const [optimizePhase, setOptimizePhase] = useState('');
  const [optimizeBanner, setOptimizeBanner] = useState(null); // { type: 'optimize'|'autofix', result }
  const optimizeAbortRef = useRef(null);

  // ── Agent state ───────────────────────────────────────────────────────────
  const [agents, setAgents] = useState(() => getAgentConfigs());
  const [agentStatuses, setAgentStatuses] = useState({}); // agentId → 'online'|'offline'
  const [dynamicOllamaModels, setDynamicOllamaModels] = useState(() => getStoredOllamaModels());

  // ── Persist pipeline state to localStorage ────────────────────────────────
  useEffect(() => {
    const saved = loadPipelineState();
    if (saved?.nodes?.length > 0) {
      setProjectDesc(saved.projectDesc || '');
      setNodes(saved.nodes || []);
      setEdges(saved.edges || []);
      setExecMode(saved.execMode || 'dag');
      setShowTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (!showTemplates && nodes.length > 0) {
      savePipelineState({ projectDesc, nodes, edges, execMode });
    }
  }, [projectDesc, nodes, edges, execMode, showTemplates]);

  // ── Agent health check on mount ───────────────────────────────────────────
  useEffect(() => {
    const currentAgents = getAgentConfigs();
    if (currentAgents.length === 0) return;
    currentAgents.forEach(async (agent) => {
      const ok = await testAgent(agent).catch(() => false);
      setAgentStatuses((prev) => ({ ...prev, [agent.id]: ok ? 'online' : 'offline' }));
    });
  }, []);

  // ── Auto-discover Ollama models on mount ──────────────────────────────────
  useEffect(() => {
    discoverOllamaModels().then((models) => {
      if (models.length > 0) {
        saveStoredOllamaModels(models);
        setDynamicOllamaModels(models);
      }
    }).catch(() => {/* Ollama not running — silent */});
  }, []);

  // ── Undo stack for node/edge operations ───────────────────────────────────
  const undoStack = useRef([]); // [{nodes, edges}]
  const pushUndo = useCallback(() => {
    setNodes((n) => {
      setEdges((e) => {
        undoStack.current = undoStack.current.slice(-29); // max 30 states
        undoStack.current.push({ nodes: n, edges: e });
        return e;
      });
      return n;
    });
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop();
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, []);

  // ── Keyboard shortcut: Ctrl/Cmd + Enter to run, Ctrl+Z to undo ─────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isRunning && nodes.length > 0 && projectDesc.trim()) {
          runPipeline();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isRunning, nodes, projectDesc, undo]); // eslint-disable-line

  const selectedNodeData = useMemo(() => nodes.find((n) => n.id === selectedNode), [nodes, selectedNode]);

  // ── Template loading ──────────────────────────────────────────────────────
  const loadTemplate = useCallback((template) => {
    const newNodes = template.nodes.map((tid) => ({
      id: tid,          // first load: id === templateId for simplicity
      templateId: tid,
      model: null,
      customPrompt: '',
      customLabel: null,
    }));
    setNodes(newNodes);
    setEdges(template.edges);
    setNodeStatuses({});
    setOutputs({});
    setModelsUsed({});
    setStreamingChunks({});
    setSelectedNode(null);
    setShowTemplates(false);
    setExecutionLog([]);
    setActiveTab('canvas');
  }, []);

  // ── Node CRUD ─────────────────────────────────────────────────────────────
  const addNode = useCallback((templateId) => {
    pushUndo();
    const id = makeNodeId(templateId);
    setNodes((prev) => [...prev, { id, templateId, model: null, customPrompt: '', customLabel: null, agentId: null }]);
    setShowNodePicker(false);
  }, [pushUndo]);

  const removeNode = useCallback((nodeId) => {
    pushUndo();
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter(([f, t]) => f !== nodeId && t !== nodeId));
    if (selectedNode === nodeId) setSelectedNode(null);
  }, [pushUndo, selectedNode]);

  const updateNodeModel  = useCallback((nodeId, modelId) => setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, model: modelId } : n)), []);
  const updateNodePrompt = useCallback((nodeId, p)       => setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, customPrompt: p } : n)), []);
  const updateNodeLabel  = useCallback((nodeId, label)   => setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, customLabel: label || null } : n)), []);
  const updateNodeAgent  = useCallback((nodeId, agentId) => setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, agentId: agentId || null } : n)), []);

  const toggleEdge = useCallback((fromId, toId) => {
    pushUndo();
    setEdges((prev) => {
      const exists = prev.some(([f, t]) => f === fromId && t === toId);
      return exists ? prev.filter(([f, t]) => !(f === fromId && t === toId)) : [...prev, [fromId, toId]];
    });
  }, [pushUndo]);

  // ── Shared callbacks for pipeline execution ───────────────────────────────
  const makeCallbacks = useCallback((isRetry = false) => ({
    onStatusChange: (nodeId, status) => {
      setNodeStatuses((prev) => ({ ...prev, [nodeId]: status }));
      const node = nodes.find((n) => n.id === nodeId); // eslint-disable-line
      const tmpl = NODE_TEMPLATES.find((t) => t.id === (node?.templateId || nodeId));
      if (status === 'running')  setRunPhase(`Generating: ${tmpl?.label || nodeId}`);
      if (status === 'healing')  setRunPhase(`🔄 Healing: ${tmpl?.label || nodeId}`);
    },
    onOutput: (nodeId, output) => {
      setOutputs((prev) => ({ ...prev, [nodeId]: output }));
      setStreamingChunks((prev) => { const n = { ...prev }; delete n[nodeId]; return n; });
    },
    onLog: (msg) => {
      setExecutionLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
    },
    onChunk: (nodeId, chunk) => {
      setStreamingChunks((prev) => ({ ...prev, [nodeId]: (prev[nodeId] || '') + chunk }));
    },
  }), [nodes]);

  // ── Full pipeline run ─────────────────────────────────────────────────────
  const runPipeline = useCallback(async () => {
    if (nodes.length === 0) return;
    if (!projectDesc.trim()) {
      setExecutionLog([{ time: new Date().toLocaleTimeString(), msg: '✗ Add a project description before running — every node uses it to generate relevant output.' }]);
      setActiveTab('canvas');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setActiveTab('canvas');
    setExecutionLog([]);
    setOutputs({});
    setModelsUsed({});
    setStreamingChunks({});
    setRunPhase('Starting pipeline…');
    runStartRef.current = Date.now();

    const cbs = makeCallbacks();
    let finalModelsUsed = {};
    let finalStatuses   = {};

    try {
      const result = await executePipeline({
        nodes, edges, projectDesc,
        mode: execMode,
        signal: controller.signal,
        ...cbs,
      });
      finalModelsUsed = result.modelsUsed || {};
      setModelsUsed(finalModelsUsed);
      setRunPhase('Pipeline complete');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setRunPhase(`Error: ${err.message}`);
        setExecutionLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg: `✗ ${err.message}` }]);
      }
    } finally {
      setIsRunning(false);
      setStreamingChunks({});

      // Save run record for analytics + bug reports
      setNodeStatuses((latestStatuses) => {
        const durationMs = Date.now() - (runStartRef.current || Date.now());
        setExecutionLog((latestLog) => {
          try {
            saveRunRecord(buildRunRecord({
              projectDesc,
              nodes,
              edges,
              execMode,
              nodeStatuses: latestStatuses,
              modelsUsed: finalModelsUsed,
              executionLog: latestLog,
              durationMs,
            }));
          } catch { /* never block UI */ }
          return latestLog;
        });
        return latestStatuses;
      });
    }
  }, [nodes, edges, projectDesc, execMode, makeCallbacks]);

  // ── Single node retry ─────────────────────────────────────────────────────
  const retryNode = useCallback(async (nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || isRunning) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setStreamingChunks({});

    const cbs = makeCallbacks(true);
    cbs.onStatusChange(nodeId, 'running');

    try {
      const result = await retrySingleNode({
        node, nodes, edges, projectDesc,
        currentOutputs: outputs,
        signal: controller.signal,
        ...cbs,
      });
      if (result.modelUsed) {
        setModelsUsed((prev) => ({ ...prev, [nodeId]: result.modelUsed }));
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setExecutionLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg: `✗ ${err.message}` }]);
      }
    } finally {
      setIsRunning(false);
      setStreamingChunks({});
    }
  }, [nodes, edges, projectDesc, outputs, isRunning, makeCallbacks]);

  const stopPipeline = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
    setRunPhase('Aborted');
    setStreamingChunks({});
  }, []);

  const resetAll = useCallback(() => {
    abortRef.current?.abort();
    clearPipelineState();
    setShowTemplates(true);
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setOutputs({});
    setModelsUsed({});
    setStreamingChunks({});
    setNodeStatuses({});
    setExecutionLog([]);
    setIsRunning(false);
    setRunPhase('');
  }, []);

  // ── Download outputs as real code files ──────────────────────────────────
  const downloadProjectFiles = useCallback(() => {
    if (Object.keys(outputs).length === 0) return;

    const langExt = { sql: 'sql', yaml: 'yaml', yml: 'yaml', typescript: 'ts', ts: 'ts', tsx: 'tsx', javascript: 'js', js: 'js', python: 'py', py: 'py', json: 'json', dockerfile: 'dockerfile', bash: 'sh', sh: 'sh' };

    Object.entries(outputs).forEach(([nodeId, output]) => {
      const node = nodes.find((n) => n.id === nodeId);
      const templateId = node?.templateId || node?.id || nodeId;
      const tmpl = NODE_TEMPLATES.find((t) => t.id === templateId);
      const mapping = FILE_MAP[templateId];

      // Try to extract the largest code block
      const codeBlockRe = /```(\w+)?\n([\s\S]*?)```/g;
      let bestBlock = null;
      let bestLang = null;
      let m;
      while ((m = codeBlockRe.exec(output)) !== null) {
        if (!bestBlock || m[2].length > bestBlock.length) {
          bestBlock = m[2];
          bestLang = (m[1] || '').toLowerCase();
        }
      }

      let content, filename;
      if (bestBlock && bestLang && langExt[bestLang]) {
        const ext = mapping ? mapping.ext : langExt[bestLang];
        filename = mapping ? mapping.name : `${tmpl?.label?.toLowerCase().replace(/\s+/g, '-') || nodeId}.${ext}`;
        content = bestBlock;
      } else {
        filename = mapping ? mapping.name.replace(/\.\w+$/, '.md') : `${tmpl?.label?.toLowerCase().replace(/\s+/g, '-') || nodeId}.md`;
        content = `# ${node?.customLabel || tmpl?.label || nodeId}\n\n${output}`;
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [outputs, nodes]);

  // ── Export outputs as Markdown ────────────────────────────────────────────
  const exportOutputs = useCallback(() => {
    if (Object.keys(outputs).length === 0) return;
    const lines = [`# Dev Orchestrator — Pipeline Outputs\n`, `**Project:** ${projectDesc}\n`, `**Generated:** ${new Date().toLocaleString()}\n`, '---\n'];
    Object.entries(outputs).forEach(([nodeId, output]) => {
      const node = nodes.find((n) => n.id === nodeId);
      const tmpl = NODE_TEMPLATES.find((t) => t.id === (node?.templateId || nodeId));
      const modelId = modelsUsed[nodeId];
      const model = modelId ? MODEL_OPTIONS.find((m) => m.id === modelId) : null;
      lines.push(`\n## ${tmpl?.icon || ''} ${node?.customLabel || tmpl?.label || nodeId}`);
      if (model) lines.push(`*Model: ${model.label}*\n`);
      lines.push('');
      lines.push(output);
      lines.push('\n---');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-outputs-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [outputs, nodes, projectDesc, modelsUsed]);

  // ── LLM Optimizer — auto-picks best models + designs DAG connections ─────────
  const optimizeHandler = useCallback(async () => {
    if (optimizing || isRunning || nodes.length === 0) return;
    if (!projectDesc.trim()) {
      setOptimizePhase('✗ Add a project description first — Auto-Configure needs it to design smart connections');
      setTimeout(() => setOptimizePhase(''), 4000);
      return;
    }
    const controller = new AbortController();
    optimizeAbortRef.current = controller;
    setOptimizing(true);
    setOptimizeBanner(null);
    setOptimizePhase('🧠 Analyzing pipeline…');

    try {
      const result = await optimizePipeline({
        nodes, edges, projectDesc,
        signal: controller.signal,
        onProgress: setOptimizePhase,
      });

      // Apply model assignments to nodes
      if (result?.nodes) {
        setNodes((prev) => prev.map((n) => {
          const rec = result.nodes[n.id];
          if (!rec) return n;
          return { ...n, model: rec.model || null };
        }));
      }

      // Apply optimized edge connections (AI-designed DAG)
      if (result?.edges && Array.isArray(result.edges) && result.edges.length > 0) {
        setEdges(result.edges);
      }

      setOptimizeBanner({ type: 'optimize', result, prevEdgeCount: edges.length });
      setOptimizePhase('');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setOptimizePhase(`✗ Optimizer failed: ${err.message}`);
        setTimeout(() => setOptimizePhase(''), 6000);
      }
    } finally {
      setOptimizing(false);
    }
  }, [nodes, edges, projectDesc, optimizing, isRunning]);

  // ── Self-Heal Loop — diagnose → fix → re-run, repeat until all green ────────
  const autoFixHandler = useCallback(async () => {
    if (optimizing || isRunning || nodes.length === 0) return;

    const MAX_ATTEMPTS = 5;
    const controller = new AbortController();
    optimizeAbortRef.current = controller;
    abortRef.current = controller;
    setOptimizing(true);
    setIsRunning(true);
    setOptimizeBanner(null);
    setStreamingChunks({});

    // Work with local mutable copies so we can loop without waiting for React state
    let curNodes = nodes;
    let curStatuses = { ...nodeStatuses };
    let curOutputs = { ...outputs };
    let curLog = [...executionLog];

    const hasFailed = (statuses) =>
      curNodes.some((n) => statuses[n.id] === 'error' || statuses[n.id] === 'skipped');

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (!hasFailed(curStatuses)) break;
        if (controller.signal.aborted) break;

        // ── Step 1: Diagnose ──────────────────────────────────────────────────
        setOptimizePhase(`🔄 Self-heal ${attempt}/${MAX_ATTEMPTS} — diagnosing…`);
        let fixes = null;
        try {
          const result = await autoFixPipeline({
            nodes: curNodes, edges, projectDesc,
            nodeStatuses: curStatuses, outputs: curOutputs, executionLog: curLog,
            signal: controller.signal,
            onProgress: setOptimizePhase,
          });
          fixes = result?.fixes || null;
        } catch (diagErr) {
          if (diagErr.name === 'AbortError') break;
          // Diagnosis failed (e.g. optimizer model also rate-limited) — skip diagnosis,
          // still attempt re-run with existing node configs
          const entry = { time: new Date().toLocaleTimeString(), msg: `⚠️ Diagnosis unavailable: ${diagErr.message.slice(0, 80)} — retrying with current config` };
          curLog = [...curLog, entry];
          setExecutionLog((prev) => [...prev, entry]);
        }

        // ── Step 2: Apply fixes ───────────────────────────────────────────────
        if (fixes) {
          curNodes = curNodes.map((n) => {
            const fix = fixes[n.id];
            if (!fix) return n;
            const model = ('model' in fix) ? (fix.model || null) : n.model;
            const customPrompt = fix.promptAddition
              ? (n.customPrompt ? `${n.customPrompt}\n\n${fix.promptAddition}` : fix.promptAddition)
              : n.customPrompt;
            return { ...n, model, customPrompt };
          });
          setNodes(curNodes);
        }

        // Clear error/skipped so partial pipeline can re-run them
        const toRerun = Object.entries(curStatuses)
          .filter(([, s]) => s === 'error' || s === 'skipped')
          .map(([id]) => id);
        toRerun.forEach((id) => delete curStatuses[id]);
        toRerun.forEach((id) => delete curOutputs[id]); // clear bad outputs so they re-run
        setNodeStatuses({ ...curStatuses });
        setOutputs({ ...curOutputs });

        // ── Step 3: Re-run only the failed subtree ────────────────────────────
        setOptimizePhase(`🔄 Self-heal ${attempt}/${MAX_ATTEMPTS} — re-running failed nodes…`);
        setActiveTab('canvas');

        const cbs = {
          onStatusChange: (id, status) => {
            curStatuses[id] = status;
            setNodeStatuses((prev) => ({ ...prev, [id]: status }));
          },
          onOutput: (id, text) => {
            curOutputs[id] = text;
            setOutputs((prev) => ({ ...prev, [id]: text }));
          },
          onLog: (msg) => {
            const entry = { time: new Date().toLocaleTimeString(), msg };
            curLog = [...curLog, entry];
            setExecutionLog((prev) => [...prev, entry]);
          },
          onChunk: (id, chunk) => {
            setStreamingChunks((prev) => ({ ...prev, [id]: (prev[id] || '') + chunk }));
          },
        };

        try {
          const partialResult = await executePartialPipeline({
            nodes: curNodes, edges, projectDesc,
            mode: execMode,
            existingOutputs: curOutputs,
            signal: controller.signal,
            ...cbs,
          });
          setModelsUsed((prev) => ({ ...prev, ...(partialResult.modelsUsed || {}) }));
        } catch (runErr) {
          if (runErr.name === 'AbortError') break;
        }

        setStreamingChunks({});
      }

      // ── Final status ──────────────────────────────────────────────────────
      const stillBroken = hasFailed(curStatuses);
      if (stillBroken) {
        const failCount = curNodes.filter((n) => curStatuses[n.id] === 'error' || curStatuses[n.id] === 'skipped').length;
        setOptimizePhase(`⚠️ ${failCount} node${failCount > 1 ? 's' : ''} couldn't be healed — no remaining model options`);
        setTimeout(() => setOptimizePhase(''), 5000);
      } else {
        setOptimizePhase('✓ All nodes healed — pipeline is green!');
        setTimeout(() => setOptimizePhase(''), 3000);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setOptimizePhase(`✗ Self-heal failed: ${err.message.slice(0, 100)}`);
        setTimeout(() => setOptimizePhase(''), 4000);
      }
    } finally {
      setOptimizing(false);
      setIsRunning(false);
      setStreamingChunks({});
    }
  }, [nodes, edges, projectDesc, nodeStatuses, outputs, executionLog, execMode, optimizing, isRunning]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const allTemplateIds = nodes.map((n) => n.templateId || n.id);
  const hasOutputs = Object.keys(outputs).length > 0;
  const hasLog     = executionLog.length > 0;
  const hasErrors  = nodes.some((n) => nodeStatuses[n.id] === 'error' || nodeStatuses[n.id] === 'skipped');

  const logColor = (msg) =>
    msg.startsWith('✓')  ? 'text-emerald-400' :
    msg.startsWith('🏁') ? 'text-violet-400'  :
    msg.startsWith('✗')  ? 'text-red-400'     :
    msg.startsWith('🔄') ? 'text-amber-400'   :
    msg.startsWith('⊘')  ? 'text-gray-600'    :
    msg.startsWith('↺')  ? 'text-sky-400'     :
    'text-gray-400';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      {/* Header */}
      <header className="border-b border-gray-800 px-5 py-3 flex items-center justify-between backdrop-blur-md bg-gray-950/80 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-indigo-500/20">⚡</div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-50 leading-tight">Dev Orchestrator</h1>
            <p className="text-[11px] text-gray-500 uppercase tracking-widest">DAG Pipeline Builder</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-[10px] text-gray-600 px-2.5 py-1 bg-gray-900 rounded-md border border-gray-800 font-mono">
            {nodes.length} nodes · {edges.length} edges
          </span>
          {!showTemplates && (
            <button onClick={resetAll} className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors">↻ Reset</button>
          )}
          <button
            onClick={() => setShowHelp(true)}
            className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
            title="Help & documentation"
          >❓ Help</button>
          <button
            onClick={() => setShowBugReport(true)}
            className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
            title="Report a bug or give feedback"
          >🐛 Report Bug</button>
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
            title="API Keys & Provider Settings"
          >⚙️ Settings</button>
        </div>
      </header>

      {showSettings && <Settings onClose={() => { setShowSettings(false); setAgents(getAgentConfigs()); setDynamicOllamaModels(getStoredOllamaModels()); }} />}
      {showHelp && <Help onClose={() => setShowHelp(false)} />}
      {showBugReport && (
        <BugReport
          nodes={nodes}
          edges={edges}
          projectDesc={projectDesc}
          executionLog={executionLog}
          nodeStatuses={nodeStatuses}
          outputs={outputs}
          modelsUsed={modelsUsed}
          onClose={() => setShowBugReport(false)}
        />
      )}

      <div className="flex" style={{ height: 'calc(100vh - 57px)' }}>
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Template Selector */}
          {showTemplates && (
            <TemplateSelector
              projectDesc={projectDesc}
              onProjectDescChange={setProjectDesc}
              onSelectTemplate={loadTemplate}
              onStartBlank={() => { setShowTemplates(false); setShowNodePicker(true); }}
              onShowHelp={() => setShowHelp(true)}
            />
          )}

          {/* Pipeline Builder */}
          {!showTemplates && (
            <>
              {/* Toolbar */}
              <div className="px-4 py-2.5 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 flex-wrap gap-2">
                <div className="flex gap-1.5 items-center">
                  {[
                    { id: 'canvas',  label: '🗺️ Canvas',  ready: true       },
                    { id: 'outputs', label: '📄 Outputs', ready: hasOutputs },
                    { id: 'log',     label: '📜 Log',     ready: hasLog     },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => { if (tab.ready) { setActiveTab(tab.id); if (tab.id !== 'canvas') setSelectedNode(null); } }}
                      disabled={!tab.ready}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white' : tab.ready ? 'text-gray-400 hover:text-gray-200' : 'text-gray-700 cursor-not-allowed'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  <div className="w-px h-5 bg-gray-800 mx-1" />
                  <button onClick={() => setShowNodePicker(!showNodePicker)} className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 transition-colors">
                    + Add Node
                  </button>
                </div>

                <div className="flex gap-2 items-center">
                  {/* Exec mode */}
                  <div className="flex bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
                    {[{ id: 'parallel', label: '⫘ Parallel' }, { id: 'sequential', label: '↓ Sequential' }, { id: 'dag', label: '◈ DAG' }].map((m) => (
                      <button key={m.id} onClick={() => setExecMode(m.id)}
                        className={`px-3 py-1 text-[11px] font-medium transition-all ${execMode === m.id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Project description — click to edit */}
                  {projectDesc && !editingDesc && (
                    <span
                      onClick={() => { setDescDraft(projectDesc); setEditingDesc(true); }}
                      className="text-[10px] text-gray-600 max-w-[200px] truncate px-2 py-1 bg-gray-900 rounded border border-gray-800 cursor-pointer hover:border-indigo-700 hover:text-gray-400 transition-colors"
                      title="Click to edit project description"
                    >
                      📝 {projectDesc.slice(0, 40)}{projectDesc.length > 40 ? '…' : ''}
                    </span>
                  )}
                  {editingDesc && (
                    <input
                      autoFocus
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      onBlur={() => { setProjectDesc(descDraft); setEditingDesc(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { setProjectDesc(descDraft); setEditingDesc(false); } }}
                      className="text-[10px] text-gray-200 w-48 px-2 py-1 bg-gray-900 rounded border border-indigo-500 outline-none font-mono"
                    />
                  )}

                  {/* LLM Smart Buttons */}
                  {!isRunning && !optimizing && nodes.length > 0 && (
                    <>
                      <button
                        onClick={optimizeHandler}
                        title="Let an LLM pick the best model for every node"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-violet-700/50 bg-violet-950/30 text-violet-300 hover:bg-violet-950/60 transition-colors flex items-center gap-1.5"
                      >
                        🧠 Auto-Configure
                      </button>
                      {hasErrors && (
                        <button
                          onClick={autoFixHandler}
                          title="Diagnose failures, apply fixes, re-run — repeat until all nodes are green"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-700/50 bg-amber-950/30 text-amber-300 hover:bg-amber-950/60 transition-colors flex items-center gap-1.5"
                        >
                          🔄 Self-Heal
                        </button>
                      )}
                    </>
                  )}
                  {optimizing && (
                    <button
                      onClick={() => optimizeAbortRef.current?.abort()}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-violet-700/50 bg-violet-950/40 text-violet-300 hover:bg-violet-950/70 transition-colors flex items-center gap-1.5"
                    >
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Cancel
                    </button>
                  )}

                  {/* Run / Stop */}
                  {isRunning ? (
                    <button onClick={stopPipeline} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-1.5">■ Stop</button>
                  ) : (
                    <button
                      onClick={runPipeline}
                      disabled={nodes.length === 0 || !projectDesc.trim() || optimizing}
                      title="Ctrl+Enter"
                      className="px-5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      ▶ Run Pipeline
                    </button>
                  )}
                </div>
              </div>

              {/* Pipeline status bar */}
              {isRunning && (
                <div className={`px-4 py-1.5 border-b flex items-center gap-2 transition-colors ${runPhase.startsWith('🔄') ? 'bg-amber-950/30 border-amber-900/30' : 'bg-indigo-950/30 border-indigo-900/30'}`}>
                  <svg className={`animate-spin h-3 w-3 ${runPhase.startsWith('🔄') ? 'text-amber-400' : 'text-indigo-400'}`} viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className={`text-xs font-medium ${runPhase.startsWith('🔄') ? 'text-amber-300' : 'text-indigo-300'}`}>{runPhase}</span>
                </div>
              )}

              {/* Optimizer status bar */}
              {optimizePhase && (
                <div className={`px-4 py-1.5 border-b flex items-center gap-2 transition-colors ${optimizePhase.startsWith('✗') ? 'bg-red-950/30 border-red-900/30' : 'bg-violet-950/30 border-violet-900/30'}`}>
                  {!optimizePhase.startsWith('✗') && (
                    <svg className="animate-spin h-3 w-3 text-violet-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  <span className={`text-xs font-medium ${optimizePhase.startsWith('✗') ? 'text-red-300' : 'text-violet-300'}`}>{optimizePhase}</span>
                </div>
              )}

              {/* Optimizer / Auto-Fix result banner */}
              {optimizeBanner && (
                <OptimizeBanner
                  banner={optimizeBanner}
                  nodes={nodes}
                  onDismiss={() => setOptimizeBanner(null)}
                />
              )}

              {/* Node Picker Drawer — categorized */}
              {showNodePicker && (
                <div className="bg-[#0a0a0f] border-b border-gray-800 animate-slide-in">
                  {NODE_TEMPLATE_CATEGORIES.map((cat) => {
                    const catNodes = NODE_TEMPLATES.filter((t) =>
                      (t.category || 'code') === cat.id
                    );
                    if (catNodes.length === 0) return null;
                    return (
                      <div key={cat.id} className="flex items-center gap-2 flex-wrap px-4 py-2 border-b border-gray-900/60 last:border-b-0">
                        <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider w-32 flex-shrink-0">
                          {cat.label}
                        </span>
                        <div className="flex gap-1.5 flex-wrap">
                          {catNodes.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => addNode(t.id)}
                              title={t.desc}
                              className="text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all hover:brightness-125 active:scale-95"
                              style={{ background: `${t.color}11`, borderColor: `${t.color}33`, color: t.color }}
                            >
                              {t.icon} {t.label}
                              {t.webSearch && <span className="text-[9px] opacity-50">🌐</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab content */}
              <div className="flex flex-1 overflow-hidden">

                {/* Canvas */}
                {activeTab === 'canvas' && (
                  <>
                    <Canvas
                      nodes={nodes}
                      edges={edges}
                      selectedNode={selectedNode}
                      nodeStatuses={nodeStatuses}
                      agents={agents}
                      onSelectNode={setSelectedNode}
                      onToggleEdge={toggleEdge}
                    />
                    {selectedNodeData && (
                      <NodeInspector
                        node={selectedNodeData}
                        nodes={nodes}
                        edges={edges}
                        outputs={outputs}
                        nodeStatuses={nodeStatuses}
                        modelsUsed={modelsUsed}
                        agents={agents}
                        agentStatuses={agentStatuses}
                        dynamicOllamaModels={dynamicOllamaModels}
                        onUpdateModel={updateNodeModel}
                        onUpdateAgent={updateNodeAgent}
                        onToggleEdge={toggleEdge}
                        onRemoveNode={removeNode}
                        onUpdatePrompt={updateNodePrompt}
                        onUpdateLabel={updateNodeLabel}
                        onRetryNode={retryNode}
                        onClose={() => setSelectedNode(null)}
                        isRunning={isRunning}
                      />
                    )}
                  </>
                )}

                {/* Outputs */}
                {activeTab === 'outputs' && (
                  <div className="flex-1 overflow-auto p-5">

                    {/* Project Summary */}
                    {hasOutputs && (() => {
                      const textOutputs = Object.values(outputs).filter(o => !isMediaOutput(o));
                      const mediaOutputs = Object.values(outputs).filter(o => isMediaOutput(o));
                      const totalLines = textOutputs.reduce((s, o) => s + o.split('\n').length, 0);
                      const totalWords = textOutputs.reduce((s, o) => s + o.trim().split(/\s+/).filter(Boolean).length, 0);
                      return (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-5">
                          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2 flex-wrap">
                            <span className="text-base">📁</span>
                            <span className="text-sm font-bold text-gray-100">Generated Project</span>
                            <span className="text-[10px] text-gray-600 ml-1 truncate max-w-xs">{projectDesc}</span>
                            <div className="ml-auto flex gap-3 text-[10px] text-gray-500 font-mono">
                              <span>{Object.keys(outputs).length} files</span>
                              {mediaOutputs.length > 0 && <span>{mediaOutputs.length} media files</span>}
                              {totalLines > 0 && <span>{totalLines.toLocaleString()} lines</span>}
                              {totalWords > 0 && <span>{totalWords.toLocaleString()} words</span>}
                            </div>
                          </div>
                          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {Object.entries(outputs).map(([nodeId, output]) => {
                              const node = nodes.find((n) => n.id === nodeId);
                              const tmpl = NODE_TEMPLATES.find((t) => t.id === (node?.templateId || nodeId));
                              const tid = node?.templateId || nodeId;
                              const isErr = nodeStatuses[nodeId] === 'error' || output.startsWith('ERROR:');
                              const isMedia = isMediaOutput(output);
                              const lines = isMedia ? 0 : output.split('\n').length;
                              const mapping = FILE_MAP[tid];
                              const mediaLabel = isMedia ? (() => {
                                try { const m = JSON.parse(output); return m.type === 'images' ? `${m.urls?.length} images` : m.type === 'audio' ? `${Math.round(m.duration||0)}s audio` : m.type === 'video' ? `${m.scenes} scenes video` : 'media'; } catch { return 'media'; }
                              })() : null;
                              return (
                                <button
                                  key={nodeId}
                                  onClick={() => document.getElementById(`out-${nodeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                  className="flex items-start gap-2 p-2 rounded-lg border border-gray-800 bg-gray-950/50 hover:border-gray-600 hover:bg-gray-900 transition-all text-left"
                                >
                                  <span className="text-lg flex-shrink-0 leading-none mt-0.5">{tmpl?.icon}</span>
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-semibold text-gray-200 truncate">{node?.customLabel || tmpl?.label}</div>
                                    <div className="text-[10px] text-gray-600 truncate font-mono">{mapping?.name || `${tid}.md`}</div>
                                    <div className={`text-[10px] font-semibold mt-0.5 ${isErr ? 'text-red-400' : 'text-emerald-500'}`}>
                                      {isErr ? '✗ error' : isMedia ? `✓ ${mediaLabel}` : `✓ ${lines.toLocaleString()} lines`}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Export bar */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs text-gray-500">{Object.keys(outputs).length} outputs</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const allText = Object.entries(outputs)
                              .filter(([, out]) => !isMediaOutput(out))
                              .map(([id, out]) => {
                                const node = nodes.find((n) => n.id === id);
                                const tmpl = NODE_TEMPLATES.find((t) => t.id === (node?.templateId || id));
                                return `# ${tmpl?.label || id}\n\n${out}`;
                              }).join('\n\n---\n\n');
                            navigator.clipboard.writeText(allText);
                          }}
                          className="text-xs px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                        >
                          ⎘ Copy All
                        </button>
                        <button
                          onClick={downloadProjectFiles}
                          className="text-xs px-3 py-1 rounded-lg bg-indigo-900/40 border border-indigo-700/50 text-indigo-300 hover:bg-indigo-900/70 transition-colors font-semibold"
                          title="Download each output as a real code file (.sql, .yaml, .ts, .js, etc.)"
                        >
                          📦 Download Files
                        </button>
                        <button
                          onClick={exportOutputs}
                          className="text-xs px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                        >
                          ↓ Export .md
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {Object.entries(outputs).map(([nodeId, output]) => {
                        const node = nodes.find((n) => n.id === nodeId);
                        const tmpl = NODE_TEMPLATES.find((t) => t.id === (node?.templateId || nodeId));
                        const isMedia = isMediaOutput(output);
                        const isError = !isMedia && (nodeStatuses[nodeId] === 'error' || (typeof output === 'string' && output.startsWith('ERROR:')));
                        const modelId = modelsUsed[nodeId];
                        const model = modelId ? MODEL_OPTIONS.find((m) => m.id === modelId) : null;
                        const isRaw = rawMode[nodeId];
                        const streaming = streamingChunks[nodeId];

                        return (
                          <div
                            key={nodeId}
                            id={`out-${nodeId}`}
                            className="bg-gray-900 border rounded-xl overflow-hidden"
                            style={{ borderColor: isError ? '#7f1d1d' : '#1f2937' }}
                          >
                            {/* Card header */}
                            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2 flex-wrap" style={{ background: isError ? '#7f1d1d15' : `${tmpl?.color}08` }}>
                              <span className="text-base">{tmpl?.icon}</span>
                              <span className="text-sm font-semibold text-gray-100">{node?.customLabel || tmpl?.label}</span>
                              {model && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/60 border border-gray-700/40 text-gray-500" title="Model used">
                                  {model.label}
                                </span>
                              )}
                              <div className="ml-auto flex items-center gap-2">
                                {isError
                                  ? <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/50 text-red-400 border border-red-900/30">✗ Error</span>
                                  : <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-900/30">✓ Complete</span>
                                }
                                {!isError && !isMedia && (
                                  <button
                                    onClick={() => setRawMode((prev) => ({ ...prev, [nodeId]: !isRaw }))}
                                    className="text-[10px] px-2 py-0.5 rounded border border-gray-700/40 bg-gray-800/40 text-gray-500 hover:text-gray-300 transition-colors"
                                  >
                                    {isRaw ? 'Rendered' : 'Raw'}
                                  </button>
                                )}
                                {!isMedia && <CopyButton text={output} />}
                                <button
                                  onClick={() => retryNode(nodeId)}
                                  disabled={isRunning}
                                  className="text-[10px] px-2 py-0.5 rounded border border-gray-700/40 bg-gray-800/40 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-30"
                                  title="Regenerate this node"
                                >
                                  ↺
                                </button>
                              </div>
                            </div>

                            {/* Content */}
                            {isMediaOutput(output) ? (
                              <div className="p-4">
                                <MediaViewer output={output} />
                              </div>
                            ) : isError || isRaw ? (
                              <pre className={`p-4 text-xs whitespace-pre-wrap font-mono max-h-[500px] overflow-y-auto ${isError ? 'text-red-400' : 'text-gray-400'}`}>
                                {output}
                              </pre>
                            ) : (
                              <div className="max-h-[500px] overflow-y-auto">
                                <OutputMarkdown content={output} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Log */}
                {activeTab === 'log' && (
                  <div className="flex-1 overflow-auto p-5">
                    <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 font-mono">
                      {executionLog.map((entry, i) => (
                        <div key={i} className={`text-xs py-1 border-b border-gray-900 ${logColor(entry.msg)}`}>
                          <span className="text-gray-600 mr-3">{entry.time}</span>
                          {entry.msg}
                        </div>
                      ))}
                      {executionLog.length === 0 && (
                        <div className="text-xs text-gray-700 text-center py-8">No execution history yet</div>
                      )}
                    </div>
                  </div>
                )}


              </div>

              {/* Streaming overlay — shows live output on canvas for running node */}
              {Object.keys(streamingChunks).length > 0 && activeTab === 'canvas' && (
                <div className="fixed bottom-6 right-6 z-40 max-w-sm bg-gray-950 border border-indigo-800/50 rounded-xl p-3 shadow-2xl shadow-indigo-500/10">
                  {Object.entries(streamingChunks).map(([nodeId, chunk]) => {
                    const node = nodes.find((n) => n.id === nodeId);
                    const tmpl = NODE_TEMPLATES.find((t) => t.id === (node?.templateId || nodeId));
                    return (
                      <div key={nodeId}>
                        <div className="text-[10px] text-indigo-400 font-semibold mb-1">{tmpl?.icon} {node?.customLabel || tmpl?.label} — streaming…</div>
                        <div className="text-[10px] text-gray-400 font-mono max-h-24 overflow-hidden leading-relaxed">
                          {chunk.slice(-300)}
                          <span className="animate-pulse text-indigo-400">▋</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
}
