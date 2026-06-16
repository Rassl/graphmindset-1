"use client"

import { useEffect, useMemo, useState } from "react"
import * as THREE from "three"
import type { GraphNode as ApiNode } from "@/lib/graph-api"
import {
  MAP_Y_OFFSET,
  METRO_LINE_COLORS,
  STATION_FILL,
  statusToState,
  type StationState,
} from "./constants"

interface Bullet {
  id: string
  x: number
  y: number
  z: number
  color: [number, number, number]
  lines: string[]
  fill: string
  state: StationState
}

// Imperative texture load — deliberately not drei's useTexture, so a slow or
// broken image URL never suspends or throws inside the 3D scene. While loading
// (or on error) the bullet stays its plain schematic disc; the photo swaps in
// once decoded, and is disposed when the url changes or the bullet unmounts.
function useImageTexture(url: string | undefined): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    // No url → nothing to load. Any previously-set texture was already cleared
    // by this effect's prior cleanup, so the disc is back to its flat fill.
    if (!url) return
    let active = true
    let loaded: THREE.Texture | null = null
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin("anonymous")
    loader.load(
      url,
      (tex) => {
        if (!active) {
          tex.dispose()
          return
        }
        tex.colorSpace = THREE.SRGBColorSpace
        loaded = tex
        setTexture(tex)
      },
      undefined,
      () => {
        /* ignore load errors — keep the schematic disc */
      },
    )
    return () => {
      active = false
      loaded?.dispose()
      setTexture(null)
    }
  }, [url])
  return texture
}

function StationBullet({
  bullet,
  opacity,
  imageUrl,
}: {
  bullet: Bullet
  opacity: number
  imageUrl?: string
}) {
  const texture = useImageTexture(imageUrl)
  return (
    <group position={[bullet.x, bullet.y, bullet.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.22, 0.27, 48]} />
        <meshBasicMaterial
          color={new THREE.Color(bullet.color[0], bullet.color[1], bullet.color[2])}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[0.22, 48]} />
        {texture ? (
          // White base so the photo shows true colors; circleGeometry UVs crop
          // the (square) image to the disc — a circular avatar.
          <meshBasicMaterial map={texture} transparent opacity={opacity} />
        ) : (
          <meshBasicMaterial color={bullet.fill} transparent opacity={opacity} />
        )}
      </mesh>
    </group>
  )
}

// Schematic-style station bullets — a flat white-cream disc ringed in the
// station's primary line color, lying on the y=0 plane. This is what makes
// a metro map *look* like one; lines without bullets read as plain edges.
//
// A station that has been enriched with an image (image_url from its backend
// detail fetch, surfaced here via the `images` map) renders that photo inside
// the disc instead of the flat fill.
//
// Renders nothing when no Station nodes carry mapX/mapZ, so safe to mount
// in non-metro themes.
export function MetroStationBullets({
  nodes,
  activeLines,
  activeState,
  images,
}: {
  nodes: ApiNode[]
  activeLines: Set<string> | null
  activeState: StationState | null
  images?: Map<string, string> | null
}) {
  const bullets = useMemo(() => {
    const result: Bullet[] = []
    for (const n of nodes) {
      if (n.node_type !== "Station") continue
      const p = n.properties as Record<string, unknown> | undefined
      if (!p) continue
      if (typeof p.mapX !== "number" || typeof p.mapZ !== "number") continue
      const lineStrRaw =
        (typeof p.metro_line === "string" ? p.metro_line : null) ??
        (typeof p.line === "string" ? p.line : null)
      const lineStr = lineStrRaw ?? ""
      const lines = lineStr
        .split(",")
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean)
      const primary = lines[0] ?? ""
      const color = METRO_LINE_COLORS[primary] ?? [0.85, 0.85, 0.85]
      const status = p.station_status ?? p.status
      const state = statusToState(status, p.faction)
      const fill = STATION_FILL[state]
      const baseY = typeof p.mapY === "number" ? (p.mapY as number) : 0
      result.push({
        id: n.ref_id,
        x: p.mapX as number,
        y: baseY + MAP_Y_OFFSET + 0.05,
        z: p.mapZ as number,
        color,
        lines,
        fill,
        state,
      })
    }
    return result
  }, [nodes])

  return (
    <group>
      {bullets.map((b) => {
        // Bullets rest dimmed by default (matching the lines) and only brighten
        // when in focus: either their line is active (line hovered, or a node
        // on it hovered/selected) or their state is active (legend hover). When
        // nothing is in focus every bullet stays dimmed.
        const lineFocus =
          activeLines !== null && b.lines.some((l) => activeLines.has(l))
        const stateFocus = activeState !== null && b.state === activeState
        const opacity = lineFocus || stateFocus ? 1 : 0.12
        return (
          <StationBullet
            key={b.id}
            bullet={b}
            opacity={opacity}
            imageUrl={images?.get(b.id)}
          />
        )
      })}
    </group>
  )
}
