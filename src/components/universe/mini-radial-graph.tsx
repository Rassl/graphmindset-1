"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { useNodeNeighbors } from "@/hooks/use-node-neighbors"
import { resolveNodeThumbnail, resolveNodeTitle } from "@/lib/node-display"
import { getSchemaIconInfo } from "@/lib/schema-icons"
import { displayNodeType } from "@/lib/utils"
import type { GraphNode } from "@/lib/graph-api"
import type { SchemaNode } from "@/app/ontology/page"

// A fisheye (focus+context) lets us fan out many neighbours at a small base
// size and magnify whichever ones are near the pointer/finger, so a node with
// lots of connections stays legible without a wall of same-size discs.
const MAX_SATELLITES = 14

// Peak extra magnification at the focus centre (1 + strength = up to 2.6×).
const FISHEYE_STRENGTH = 1.6
// A satellite is "focused enough" to reveal its own label past this factor.
const LABEL_REVEAL = 1 + FISHEYE_STRENGTH * 0.4

interface MiniRadialGraphProps {
  centerNode: GraphNode
  schemas: SchemaNode[]
  // Called when the user taps the centre or any satellite. Callers route this
  // to whatever "open this node" means in their surface.
  onSelect: (node: GraphNode) => void
  // When true, lazily fetch the centre node's own 1-hop neighbourhood (once it
  // scrolls into view) instead of relying solely on edges already in the store.
  // Surfaces whose nodes don't carry in-store edges (feed, My Content) set this.
  fetchNeighbors?: boolean
}

// One circular node — a thumbnail when the node carries imagery, otherwise a
// tinted glyph keyed off the node's schema icon so the fallback still reads as
// "a Person / Episode / Place" rather than a blank disc.
function NodeDisc({
  node,
  schemas,
  diameter,
  highlight,
  onSelect,
}: {
  node: GraphNode
  schemas: SchemaNode[]
  diameter: number
  highlight?: boolean
  onSelect: (node: GraphNode) => void
}) {
  const thumb = resolveNodeThumbnail(node)
  const schema = schemas.find((s) => s.type === node.node_type)
  const { icon: Icon, accent } = getSchemaIconInfo(schema?.icon)
  const title = resolveNodeTitle(node, schemas)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect(node)
      }}
      title={`${title} · ${displayNodeType(node.node_type)}`}
      className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ width: diameter, height: diameter }}
    >
      <span
        className="absolute inset-0 rounded-full overflow-hidden ring-1"
        style={{
          // Centre node gets a glowing accent ring; satellites a quiet border.
          boxShadow: highlight
            ? `0 0 0 2px ${accent}, 0 0 22px ${accent}66`
            : `0 0 0 1px oklch(0.55 0.02 260 / 0.45)`,
        }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote graph thumbnails, no known dimensions
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: `${accent}1a` }}
          >
            <Icon
              style={{ color: accent, width: diameter * 0.42, height: diameter * 0.42 }}
              strokeWidth={1.5}
            />
          </span>
        )}
      </span>
    </button>
  )
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

