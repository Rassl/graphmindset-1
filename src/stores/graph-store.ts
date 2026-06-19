"use client"

import { create } from "zustand"
import type { GraphNode, GraphEdge } from "@/lib/graph-api"

interface GraphState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNode: GraphNode | null
  loading: boolean
  hoveredNode: GraphNode | null
  sidebarSelectedNode: GraphNode | null
  // ref_ids whose 1-hop neighborhood is currently being fetched. Drives the
  // "loading connections" indicator; a Set so concurrent expansions coexist.
  loadingNeighborRefs: Set<string>
  // Bumps only on full replacement (setGraphData). Consumers that only care
  // about "new search" semantics should depend on this, not on nodes/edges,
  // so appends via addNodes don't trigger a view reset.
  dataVersion: number
  setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void
  setSelectedNode: (node: GraphNode | null) => void
  setLoading: (loading: boolean) => void
  addNodes: (nodes: GraphNode[], edges: GraphEdge[]) => void
  setHoveredNode: (node: GraphNode | null) => void
  setSidebarSelectedNode: (node: GraphNode | null) => void
  beginNeighborLoad: (refId: string) => void
  endNeighborLoad: (refId: string) => void
  clearSelection: () => void
  returnTo: string | null
  setReturnTo: (url: string | null) => void
}

function edgeKey(e: GraphEdge): string {
  return `${e.source}\u0000${e.target}\u0000${e.edge_type}`
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  loading: false,
  hoveredNode: null,
  sidebarSelectedNode: null,
  loadingNeighborRefs: new Set<string>(),
  dataVersion: 0,
  setGraphData: (nodes, edges) =>
    set((s) => ({ nodes, edges, dataVersion: s.dataVersion + 1 })),
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  setLoading: (loading) => set({ loading }),
  addNodes: (newNodes, newEdges) =>
    set((s) => {
      const indexByRef = new Map(s.nodes.map((n, i) => [n.ref_id, i]))
      const toAppend: GraphNode[] = []
      // Lazily cloned on the first in-place enrichment so we never mutate the
      // current array reference.
      let nextNodes: GraphNode[] | null = null
      // Freshly-merged objects keyed by ref_id, so the current selection can be
      // re-pointed at them below.
      const enrichedByRef = new Map<string, GraphNode>()

      for (const incoming of newNodes) {
        const idx = indexByRef.get(incoming.ref_id)
        if (idx === undefined) {
          toAppend.push(incoming)
          continue
        }
        // Node already present (e.g. a fixture Station seeded before its
        // backend detail was fetched). Fill in only the properties it's
        // *missing* — like image_url from the detail fetch — so authoritative
        // fixture fields (mapX/mapZ/line/status) are never clobbered.
        const existing = (nextNodes ?? s.nodes)[idx]
        const existingProps = existing.properties
        const incomingProps = incoming.properties
        const fillKeys = Object.keys(incomingProps).filter((k) => {
          const inc = incomingProps[k]
          if (inc === undefined || inc === null || inc === "") return false
          const cur = existingProps[k]
          return cur === undefined || cur === null || cur === ""
        })
        if (fillKeys.length === 0) continue
        const mergedProps = { ...existingProps }
        for (const k of fillKeys) mergedProps[k] = incomingProps[k]
        const merged = { ...existing, properties: mergedProps }
        if (!nextNodes) nextNodes = [...s.nodes]
        nextNodes[idx] = merged
        enrichedByRef.set(incoming.ref_id, merged)
      }

      const existingEdgeKeys = new Set(s.edges.map(edgeKey))
      const uniqueEdges = newEdges.filter((e) => !existingEdgeKeys.has(edgeKey(e)))

      const nodesChanged = nextNodes !== null || toAppend.length > 0
      if (!nodesChanged && uniqueEdges.length === 0) return s

      const baseNodes = nextNodes ?? s.nodes
      // Re-point the live selection at its enriched object so panels bound to
      // selectedNode/sidebarSelectedNode (e.g. the detail panel reading
      // image_url) pick up the backend fields without their own refetch.
      const selectedNode =
        s.selectedNode && enrichedByRef.get(s.selectedNode.ref_id)
          ? enrichedByRef.get(s.selectedNode.ref_id)!
          : s.selectedNode
      const sidebarSelectedNode =
        s.sidebarSelectedNode && enrichedByRef.get(s.sidebarSelectedNode.ref_id)
          ? enrichedByRef.get(s.sidebarSelectedNode.ref_id)!
          : s.sidebarSelectedNode

      return {
        nodes: nodesChanged ? [...baseNodes, ...toAppend] : s.nodes,
        edges: uniqueEdges.length > 0 ? [...s.edges, ...uniqueEdges] : s.edges,
        selectedNode,
        sidebarSelectedNode,
      }
    }),
  setHoveredNode: (hoveredNode) => set({ hoveredNode }),
  setSidebarSelectedNode: (sidebarSelectedNode) => set({ sidebarSelectedNode }),
  beginNeighborLoad: (refId) =>
    set((s) => {
      if (s.loadingNeighborRefs.has(refId)) return s
      const next = new Set(s.loadingNeighborRefs)
      next.add(refId)
      return { loadingNeighborRefs: next }
    }),
  endNeighborLoad: (refId) =>
    set((s) => {
      if (!s.loadingNeighborRefs.has(refId)) return s
      const next = new Set(s.loadingNeighborRefs)
      next.delete(refId)
      return { loadingNeighborRefs: next }
    }),
  clearSelection: () =>
    set({ selectedNode: null, sidebarSelectedNode: null, hoveredNode: null }),
  returnTo: null,
  setReturnTo: (returnTo) => set({ returnTo }),
}))
