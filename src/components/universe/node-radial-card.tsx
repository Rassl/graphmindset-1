"use client"

import { MiniRadialGraph } from "./mini-radial-graph"
import { displayNodeType } from "@/lib/utils"
import { getSchemaIconInfo } from "@/lib/schema-icons"
import { resolveNodeTitle, unescapeText } from "@/lib/node-display"
import type { GraphNode } from "@/lib/graph-api"
import type { SchemaNode } from "@/app/ontology/page"

interface NodeRadialCardProps {
  node: GraphNode
  schemas: SchemaNode[]
  // Open a node's content — fires for the centre and any tapped satellite.
  onOpen: (node: GraphNode) => void
  selected?: boolean
}

// A feed/list card rendered as a mini radial graph: the item sits at the centre
// with its 1-hop connections orbiting it, each labelled so you can read what the
// related nodes are. Tapping any disc opens that node. Used on mobile, where the
// orbiting layout is far more thumb-friendly than the 3D universe canvas.
export function NodeRadialCard({ node, schemas, onOpen, selected }: NodeRadialCardProps) {
  const schema = schemas.find((s) => s.type === (node.node_type ?? "Unknown"))
  const { accent } = getSchemaIconInfo(schema?.icon)
  const title = unescapeText(resolveNodeTitle(node, schemas))

  return (
    <article
      className={
        "rounded-xl border bg-card/40 px-3 py-4 transition-colors " +
        (selected ? "border-primary/50" : "border-border/40")
      }
    >
      <div className="mb-3 px-1">
        <span
          className="font-mono text-[10px] uppercase tracking-wider"
          style={{ color: accent }}
        >
          {displayNodeType(node.node_type ?? "Unknown")}
        </span>
        <h3 className="text-sm font-semibold leading-snug text-foreground">{title}</h3>
      </div>
      <MiniRadialGraph
        centerNode={node}
        schemas={schemas}
        onSelect={onOpen}
        fetchNeighbors
      />
    </article>
  )
}
