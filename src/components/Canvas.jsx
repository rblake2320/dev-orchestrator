import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { NODE_TEMPLATES, MODEL_OPTIONS } from '../lib/models';
import { computeLayout } from '../lib/pipeline';
import { AGENT_PROTOCOLS } from '../lib/agents';

const CARD_W = 180;
const CARD_H = 72;
const PORT_R = 6;
const PAD = 40;

// ─── Edge Line ────────────────────────────────────────────────────────────────
function EdgeLine({ from, to, positions, onRemove }) {
  if (!positions[from] || !positions[to]) return null;
  const x1 = positions[from].x + CARD_W / 2;
  const y1 = positions[from].y + CARD_H;
  const x2 = positions[to].x + CARD_W / 2;
  const y2 = positions[to].y;
  const midY = (y1 + y2) / 2;
  const midX = (x1 + x2) / 2;
  return (
    <g>
      <path
        d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`}
        fill="none"
        stroke="#374151"
        strokeWidth="1.5"
        markerEnd="url(#arrow)"
        className="transition-all duration-200"
      />
      {/* Invisible wider hit target for removing edges */}
      <path
        d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`}
        fill="none"
        stroke="transparent"
        strokeWidth="10"
        style={{ cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); onRemove?.(from, to); }}
        title="Click to remove edge"
      />
      {/* Midpoint delete dot — shown on hover via CSS trick */}
      <circle
        cx={midX}
        cy={(y1 + y2) / 2}
        r={5}
        fill="#1f2937"
        stroke="#374151"
        strokeWidth="1"
        style={{ cursor: 'pointer', opacity: 0.7 }}
        onClick={(e) => { e.stopPropagation(); onRemove?.(from, to); }}
        title="Remove edge"
      />
    </g>
  );
}

