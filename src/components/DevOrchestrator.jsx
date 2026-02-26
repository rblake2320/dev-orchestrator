import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NODE_TEMPLATES, MODEL_OPTIONS } from '../lib/models';
import { executePipeline, retrySingleNode } from '../lib/pipeline';
import { loadPipelineState, savePipelineState, clearPipelineState } from '../lib/settings';
import Canvas from './Canvas';
import NodeInspector from './NodeInspector';
import TemplateSelector from './TemplateSelector';
import Settings from './Settings';

// ─── Unique node ID generator ─────────────────────────────────────────────────
let _nodeSeq = 0;
function makeNodeId(templateId) {
  return `${templateId}-${++_nodeSeq}`;
}

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
  const abortRef = useRef(null);

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

  // ── Keyboard shortcut: Ctrl/Cmd + Enter to run ────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isRunning && nodes.length > 0 && projectDesc.trim()) {
          runPipeline();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isRunning, nodes, projectDesc]); // eslint-disable-line

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
    const id = makeNodeId(templateId);
    setNodes((prev) => [...prev, { id, templateId, model: null, customPrompt: '', customLabel: null }]);
    setShowNodePicker(false);
  }, []);

  const removeNode = useCallback((nodeId) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter(([f, t]) => f !== nodeId && t !== nodeId));
    if (selectedNode === nodeId) setSelectedNode(null);
  }, [selectedNode]);

  const updateNodeModel  = useCallback((nodeId, modelId) => setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, model: modelId } : n)), []);
  const updateNodePrompt = useCallback((nodeId, p)       => setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, customPrompt: p } : n)), []);
  const updateNodeLabel  = useCallback((nodeId, label)   => setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, customLabel: label || null } : n)), []);

  const toggleEdge = useCallback((fromId, toId) => {
    setEdges((prev) => {
      const exists = prev.some(([f, t]) => f === fromId && t === toId);
      return exists ? prev.filter(([f, t]) => !(f === fromId && t === toId)) : [...prev, [fromId, toId]];
    });
  }, []);

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
    if (nodes.length === 0 || !projectDesc.trim()) return;
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setActiveTab('canvas');
    setExecutionLog([]);
    setOutputs({});
    setModelsUsed({});
    setStreamingChunks({});
    setRunPhase('Starting pipeline…');

    const cbs = makeCallbacks();

    try {
      const result = await executePipeline({
        nodes, edges, projectDesc,
        mode: execMode,
        signal: controller.signal,
        ...cbs,
      });
      setModelsUsed(result.modelsUsed || {});
      setRunPhase('Pipeline complete');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setRunPhase(`Error: ${err.message}`);
        setExecutionLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg: `✗ ${err.message}` }]);
      }
    } finally {
      setIsRunning(false);
      setStreamingChunks({});
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const allTemplateIds = nodes.map((n) => n.templateId || n.id);
  const hasOutputs = Object.keys(outputs).length > 0;
  const hasLog     = executionLog.length > 0;

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
            onClick={() => setShowSettings(true)}
            className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
            title="API Keys & Provider Settings"
          >⚙️ Settings</button>
        </div>
      </header>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      <div className="flex" style={{ height: 'calc(100vh - 57px)' }}>
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Template Selector */}
          {showTemplates && (
            <TemplateSelector
              projectDesc={projectDesc}
              onProjectDescChange={setProjectDesc}
              onSelectTemplate={loadTemplate}
              onStartBlank={() => { setShowTemplates(false); setShowNodePicker(true); }}
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
                      onClick={() => tab.ready && setActiveTab(tab.id)}
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

                  {/* Run / Stop */}
                  {isRunning ? (
                    <button onClick={stopPipeline} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-1.5">■ Stop</button>
                  ) : (
                    <button
                      onClick={runPipeline}
                      disabled={nodes.length === 0 || !projectDesc.trim()}
                      title="Ctrl+Enter"
                      className="px-5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      ▶ Run Pipeline
                    </button>
                  )}
                </div>
              </div>

              {/* Status bar */}
              {isRunning && (
                <div className={`px-4 py-1.5 border-b flex items-center gap-2 transition-colors ${runPhase.startsWith('🔄') ? 'bg-amber-950/30 border-amber-900/30' : 'bg-indigo-950/30 border-indigo-900/30'}`}>
                  <svg className={`animate-spin h-3 w-3 ${runPhase.startsWith('🔄') ? 'text-amber-400' : 'text-indigo-400'}`} viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className={`text-xs font-medium ${runPhase.startsWith('🔄') ? 'text-amber-300' : 'text-indigo-300'}`}>{runPhase}</span>
                </div>
              )}

              {/* Node Picker Drawer */}
              {showNodePicker && (
                <div className="px-4 py-2.5 bg-[#0d1117] border-b border-gray-800 flex gap-2 flex-wrap items-center animate-slide-in">
                  <span className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider mr-1">Add:</span>
                  {NODE_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => addNode(t.id)}
                      className="text-[11px] px-3 py-1 rounded-lg border flex items-center gap-1 transition-all hover:brightness-125"
                      style={{ background: `${t.color}11`, borderColor: `${t.color}33`, color: t.color }}
                    >
                      {t.icon} {t.label}
                      {t.webSearch && <span className="text-[9px] opacity-60">🌐</span>}
                    </button>
                  ))}
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
                      onSelectNode={setSelectedNode}
                    />
                    {selectedNodeData && (
                      <NodeInspector
                        node={selectedNodeData}
                        nodes={nodes}
                        edges={edges}
                        outputs={outputs}
                        nodeStatuses={nodeStatuses}
                        modelsUsed={modelsUsed}
                        onUpdateModel={updateNodeModel}
                        onToggleEdge={toggleEdge}
                        onRemoveNode={removeNode}
                        onUpdatePrompt={updateNodePrompt}
                        onUpdateLabel={updateNodeLabel}
                        onRetryNode={retryNode}
                        isRunning={isRunning}
                      />
                    )}
                  </>
                )}

                {/* Outputs */}
                {activeTab === 'outputs' && (
                  <div className="flex-1 overflow-auto p-5">
                    {/* Export bar */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs text-gray-500">{Object.keys(outputs).length} outputs</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const allText = Object.entries(outputs).map(([id, out]) => {
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
                        const isError = nodeStatuses[nodeId] === 'error' || (typeof output === 'string' && output.startsWith('ERROR:'));
                        const modelId = modelsUsed[nodeId];
                        const model = modelId ? MODEL_OPTIONS.find((m) => m.id === modelId) : null;
                        const isRaw = rawMode[nodeId];
                        const streaming = streamingChunks[nodeId];

                        return (
                          <div
                            key={nodeId}
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
                                {!isError && (
                                  <button
                                    onClick={() => setRawMode((prev) => ({ ...prev, [nodeId]: !isRaw }))}
                                    className="text-[10px] px-2 py-0.5 rounded border border-gray-700/40 bg-gray-800/40 text-gray-500 hover:text-gray-300 transition-colors"
                                  >
                                    {isRaw ? 'Rendered' : 'Raw'}
                                  </button>
                                )}
                                <CopyButton text={output} />
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
                            {isError || isRaw ? (
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
