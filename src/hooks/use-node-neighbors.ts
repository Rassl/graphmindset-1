"use client"

import { useEffect, useMemo, useState } from "react"
import { getNode } from "@/lib/graph-api"
import { isMocksEnabled, MOCK_FULL_NODES } from "@/lib/mock-data"
import { useGraphStore } from "@/stores/graph-store"
import type { GraphNode, GraphEdge } from "@/lib/graph-api"

export interface Neighbor {
  node: GraphNode
  edgeType: string
}

export interface NodeNeighborsResult {
  neighbors: Neighbor[]
  // True while the lazy 1-hop fetch is still in flight and the store hasn't
  // already supplied neighbours — lets a card show a spinner instead of a bare
  // centre disc.
  loading: boolean
}

// Session-lived cache of each node's fetched 1-hop neighbourhood, shared across
// every mini-graph. A node browsed on the feed and later in My Content fetches
// once; an in-flight map dedups concurrent mounts of the same ref_id. Never
// invalidated — the neighbourhood of a given node is stable enough for a
// session, and the set is bounded by how many distinct nodes the user scrolls.
const cache = new Map<string, { nodes: GraphNode[]; edges: GraphEdge[] }>()
const inflight = new Map<string, Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>>()

// Resolves a node's 1-hop neighbours for a mini radial graph. Seeds instantly
// from whatever the graph store already holds (so feed nodes with in-store
// edges render with zero latency), and — when `fetch` is true — lazily pulls
// the node's own neighbourhood from the API to fill in the rest. `fetch` is
// gated by the caller on viewport visibility so a long list doesn't fire a
// request per card up front.
export function useNodeNeighbors(refId: string, fetch: boolean): NodeNeighborsResult {
  const storeNodes = useGraphStore((s) => s.nodes)
  const storeEdges = useGraphStore((s) => s.edges)
  // Bumped when this ref_id's cache entry lands so the memo recomputes.
  const [cacheVersion, setCacheVersion] = useState(0)

  useEffect(() => {
    if (!fetch || cache.has(refId)) return
    let cancelled = false

    // Mocks resolve through the same async path so the cache write + setState
    // never happen synchronously inside the effect body.
    const load =
      inflight.get(refId) ??
      (async () => {
        if (isMocksEnabled()) {
          const mock = MOCK_FULL_NODES[refId]
          return { nodes: mock?.nodes ?? [], edges: mock?.edges ?? [] }
        }
        const res = await getNode(refId, "edges")
        return { nodes: res.nodes ?? [], edges: res.edges ?? [] }
      })()
    inflight.set(refId, load)
    load
      .then((data) => {
        cache.set(refId, data)
        if (!cancelled) setCacheVersion((v) => v + 1)
      })
      .catch(() => {
        // Swallow — the store seed (if any) still renders; a later mount retries.
      })
      .finally(() => inflight.delete(refId))

    return () => {
      cancelled = true
    }
  }, [refId, fetch])

  return useMemo(() => {
    const nodeMap = new Map(storeNodes.map((n) => [n.ref_id, n]))
    const edges: GraphEdge[] = [...storeEdges]
    const cached = cache.get(refId)
    if (cached) {
      for (const n of cached.nodes) if (!nodeMap.has(n.ref_id)) nodeMap.set(n.ref_id, n)
      edges.push(...cached.edges)
    }

    const seen = new Set<string>()
    const out: Neighbor[] = []
    for (const e of edges) {
      if (e.source !== refId && e.target !== refId) continue
      const peerId = e.source === refId ? e.target : e.source
      if (peerId === refId || seen.has(peerId)) continue
      const peer = nodeMap.get(peerId)
      if (!peer) continue
      seen.add(peerId)
      out.push({ node: peer, edgeType: e.edge_type })
    }
    // Still loading when a fetch was asked for, the cache hasn't landed yet, and
    // the store didn't already supply any neighbours to show in the meantime.
    const loading = fetch && !cache.has(refId) && out.length === 0
    return { neighbors: out, loading }
    // cacheVersion is a deliberate dep: a landed fetch bumps it so the
    // neighbours re-resolve from the now-populated cache, even though the body
    // reads `cache` (a module ref the linter can't see) rather than the counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeNodes, storeEdges, refId, fetch, cacheVersion])
}