// ─── Node Card ────────────────────────────────────────────────────────────────
function NodeCard({ node, pos, isSelected, status, agents, onClick, onDragStart, onPortMouseDown, connectingFrom }) {
  const template = NODE_TEMPLATES.find((t) => t.id === (node.templateId || node.id)) || {};
  const model = node.model ? MODEL_OPTIONS.find((m) => m.id === node.model) : null;
  const agent = node.agentId ? (agents || []).find((a) => a.id === node.agentId) : null;
  const agentProto = agent ? AGENT_PROTOCOLS[agent.protocol] : null;

  const statusColor = {
    idle:    'rgba(55,65,81,0.6)',
    running: agent ? (agentProto?.color || '#6366f1') : (template.color || '#6366f1'),
    healing: '#f59e0b',
    done:    '#10b981',
    waiting: '#f59e0b',
    error:   '#ef4444',
    skipped: '#4b5563',
  }[status] || 'rgba(55,65,81,0.6)';

  const fill =
    status === 'done'    ? '#064e3b22' :
    status === 'running' ? `${template.color || '#6366f1'}15` :
    status === 'healing' ? '#78350f22' :
    status === 'error'   ? '#7f1d1d22' :
    status === 'skipped' ? '#1f293722' :
    '#111827';

  const displayLabel = node.customLabel || template.label || node.id;
  const isConnectTarget = connectingFrom && connectingFrom !== node.id;
  const isConnectSource = connectingFrom === node.id;
  const borderColor = isConnectTarget ? '#6366f1' : isSelected ? '#ffffff' : statusColor;
  const borderWidth = isConnectTarget || isSelected ? 2.5 : 1.5;

  // Port positions
  const outX = pos.x + CARD_W / 2;
  const outY = pos.y + CARD_H;
  const inX  = pos.x + CARD_W / 2;
  const inY  = pos.y;

  return (
    <g>
      {/* Drag hit area (covers card body) */}
      <rect
        x={pos.x} y={pos.y} width={CARD_W} height={CARD_H} rx={12}
        fill="transparent"
        style={{ cursor: 'move' }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (connectingFrom && connectingFrom !== node.id) {
            // Complete edge by clicking target body
            onPortMouseDown('complete', connectingFrom, node.id);
          } else {
            onDragStart(e, node.id, pos);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!connectingFrom) onClick();
        }}
      />

      {/* Card background */}
      <rect x={pos.x} y={pos.y} width={CARD_W} height={CARD_H} rx={12}
        fill={fill} stroke={borderColor} strokeWidth={borderWidth}
        className="transition-all duration-200" style={{ pointerEvents: 'none' }} />

      {/* Running bar */}
      {status === 'running' && (
        <rect x={pos.x} y={pos.y + CARD_H - 3} width={0} height={3} rx={1.5}
          fill={template.color || '#6366f1'} style={{ pointerEvents: 'none' }}>
          <animate attributeName="width" from="0" to={CARD_W} dur="2.5s" repeatCount="indefinite" />
        </rect>
      )}
      {status === 'healing' && (
        <rect x={pos.x} y={pos.y + CARD_H - 3} width={0} height={3} rx={1.5}
          fill="#f59e0b" style={{ pointerEvents: 'none' }}>
          <animate attributeName="width" from="0" to={CARD_W} dur="1.5s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Labels (no pointer events so drag works through them) */}
      <g style={{ pointerEvents: 'none' }}>
        <text x={pos.x + 14} y={pos.y + 28} fontSize="18">{template.icon}</text>
        <text x={pos.x + 38} y={pos.y + 29} fontSize="12" fontWeight="600" fill="#e5e7eb" fontFamily="system-ui,sans-serif">
          {displayLabel.length > 16 ? displayLabel.slice(0, 15) + '…' : displayLabel}
        </text>
        {template.webSearch && (
          <text x={pos.x + 38} y={pos.y + 43} fontSize="9" fill="#0ea5e9">🌐 web search</text>
        )}
        <text x={pos.x + 14} y={pos.y + 57} fontSize="10"
          fill={agent ? (agentProto?.color || '#6b7280') : '#6b7280'} fontFamily="system-ui,sans-serif">
          {agent
            ? `${agentProto?.icon || '🤖'} ${agent.label.length > 14 ? agent.label.slice(0, 13) + '…' : agent.label}`
            : (model?.label || 'auto')}
        </text>
        {status === 'done'    && <text x={pos.x + CARD_W - 22} y={pos.y + 28} fontSize="14" fill="#10b981">✓</text>}
        {status === 'error'   && <text x={pos.x + CARD_W - 22} y={pos.y + 28} fontSize="14" fill="#ef4444">✗</text>}
        {status === 'skipped' && <text x={pos.x + CARD_W - 22} y={pos.y + 28} fontSize="14" fill="#4b5563">⊘</text>}
        {status === 'running' && (
          <g transform={`translate(${pos.x + CARD_W - 22}, ${pos.y + 20})`}>
            <circle cx="5" cy="5" r="5" fill="none" stroke={template.color || '#6366f1'} strokeWidth="2" strokeDasharray="20">
              <animateTransform attributeName="transform" type="rotate" from="0 5 5" to="360 5 5" dur="1s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
        {status === 'healing' && (
          <g transform={`translate(${pos.x + CARD_W - 22}, ${pos.y + 20})`}>
            <circle cx="5" cy="5" r="5" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="16 6">
              <animateTransform attributeName="transform" type="rotate" from="0 5 5" to="360 5 5" dur="1s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
      </g>

      {/* Output port (bottom-center) — drag from here to connect */}
      <circle
        cx={outX} cy={outY} r={isConnectSource ? PORT_R + 2 : PORT_R}
        fill={isConnectSource ? '#6366f1' : '#1f2937'}
        stroke={isConnectSource ? '#fff' : (template.color || '#6366f1')}
        strokeWidth={isConnectSource ? 2 : 1.5}
        style={{ cursor: 'crosshair' }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (isConnectSource) {
            onPortMouseDown('cancel', node.id, null);
          } else {
            onPortMouseDown('start', node.id, null);
          }
        }}
      />

      {/* Input port (top-center) — only visible when in connect mode */}
      {isConnectTarget && (
        <circle
          cx={inX} cy={inY} r={PORT_R + 2}
          fill="#6366f1" stroke="#fff" strokeWidth="2"
          style={{ cursor: 'crosshair' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onPortMouseDown('complete', connectingFrom, node.id);
          }}
        />
      )}
    </g>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────────
export default function Canvas({ nodes, edges, selectedNode, nodeStatuses, agents, onSelectNode, onToggleEdge }) {
  const baseLayout = useMemo(
    () => computeLayout(nodes.map((n) => n.id), edges),
    [nodes, edges]
  );

  // Per-node custom positions from drag (overrides computed layout)
  const [customPos, setCustomPos] = useState({});

  // Reset custom positions when node count changes
  useEffect(() => {
    setCustomPos({});
  }, [nodes.length]);

  // Merged positions
  const positions = useMemo(() => {
    const merged = { ...baseLayout.positions };
    Object.entries(customPos).forEach(([id, p]) => {
      if (id in merged) merged[id] = p;
    });
    return merged;
  }, [baseLayout.positions, customPos]);

  // Pan / zoom
  const [scale, setScale]       = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Drag state
  const dragging = useRef(null); // { nodeId, startSvgX, startSvgY, origX, origY }
  const isPanning = useRef(false);
  const panStart  = useRef({ x: 0, y: 0 });

  // Connect mode
  const [connectFrom, setConnectFrom] = useState(null);
  const [connectMouse, setConnectMouse] = useState(null); // in group-space coords

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setScale((s) => Math.min(Math.max(s * (e.deltaY < 0 ? 1.1 : 0.9), 0.2), 4));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Reset view when pipeline changes
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [nodes.length]);

  // Convert screen → group-space coords
  const toGroupSpace = useCallback((screenX, screenY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (screenX - rect.left - translate.x) / scale - PAD,
      y: (screenY - rect.top  - translate.y) / scale - PAD,
    };
  }, [scale, translate]);

  const onDragStart = useCallback((e, nodeId, pos) => {
    const gp = toGroupSpace(e.clientX, e.clientY);
    dragging.current = { nodeId, startX: gp.x, startY: gp.y, origX: pos.x, origY: pos.y };
  }, [toGroupSpace]);

  const onPortMouseDown = useCallback((action, fromId, toId) => {
    if (action === 'start') {
      setConnectFrom(fromId);
      setConnectMouse(null);
    } else if (action === 'complete') {
      if (fromId && toId && fromId !== toId) {
        onToggleEdge?.(fromId, toId);
      }
      setConnectFrom(null);
      setConnectMouse(null);
    } else {
      setConnectFrom(null);
      setConnectMouse(null);
    }
  }, [onToggleEdge]);

  const onCanvasMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (connectFrom) {
      setConnectFrom(null);
      setConnectMouse(null);
      return;
    }
    isPanning.current = true;
    panStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
  }, [translate, connectFrom]);

  const onCanvasMouseMove = useCallback((e) => {
    if (dragging.current) {
      const { nodeId, startX, startY, origX, origY } = dragging.current;
      const gp = toGroupSpace(e.clientX, e.clientY);
      setCustomPos((prev) => ({
        ...prev,
        [nodeId]: { x: origX + (gp.x - startX), y: origY + (gp.y - startY) },
      }));
    } else if (isPanning.current) {
      setTranslate({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    }
    if (connectFrom) {
      setConnectMouse(toGroupSpace(e.clientX, e.clientY));
    }
  }, [toGroupSpace, connectFrom]);

  const onCanvasMouseUp = useCallback(() => {
    dragging.current = null;
    isPanning.current = false;
  }, []);

  const svgW = Math.max(
    Math.max(...Object.values(positions).map((p) => p.x + CARD_W), 0) + PAD * 2,
    600,
  );
  const svgH = Math.max(
    Math.max(...Object.values(positions).map((p) => p.y + CARD_H), 0) + PAD * 2,
    240,
  );

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-600">
        <div className="text-5xl mb-3 opacity-30">◇</div>
        <p className="text-sm">Add nodes using the "+ Add Node" button above</p>
        <p className="text-xs mt-1 text-gray-700">Then drag the ● port to connect nodes, and drag cards to arrange</p>
      </div>
    );
  }

  // In-progress connection line source
  const connSrcPos = connectFrom ? positions[connectFrom] : null;
  const connLineStart = connSrcPos
    ? { x: connSrcPos.x + CARD_W / 2, y: connSrcPos.y + CARD_H }
    : null;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative select-none"
      style={{ cursor: connectFrom ? 'crosshair' : (dragging.current ? 'grabbing' : 'grab') }}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      onMouseLeave={onCanvasMouseUp}
    >
      {/* Hint banner */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        {connectFrom ? (
          <div className="text-[10px] text-indigo-300 bg-indigo-950/90 px-3 py-1 rounded-full border border-indigo-700 shadow">
            Click the <strong>●</strong> input port on any other node to connect — or click background to cancel
          </div>
        ) : (
          <div className="text-[10px] text-gray-600 bg-gray-900/70 px-3 py-1 rounded-full border border-gray-800">
            Drag cards to move · Click <strong className="text-gray-500">●</strong> output port to connect · Click card to inspect
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
        {[
          { label: '+', action: () => setScale((s) => Math.min(s * 1.2, 4)) },
          { label: '⊙', action: () => { setScale(1); setTranslate({ x: 0, y: 0 }); }, title: 'Reset view' },
          { label: '−', action: () => setScale((s) => Math.max(s * 0.8, 0.2)) },
        ].map(({ label, action, title }) => (
          <button key={label} onClick={action} title={title}
            className="w-8 h-8 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors flex items-center justify-center text-sm font-mono"
            onMouseDown={(e) => e.stopPropagation()}>
            {label}
          </button>
        ))}
      </div>
      <div className="absolute bottom-4 left-4 z-10 text-[10px] text-gray-600 font-mono px-2 py-1 bg-gray-900/80 rounded border border-gray-800 pointer-events-none">
        {Math.round(scale * 100)}%
      </div>

      {/* SVG canvas */}
      <div style={{ transform: `translate(${translate.x}px,${translate.y}px) scale(${scale})`, transformOrigin: '0 0', width: svgW, height: svgH }}>
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
            </marker>
          </defs>
          <g transform={`translate(${PAD},${PAD})`}>
            {/* Existing edges */}
            {edges.map(([f, t], i) => (
              <EdgeLine
                key={`${f}-${t}-${i}`}
                from={f} to={t}
                positions={positions}
                onRemove={onToggleEdge}
              />
            ))}

            {/* In-progress connection line */}
            {connectFrom && connLineStart && connectMouse && (
              <line
                x1={connLineStart.x} y1={connLineStart.y}
                x2={connectMouse.x}  y2={connectMouse.y}
                stroke="#6366f1" strokeWidth="2" strokeDasharray="6 3"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Nodes */}
            {nodes.map((n) => (
              <NodeCard
                key={n.id}
                node={n}
                pos={positions[n.id] || { x: 0, y: 0 }}
                isSelected={selectedNode === n.id}
                status={nodeStatuses[n.id] || 'idle'}
                agents={agents}
                onClick={() => onSelectNode(selectedNode === n.id ? null : n.id)}
                onDragStart={onDragStart}
                onPortMouseDown={onPortMouseDown}
                connectingFrom={connectFrom}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
