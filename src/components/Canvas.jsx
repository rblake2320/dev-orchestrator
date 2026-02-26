import { useMemo } from 'react';
import { NODE_TEMPLATES, MODEL_OPTIONS } from '../lib/models';
import { computeLayout } from '../lib/pipeline';

// ─── Edge Line (Bézier curve with arrow) ────────────────────────────────
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

// ─── Node Card (SVG group) ──────────────────────────────────────────────
function NodeCard({ node, pos, w, h, isSelected, status, onClick }) {
  const template = NODE_TEMPLATES.find((t) => t.id === node.templateId) || {};
  const model = node.model
    ? MODEL_OPTIONS.find((m) => m.id === node.model)
    : null;

  const statusColors = {
    idle: 'rgba(55,65,81,0.6)',
    running: template.color || '#6366f1',
    done: '#10b981',
    waiting: '#f59e0b',
    error: '#ef4444',
  };

  const border = isSelected ? '#fff' : statusColors[status] || statusColors.idle;
  const fill =
    status === 'done'
      ? '#064e3b22'
      : status === 'running'
        ? `${template.color}11`
        : status === 'error'
          ? '#7f1d1d22'
          : '#111827';

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect
        x={pos.x}
        y={pos.y}
        width={w}
        height={h}
        rx={12}
        fill={fill}
        stroke={border}
        strokeWidth={isSelected ? 2.5 : 1.5}
        className="transition-all duration-300"
      />
      {/* Progress bar when running */}
      {status === 'running' && (
        <rect
          x={pos.x}
          y={pos.y + h - 4}
          width={0}
          height={3}
          rx={1.5}
          fill={template.color}
        >
          <animate
            attributeName="width"
            from="0"
            to={w}
            dur="2.5s"
            repeatCount="indefinite"
          />
        </rect>
      )}
      {/* Icon + label */}
      <text x={pos.x + 14} y={pos.y + 28} fontSize="18">
        {template.icon}
      </text>
      <text
        x={pos.x + 38}
        y={pos.y + 29}
        fontSize="12"
        fontWeight="600"
        fill="#e5e7eb"
        fontFamily="'DM Sans', sans-serif"
      >
        {template.label}
      </text>
      {/* Model label */}
      <text
        x={pos.x + 14}
        y={pos.y + 50}
        fontSize="10"
        fill="#6b7280"
        fontFamily="'DM Sans', sans-serif"
      >
        {model?.label || 'auto'}
      </text>
      {/* Status icon */}
      {status === 'done' && (
        <text x={pos.x + w - 24} y={pos.y + 28} fontSize="14" fill="#10b981">
          ✓
        </text>
      )}
      {status === 'error' && (
        <text x={pos.x + w - 24} y={pos.y + 28} fontSize="14" fill="#ef4444">
          ✗
        </text>
      )}
      {status === 'running' && (
        <g transform={`translate(${pos.x + w - 24}, ${pos.y + 20})`}>
          <circle
            cx="6"
            cy="6"
            r="5"
            fill="none"
            stroke={template.color}
            strokeWidth="2"
            strokeDasharray="20"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 6 6"
              to="360 6 6"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      )}
    </g>
  );
}

// ─── Canvas ─────────────────────────────────────────────────────────────
export default function Canvas({
  nodes,
  edges,
  selectedNode,
  nodeStatuses,
  onSelectNode,
}) {
  const layout = useMemo(
    () => computeLayout(nodes.map((n) => n.id), edges),
    [nodes, edges]
  );

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
    <div className="flex-1 overflow-auto p-5 flex justify-center">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="max-w-full"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
          </marker>
        </defs>
        <g transform={`translate(${pad}, ${pad})`}>
          {/* Edges */}
          {edges.map(([f, t], i) => (
            <EdgeLine
              key={`${f}-${t}-${i}`}
              from={f}
              to={t}
              positions={layout.positions}
              cardW={layout.CARD_W}
              cardH={layout.CARD_H}
            />
          ))}
          {/* Nodes */}
          {nodes.map((n) => (
            <NodeCard
              key={n.id}
              node={n}
              pos={layout.positions[n.id] || { x: 0, y: 0 }}
              w={layout.CARD_W}
              h={layout.CARD_H}
              isSelected={selectedNode === n.id}
              status={nodeStatuses[n.id] || 'idle'}
              onClick={() =>
                onSelectNode(selectedNode === n.id ? null : n.id)
              }
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
