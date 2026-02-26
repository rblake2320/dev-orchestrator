import { useState, useCallback, useMemo, useRef } from 'react';
import { NODE_TEMPLATES } from '../lib/models';
import { executePipeline } from '../lib/pipeline';
import Canvas from './Canvas';
import NodeInspector from './NodeInspector';
import TemplateSelector from './TemplateSelector';
import Settings from './Settings';

export default function DevOrchestrator() {
  // ─── State ──────────────────────────────────────────────────────────
  const [projectDesc, setProjectDesc] = useState('');
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [execMode, setExecMode] = useState('dag');
  const [nodeStatuses, setNodeStatuses] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [runPhase, setRunPhase] = useState('');
  const [showTemplates, setShowTemplates] = useState(true);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [outputs, setOutputs] = useState({});
  const [activeTab, setActiveTab] = useState('canvas');
  const [executionLog, setExecutionLog] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef(null);

  const selectedNodeData = useMemo(
    () => nodes.find((n) => n.id === selectedNode),
    [nodes, selectedNode]
  );

  // ─── Template Loading ───────────────────────────────────────────────
  const loadTemplate = useCallback((template) => {
    const newNodes = template.nodes.map((tid) => ({
      id: tid,
      templateId: tid,
      model: null,
      customPrompt: '',
    }));
    setNodes(newNodes);
    setEdges(template.edges);
    setNodeStatuses({});
    setOutputs({});
    setSelectedNode(null);
    setShowTemplates(false);
    setExecutionLog([]);
    setActiveTab('canvas');
  }, []);

  // ─── Node CRUD ──────────────────────────────────────────────────────
  const addNode = useCallback(
    (templateId) => {
      if (nodes.find((n) => n.templateId === templateId)) return;
      setNodes((prev) => [
        ...prev,
        { id: templateId, templateId, model: null, customPrompt: '' },
      ]);
      setShowNodePicker(false);
    },
    [nodes]
  );

  const removeNode = useCallback(
    (nodeId) => {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) => prev.filter(([f, t]) => f !== nodeId && t !== nodeId));
      if (selectedNode === nodeId) setSelectedNode(null);
    },
    [selectedNode]
  );

  const updateNodeModel = useCallback((nodeId, modelId) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, model: modelId } : n))
    );
  }, []);

  const updateNodePrompt = useCallback((nodeId, prompt) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, customPrompt: prompt } : n))
    );
  }, []);

  const toggleEdge = useCallback((fromId, toId) => {
    setEdges((prev) => {
      const exists = prev.some(([f, t]) => f === fromId && t === toId);
      if (exists) return prev.filter(([f, t]) => !(f === fromId && t === toId));
      return [...prev, [fromId, toId]];
    });
  }, []);

  // ─── Pipeline Execution ─────────────────────────────────────────────
  const runPipeline = useCallback(async () => {
    if (nodes.length === 0 || !projectDesc.trim()) return;
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setActiveTab('canvas');
    setExecutionLog([]);
    setOutputs({});
    setRunPhase('Starting pipeline...');

    try {
      await executePipeline({
        nodes,
        edges,
        projectDesc,
        mode: execMode,
        signal: controller.signal,
        onStatusChange: (nodeId, status) => {
          setNodeStatuses((prev) => ({ ...prev, [nodeId]: status }));
          if (status === 'running') {
            const tmpl = NODE_TEMPLATES.find((t) => t.id === nodeId);
            setRunPhase(`Generating: ${tmpl?.label || nodeId}`);
          }
        },
        onOutput: (nodeId, output) => {
          setOutputs((prev) => ({ ...prev, [nodeId]: output }));
        },
        onLog: (msg) => {
          setExecutionLog((prev) => [
            ...prev,
            { time: new Date().toLocaleTimeString(), msg },
          ]);
        },
      });
      setRunPhase('Pipeline complete');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setRunPhase(`Error: ${err.message}`);
        setExecutionLog((prev) => [
          ...prev,
          { time: new Date().toLocaleTimeString(), msg: `✗ ${err.message}` },
        ]);
      }
    } finally {
      setIsRunning(false);
    }
  }, [nodes, edges, projectDesc, execMode]);

  const stopPipeline = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
    setRunPhase('Aborted');
  }, []);

  const resetAll = useCallback(() => {
    abortRef.current?.abort();
    setShowTemplates(true);
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setOutputs({});
    setNodeStatuses({});
    setExecutionLog([]);
    setIsRunning(false);
    setRunPhase('');
  }, []);

  // ─── Derived ────────────────────────────────────────────────────────
  const availableNodes = NODE_TEMPLATES.filter(
    (t) => !nodes.find((n) => n.templateId === t.id)
  );
  const hasOutputs = Object.keys(outputs).length > 0;
  const hasLog = executionLog.length > 0;

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      {/* Header */}
      <header className="border-b border-gray-800 px-5 py-3 flex items-center justify-between backdrop-blur-md bg-gray-950/80 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-indigo-500/20">
            ⚡
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-50 leading-tight">
              Dev Orchestrator
            </h1>
            <p className="text-[11px] text-gray-500 uppercase tracking-widest">
              DAG Pipeline Builder
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-[10px] text-gray-600 px-2.5 py-1 bg-gray-900 rounded-md border border-gray-800 font-mono">
            {nodes.length} nodes · {edges.length} edges
          </span>
          {!showTemplates && (
            <button
              onClick={resetAll}
              className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
            >
              ↻ Reset
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
            title="API Keys & Provider Settings"
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      <div className="flex" style={{ height: 'calc(100vh - 57px)' }}>
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ─── Template Selector ─── */}
          {showTemplates && (
            <TemplateSelector
              projectDesc={projectDesc}
              onProjectDescChange={setProjectDesc}
              onSelectTemplate={loadTemplate}
              onStartBlank={() => {
                setShowTemplates(false);
                setShowNodePicker(true);
              }}
            />
          )}

          {/* ─── Pipeline Builder ─── */}
          {!showTemplates && (
            <>
              {/* Toolbar */}
              <div className="px-4 py-2.5 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 flex-wrap gap-2">
                <div className="flex gap-1.5 items-center">
                  {/* Tabs */}
                  {[
                    { id: 'canvas', label: '🗺️ Canvas', ready: true },
                    { id: 'outputs', label: '📄 Outputs', ready: hasOutputs },
                    { id: 'log', label: '📜 Log', ready: hasLog },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => tab.ready && setActiveTab(tab.id)}
                      disabled={!tab.ready}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === tab.id
                          ? 'bg-indigo-600 text-white'
                          : tab.ready
                            ? 'text-gray-400 hover:text-gray-200'
                            : 'text-gray-700 cursor-not-allowed'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  <div className="w-px h-5 bg-gray-800 mx-1" />
                  <button
                    onClick={() => setShowNodePicker(!showNodePicker)}
                    className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    + Add Node
                  </button>
                </div>

                <div className="flex gap-2 items-center">
                  {/* Execution Mode */}
                  <div className="flex bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
                    {[
                      { id: 'parallel', label: '⫘ Parallel' },
                      { id: 'sequential', label: '↓ Sequential' },
                      { id: 'dag', label: '◈ DAG' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setExecMode(m.id)}
                        className={`px-3 py-1 text-[11px] font-medium transition-all ${
                          execMode === m.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Project desc quick-edit */}
                  {projectDesc && (
                    <span
                      className="text-[10px] text-gray-600 max-w-[200px] truncate px-2 py-1 bg-gray-900 rounded border border-gray-800 cursor-help"
                      title={projectDesc}
                    >
                      📝 {projectDesc.slice(0, 40)}…
                    </span>
                  )}

                  {/* Run / Stop */}
                  {isRunning ? (
                    <button
                      onClick={stopPipeline}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-1.5"
                    >
                      ■ Stop
                    </button>
                  ) : (
                    <button
                      onClick={runPipeline}
                      disabled={nodes.length === 0 || !projectDesc.trim()}
                      className="px-5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      ▶ Run Pipeline
                    </button>
                  )}
                </div>
              </div>

              {/* Status bar when running */}
              {isRunning && (
                <div className="px-4 py-1.5 bg-indigo-950/30 border-b border-indigo-900/30 flex items-center gap-2">
                  <svg
                    className="animate-spin h-3 w-3 text-indigo-400"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span className="text-xs text-indigo-300 font-medium">
                    {runPhase}
                  </span>
                </div>
              )}

              {/* Node Picker Drawer */}
              {showNodePicker && (
                <div className="px-4 py-2.5 bg-[#0d1117] border-b border-gray-800 flex gap-2 flex-wrap items-center animate-slide-in">
                  <span className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider mr-1">
                    Add:
                  </span>
                  {availableNodes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => addNode(t.id)}
                      className="text-[11px] px-3 py-1 rounded-lg border flex items-center gap-1 transition-all hover:brightness-125"
                      style={{
                        background: `${t.color}11`,
                        borderColor: `${t.color}33`,
                        color: t.color,
                      }}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                  {availableNodes.length === 0 && (
                    <span className="text-[11px] text-gray-600">
                      All nodes added
                    </span>
                  )}
                </div>
              )}

              {/* ─── Tab Content ─── */}
              <div className="flex flex-1 overflow-hidden">
                {/* Canvas Tab */}
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
                        onUpdateModel={updateNodeModel}
                        onToggleEdge={toggleEdge}
                        onRemoveNode={removeNode}
                        onUpdatePrompt={updateNodePrompt}
                      />
                    )}
                  </>
                )}

                {/* Outputs Tab */}
                {activeTab === 'outputs' && (
                  <div className="flex-1 overflow-auto p-5">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {Object.entries(outputs).map(([nodeId, output]) => {
                        const tmpl = NODE_TEMPLATES.find(
                          (t) => t.id === nodeId
                        );
                        const isError =
                          nodeStatuses[nodeId] === 'error' ||
                          (typeof output === 'string' && output.startsWith('ERROR:'));
                        return (
                          <div
                            key={nodeId}
                            className="bg-gray-900 border rounded-xl overflow-hidden"
                            style={{ borderColor: isError ? '#7f1d1d' : '#1f2937' }}
                          >
                            <div
                              className="px-4 py-3 border-b border-gray-800 flex items-center gap-2"
                              style={{ background: isError ? '#7f1d1d15' : `${tmpl?.color}08` }}
                            >
                              <span className="text-base">{tmpl?.icon}</span>
                              <span className="text-sm font-semibold text-gray-100">
                                {tmpl?.label}
                              </span>
                              {isError ? (
                                <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-red-950/50 text-red-400 border border-red-900/30">
                                  ✗ Error
                                </span>
                              ) : (
                                <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-900/30">
                                  ✓ Complete
                                </span>
                              )}
                            </div>
                            <pre
                              className={`p-4 text-xs whitespace-pre-wrap font-mono max-h-96 overflow-y-auto ${isError ? 'text-red-400' : 'text-gray-400'}`}
                            >
                              {output}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Log Tab */}
                {activeTab === 'log' && (
                  <div className="flex-1 overflow-auto p-5">
                    <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 font-mono">
                      {executionLog.map((entry, i) => (
                        <div
                          key={i}
                          className={`text-xs py-1 border-b border-gray-900 ${
                            entry.msg.startsWith('✓')
                              ? 'text-emerald-400'
                              : entry.msg.startsWith('🏁')
                                ? 'text-violet-400'
                                : entry.msg.startsWith('✗')
                                  ? 'text-red-400'
                                  : 'text-gray-400'
                          }`}
                        >
                          <span className="text-gray-600 mr-3">
                            {entry.time}
                          </span>
                          {entry.msg}
                        </div>
                      ))}
                      {executionLog.length === 0 && (
                        <div className="text-xs text-gray-700 text-center py-8">
                          No execution history yet
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
