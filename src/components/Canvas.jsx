import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { NODE_TEMPLATES, MODEL_OPTIONS } from '../lib/models';
import { computeLayout } from '../lib/pipeline';
import { AGENT_PROTOCOLS } from '../lib/agents';

// ─── Edge Line (Bézier curve with arrow) ─────────────────────────────────────
function EdgeLine({ from, to, positions, cardW, cardH }) {
  if (!positions[from] || !positions[to]) return null;
  const x1 = positions[from].x + cardW / 2;
  const y1 = positions[from].y + cardH;
  const x2 = positions[to].x + cardW / 2;
  const y2 = positions[to].y;
  const midY = (y1 + y2) / 2;
  return (
    <path
      d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`}
      fill="none"
      stroke="#374151"
      strokeWidth="1.5"
      markerEnd="url(#arrow)"
      className="transition-all duration-300"
    />
  );
}

// ─── Node Card (SVG group) ────────────────────────────────────────────────────
function NodeCard({ node, pos, w, h, isSelected, status, agents, onClick }) {
  const template = NODE_TEMPLATES.find((t) => t.id === (node.templateId || node.id)) || {};
  const model = node.model ? MODEL_OPTIONS.find((m) => m.id === node.model) : null;
  const agent = node.agentId ? (agents || []).find((a) => a.id === node.agentId) : null;
  const agentProto = agent ? AGENT_PROTOCOLS[agent.protocol] : null;

  const agentRunColor = agentProto?.color || '#6366f1';

  const statusColors = {
    idle:    'rgba(55,65,81,0.6)',
    running: agent ? agentRunColor : (template.color || '#6366f1'),
    healing: '#f59e0b',
    done:    '#10b981',
    waiting: '#f59e0b',
    error:   '#ef4444',
    skipped: '#4b5563',
  };

  const border = isSelected ? '#fff' : (statusColors[status] || statusColors.idle);
  const fill =
    status === 'done'    ? '#064e3b22' :
    status === 'running' ? `${template.color}11` :
    status === 'healing' ? '#78350f22' :
    status === 'error'   ? '#7f1d1d22' :
    status === 'skipped' ? '#1f293722' :
    '#111827';

  // Use custom label if set, fall back to template label
  const displayLabel = node.customLabel || template.label || node.id;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={pos.x} y={pos.y} width={w} height={h} rx={12} fill={fill} stroke={border}
        strokeWidth={isSelected ? 2.5 : 1.5} className="transition-all duration-300" />

      {/* Running progress bar */}
      {status === 'running' && (
        <rect x={pos.x} y={pos.y + h - 4} width={0} height={3} rx={1.5} fill={template.color}>
          <animate attributeName="width" from="0" to={w} dur="2.5s" repeatCount="indefinite" />
        </rect>
      )}
      {/* Healing progress bar — amber */}
      {status === 'healing' && (
        <rect x={pos.x} y={pos.y + h - 4} width={0} height={3} rx={1.5} fill="#f59e0b">
          <animate attributeName="width" from="0" to={w} dur="1.5s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Icon */}
      <text x={pos.x + 14} y={pos.y + 28} fontSize="18">{template.icon}</text>

      {/* Label */}
      <text x={pos.x + 38} y={pos.y + 29} fontSize="12" fontWeight="600" fill="#e5e7eb" fontFamily="'DM Sans', sans-serif">
        {displayLabel.length > 16 ? displayLabel.slice(0, 15) + '…' : displayLabel}
      </text>

      {/* Web search indicator */}
      {template.webSearch && (
        <text x={pos.x + 38} y={pos.y + 42} fontSize="9" fill="#0ea5e9" fontFamily="sans-serif">🌐 web</text>
      )}

      {/* Agent or model label */}
      <text x={pos.x + 14} y={pos.y + 56} fontSize="10" fill={agent ? (agentProto?.color || '#6b7280') : '#6b7280'} fontFamily="'DM Sans', sans-serif">
        {agent ? `${agentProto?.icon || '🤖'} ${agent.label.length > 14 ? agent.label.slice(0, 13) + '…' : agent.label}` : (model?.label || 'auto')}
      </text>

      {/* Status icons */}
      {status === 'done'    && <text x={pos.x + w - 24} y={pos.y + 28} fontSize="14" fill="#10b981">✓</text>}
      {status === 'error'   && <text x={pos.x + w - 24} y={pos.y + 28} fontSize="14" fill="#ef4444">✗</text>}
      {status === 'skipped' && <text x={pos.x + w - 24} y={pos.y + 28} fontSize="14" fill="#4b5563">⊘</text>}

      {/* Healing spinner */}
      {status === 'healing' && (
        <g transform={`translate(${pos.x + w - 24}, ${pos.y + 20})`}>
          <circle cx="6" cy="6" r="5" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="16 6">
            <animateTransform attributeName="transform" type="rotate" from="0 6 6" to="360 6 6" dur="1s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
      {/* Running spinner */}
      {status === 'running' && (
        <g transform={`translate(${pos.x + w - 24}, ${pos.y + 20})`}>
          <circle cx="6" cy="6" r="5" fill="none" stroke={template.color} strokeWidth="2" strokeDasharray="20">
            <animateTransform attributeName="transform" type="rotate" from="0 6 6" to="360 6 6" dur="1s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </g>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────────
export default function Canvas({ nodes, edges, selectedNode, nodeStatuses, agents, onSelectNode }) {
  const layout = useMemo(
    () => computeLayout(nodes.map((n) => n.id), edges),
    [nodes, edges]
  );

  // ── Zoom / Pan state ──────────────────────────────────────────────────────
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Reset view when nodes change significantly
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [nodes.length]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale((s) => Math.min(Math.max(s * factor, 0.25), 4));
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    // Only start panning if not clicking a node (nodes have cursor:pointer on the g element)
    if (e.target.closest && e.target.closest('[data-node]')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
    e.currentTarget.style.cursor = 'grabbing';
  }, [translate]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning.current) return;
    setTranslate({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, []);

  const endPan = useCallback((e) => {
    isPanning.current = false;
    if (e.currentTarget) e.currentTarget.style.cursor = '';
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const pad = 40;
  const svgW = Math.max(layout.totalW + pad * 2, 600);
  const svgH = Math.max(layout.totalH + pad * 2, 200);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-600">
        <div className="text-5xl mb-3 opacity-30">◇</div>
        <p className="text-sm">Add nodes to start building your pipeline</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative select-none"
      style={{ cursor: 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endPan}
      onMouseLeave={endPan}
    >
      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
        <button
          onClick={() => setScale((s) => Math.min(s * 1.2, 4))}
          className="w-8 h-8 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors flex items-center justify-center text-sm"
          onMouseDown={(e) => e.stopPropagation()}
        >+</button>
        <button
          onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }}
          className="w-8 h-8 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors flex items-center justify-center text-[10px] font-mono"
          onMouseDown={(e) => e.stopPropagation()}
          title="Reset view"
        >⊙</button>
        <button
          onClick={() => setScale((s) => Math.max(s * 0.8, 0.25))}
          className="w-8 h-8 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors flex items-center justify-center text-sm"
          onMouseDown={(e) => e.stopPropagation()}
        >−</button>
      </div>

      {/* Zoom level badge */}
      <div className="absolute bottom-4 left-4 z-10 text-[10px] text-gray-600 font-mono px-2 py-1 bg-gray-900/80 rounded border border-gray-800">
        {Math.round(scale * 100)}%
      </div>

      <div
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          width: svgW,
          height: svgH,
        }}
      >
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5"
              markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
            </marker>
          </defs>
          <g transform={`translate(${pad}, ${pad})`}>
            {edges.map(([f, t], i) => (
              <EdgeLine key={`${f}-${t}-${i}`} from={f} to={t}
                positions={layout.positions} cardW={layout.CARD_W} cardH={layout.CARD_H} />
            ))}
            {nodes.map((n) => (
              <g key={n.id} data-node="true">
                <NodeCard
                  node={n}
                  pos={layout.positions[n.id] || { x: 0, y: 0 }}
                  w={layout.CARD_W}
                  h={layout.CARD_H}
                  isSelected={selectedNode === n.id}
                  status={nodeStatuses[n.id] || 'idle'}
                  agents={agents}
                  onClick={() => onSelectNode(selectedNode === n.id ? null : n.id)}
                />
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
