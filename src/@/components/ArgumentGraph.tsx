import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { GraphData } from '@/types'

interface ArgumentGraphProps {
  data: GraphData
}

const KIND_STYLE: Record<
  string,
  { bg: string; border: string; color: string }
> = {
  student: { bg: '#e0f2fe', border: '#0ea5e9', color: '#075985' },
  consensus: { bg: '#dcfce7', border: '#16a34a', color: '#14532d' },
  divergence: { bg: '#fee2e2', border: '#dc2626', color: '#7f1d1d' },
  neutral: { bg: '#f1f5f9', border: '#94a3b8', color: '#334155' },
}

/**
 * Sơ đồ Cây Lập luận Động (Argument Graph) dùng @xyflow/react.
 * - Node xanh lá: đồng thuận (consensus)
 * - Node đỏ: điểm bất đồng / divergence
 * - Node xanh dương: luận điểm của học sinh
 * Tự động bố trí theo lớp (layered) và cập nhật khi có dữ liệu mới.
 */
export function ArgumentGraph({ data }: ArgumentGraphProps) {
  const { nodes, edges } = useMemo(() => {
    // Bố trí tự động theo cột dựa trên "kind" để sơ đồ dễ đọc.
    const columns: Record<string, number> = {
      student: 0,
      consensus: 1,
      divergence: 2,
      neutral: 3,
    }
    const perColumnCount: Record<string, number> = {}

    const rfNodes: Node[] = data.nodes.map((n) => {
      const col = columns[n.kind] ?? 3
      const idx = perColumnCount[n.kind] ?? 0
      perColumnCount[n.kind] = idx + 1
      const style = KIND_STYLE[n.kind] ?? KIND_STYLE.neutral
      return {
        id: n.id,
        position: { x: col * 220, y: idx * 110 },
        data: { label: n.label },
        style: {
          background: style.bg,
          border: `2px solid ${style.border}`,
          color: style.color,
          borderRadius: 12,
          padding: 8,
          fontSize: 11,
          width: 180,
          whiteSpace: 'normal',
        },
      }
    })

    const rfEdges: Edge[] = data.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: true,
      labelStyle: { fontSize: 10, fill: '#475569' },
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
    }))

    return { nodes: rfNodes, edges: rfEdges }
  }, [data])

  if (data.nodes.length === 0) {
    return (
      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-xs text-muted-foreground">
        <span className="text-2xl">🌳</span>
        Sơ đồ cây lập luận sẽ xuất hiện ở đây sau lượt tranh luận đầu tiên.
      </div>
    )
  }

  return (
    <div className="h-full min-h-72 w-full overflow-hidden rounded-lg border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        minZoom={0.2}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

export default ArgumentGraph