export function MiniRadialGraph({
  centerNode,
  schemas,
  onSelect,
  fetchNeighbors = false,
}: MiniRadialGraphProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  // Measure the available width so the graph fills its card and the discs grow
  // with the screen.
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Only fetch once the card is actually on screen — keeps a long list from
  // firing a request per card before the user ever scrolls to it.
  const [visible, setVisible] = useState(!fetchNeighbors)
  useEffect(() => {
    if (!fetchNeighbors || visible) return
    const el = wrapRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [fetchNeighbors, visible])

  const { neighbors, loading } = useNodeNeighbors(centerNode.ref_id, fetchNeighbors && visible)
  const peers = useMemo(() => neighbors.slice(0, MAX_SATELLITES), [neighbors])

  // Fisheye focus point in graph-square coordinates (null = idle, everything at
  // base size). Written from pointer/touch moves over the square, coalesced to
  // one update per frame so a fast drag doesn't thrash React.
  const [focus, setFocus] = useState<{ x: number; y: number } | null>(null)
  const rafRef = useRef(0)
  const pendingRef = useRef<{ x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const rect = (svgRef.current ?? e.currentTarget as Element).getBoundingClientRect()
    pendingRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      setFocus(pendingRef.current)
    })
  }, [])
  const clearFocus = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    setFocus(null)
  }, [])
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  // Square sized to the card (clamped so it isn't tiny before first measure or
  // absurd on a wide tablet).
  const size = Math.min(440, Math.max(280, width || 300))
  const centerD = Math.round(size * 0.24)
  const baseD = Math.round(size * 0.12)
  const maxD = baseD * (1 + FISHEYE_STRENGTH)
  const cx = size / 2
  const cy = size / 2
  // Ring leaves room for the largest possible magnified disc so a focused node
  // near the edge never spills out of the square.
  const ring = size / 2 - maxD / 2 - 6
  const influence = size * 0.4

  const placed = useMemo(() => {
    const n = peers.length
    return peers.map((peer, i) => {
      // Start at the top (−90°) and go clockwise.
      const angle = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2
      const x = cx + Math.cos(angle) * ring
      const y = cy + Math.sin(angle) * ring
      let mag = 1
      if (focus) {
        const dist = Math.hypot(x - focus.x, y - focus.y)
        const t = Math.max(0, 1 - dist / influence)
        mag = 1 + FISHEYE_STRENGTH * smoothstep(t)
      }
      return {
        peer,
        title: resolveNodeTitle(peer.node, schemas),
        x,
        y,
        mag,
        diameter: baseD * mag,
      }
    })
  }, [peers, cx, cy, ring, influence, baseD, focus, schemas])

  // The node the fisheye is currently centred on — drives the readout caption.
  const focused = useMemo(() => {
    if (!focus || placed.length === 0) return null
    let best = placed[0]
    for (const p of placed) if (p.mag > best.mag) best = p
    return best.mag > 1.05 ? best : null
  }, [placed, focus])

  return (
    <div ref={wrapRef} className="w-full">
      <div
        // `key` on ref_id so re-centring on a new node replays the entrance.
        key={centerNode.ref_id}
        className="relative mx-auto animate-in fade-in zoom-in-95 duration-300"
        style={{ width: size, height: size, touchAction: "pan-y" }}
        onPointerMove={onPointerMove}
        onPointerLeave={clearFocus}
        onPointerCancel={clearFocus}
      >
        {/* Connector lines — drawn under the discs. */}
        <svg
          ref={svgRef}
          className="absolute inset-0 pointer-events-none"
          width={size}
          height={size}
          aria-hidden
        >
          {placed.map((p) => (
            <line
              key={p.peer.node.ref_id}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="oklch(0.72 0.14 200 / 0.4)"
              strokeWidth={p.mag > 1.3 ? 2 : 1.25}
            />
          ))}
        </svg>

        {/* Satellites. Base size is small so many fit; the fisheye grows the
            ones near the finger and reveals their label. */}
        {placed.map((p) => {
          const d = p.diameter
          const showLabel = p.mag >= LABEL_REVEAL
          // Label points toward the centre so it stays inside the square.
          const towardCenterBelow = p.y < cy
          return (
            <div
              key={p.peer.node.ref_id}
              className="absolute"
              style={{
                left: p.x,
                top: p.y,
                transform: "translate(-50%, -50%)",
                zIndex: Math.round(p.mag * 100),
              }}
            >
              <NodeDisc
                node={p.peer.node}
                schemas={schemas}
                diameter={d}
                onSelect={onSelect}
              />
              {showLabel && (
                <span
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 line-clamp-2 w-[92px] text-center text-[10px] leading-tight text-foreground drop-shadow-[0_1px_2px_oklch(0.1_0_0/0.9)]"
                  style={towardCenterBelow ? { top: d / 2 + 2 } : { bottom: d / 2 + 2 }}
                >
                  {p.title}
                </span>
              )}
            </div>
          )
        })}

        {/* Centre node */}
        <div
          className="absolute"
          style={{ left: cx, top: cy, transform: "translate(-50%, -50%)", zIndex: 50 }}
        >
          <NodeDisc
            node={centerNode}
            schemas={schemas}
            diameter={centerD}
            highlight
            onSelect={onSelect}
          />
        </div>

        {/* Loading / empty states centred under the focal disc. */}
        {(loading || peers.length === 0) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[10px] text-muted-foreground"
            style={{ top: cy + centerD / 2 + 8 }}
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading related…
              </>
            ) : (
              "No related nodes"
            )}
          </div>
        )}
      </div>

      {/* Readout caption: the focused node's title while sweeping, else a hint. */}
      {peers.length > 0 && (
        <p className="mt-1 h-4 truncate text-center text-[11px] text-muted-foreground">
          {focused ? (
            <span className="text-foreground/90">{focused.title}</span>
          ) : (
            `${peers.length} related · drag to explore`
          )}
        </p>
      )}
    </div>
  )
}
