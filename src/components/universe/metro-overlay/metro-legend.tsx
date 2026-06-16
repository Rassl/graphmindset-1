"use client"

import { useState, type ReactNode } from "react"
import { GlowBullet } from "./glow-bullet"
import { STATION_GLOW, STATION_STATE_LABEL, METRO_LINE_COLORS, type StationState } from "./constants"
import type { MetroLineInfo } from "@/data/metro"

export function MetroLegend({
  hoveredState,
  onHoverState,
  lines,
  hoveredLine,
  onHoverLine,
  onSelectLine,
}: {
  hoveredState: StationState | null
  onHoverState: (state: StationState | null) => void
  lines: MetroLineInfo[]
  hoveredLine: string | null
  onHoverLine: (line: string | null) => void
  /** Fly the camera to frame a line, or the whole network when null. */
  onSelectLine: (line: string | null) => void
}) {
  const [collapsed, setCollapsed] = useState(true)
  const stationStates: StationState[] = [
    "inhabited",
    "neutral",
    "anomaly",
    "scorched",
    "flood",
    "quarantine",
    "lost",
  ]
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        width: collapsed ? "auto" : 180,
        padding: collapsed ? "6px 10px" : "10px 12px 10px 12px",
        background:
          "linear-gradient(180deg, rgba(12,15,22,0.92) 0%, rgba(8,10,16,0.94) 100%)",
        border: "1px solid rgba(120, 100, 70, 0.22)",
        borderRadius: 6,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: "#d9d2c5",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', sans-serif",
        pointerEvents: "auto",
        boxShadow:
          "0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,220,160,0.04)",
        userSelect: "none",
      }}
      onMouseLeave={() => {
        onHoverState(null)
        onHoverLine(null)
      }}
    >
      {/* Header — click to collapse/expand the panel. */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          gap: 12,
          padding: 0,
          margin: 0,
          marginBottom: collapsed ? 0 : 10,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          font: "inherit",
        }}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand legend" : "Collapse legend"}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.32em",
            color: "#a39a88",
            textTransform: "uppercase",
          }}
        >
          Legend
        </span>
        <span
          style={{
            fontSize: 9,
            color: "#8a8275",
            transform: collapsed ? "rotate(-90deg)" : "none",
            transition: "transform 150ms",
            lineHeight: 1,
          }}
        >
          ▾
        </span>
      </button>

      {collapsed ? null : (
        <>
          {/* Lines — click to fly the camera to a line; "All lines" frames the
              whole network. Hover spotlights the line in the scene. */}
          <Section title="Lines">
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <LineRow
                label="All lines"
                swatch="#d9d2c5"
                isHovered={false}
                isFaded={hoveredLine !== null}
                onEnter={() => onHoverLine(null)}
                onClick={() => onSelectLine(null)}
              />
              {lines.map((line) => {
                const rgb = METRO_LINE_COLORS[line.color] ?? [1, 1, 1]
                const css = `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`
                const isHovered = hoveredLine === line.color
                return (
                  <LineRow
                    key={line.color}
                    label={line.en}
                    swatch={css}
                    isHovered={isHovered}
                    isFaded={hoveredLine !== null && !isHovered}
                    onEnter={() => onHoverLine(line.color)}
                    onClick={() => onSelectLine(line.color)}
                  />
                )
              })}
            </div>
          </Section>

          <Section title="Stations" divider>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {stationStates.map((state) => {
                const isHovered = hoveredState === state
                const isFaded = hoveredState !== null && !isHovered
                return (
                  <div
                    key={state}
                    onMouseEnter={() => onHoverState(state)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "18px 1fr",
                      alignItems: "center",
                      columnGap: 10,
                      padding: "3px 6px",
                      marginLeft: -6,
                      marginRight: -6,
                      borderRadius: 4,
                      cursor: "pointer",
                      background: isHovered ? "rgba(232,156,74,0.08)" : "transparent",
                      opacity: isFaded ? 0.4 : 1,
                      transition: "opacity 120ms, background 120ms",
                    }}
                  >
                    <GlowBullet
                      glow={STATION_GLOW[state]}
                      glyph={state === "lost" ? "☠" : undefined}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: isHovered ? "#f5efde" : "#cfc7b5",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {STATION_STATE_LABEL[state]}
                    </span>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="Tunnels" divider>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "18px 1fr",
                  alignItems: "center",
                  columnGap: 10,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 2,
                    background: "#d9d2c5",
                    borderRadius: 1,
                    boxShadow: "0 0 4px rgba(217,210,197,0.4)",
                  }}
                />
                <span style={{ fontSize: 11, color: "#cfc7b5", letterSpacing: "0.04em" }}>
                  Open
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "18px 1fr",
                  alignItems: "center",
                  columnGap: 10,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 2,
                    background: "rgba(217,210,197,0.22)",
                    borderRadius: 1,
                  }}
                />
                <span style={{ fontSize: 11, color: "#807a6f", letterSpacing: "0.04em" }}>
                  Blocked
                </span>
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// A collapsible section inside the legend — its own header (title + chevron)
// toggles just this section. Collapsed by default so the panel opens compact.
function Section({
  title,
  children,
  divider,
}: {
  title: string
  children: ReactNode
  divider?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        marginTop: divider ? 10 : 0,
        paddingTop: divider ? 10 : 0,
        borderTop: divider ? "1px solid rgba(170,130,80,0.18)" : "none",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          gap: 12,
          padding: 0,
          margin: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          font: "inherit",
        }}
        aria-expanded={open}
        title={open ? `Collapse ${title}` : `Expand ${title}`}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.32em",
            color: "#8a8275",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 9,
            color: "#8a8275",
            transform: open ? "none" : "rotate(-90deg)",
            transition: "transform 150ms",
            lineHeight: 1,
          }}
        >
          ▾
        </span>
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  )
}

// A single clickable line entry: a colored track swatch + label. Mirrors the
// station-state rows' hover/fade treatment so the legend reads as one control.
function LineRow({
  label,
  swatch,
  isHovered,
  isFaded,
  onEnter,
  onClick,
}: {
  label: string
  swatch: string
  isHovered: boolean
  isFaded: boolean
  onEnter: () => void
  onClick: () => void
}) {
  return (
    <div
      onMouseEnter={onEnter}
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr",
        alignItems: "center",
        columnGap: 10,
        padding: "3px 6px",
        marginLeft: -6,
        marginRight: -6,
        borderRadius: 4,
        cursor: "pointer",
        background: isHovered ? "rgba(232,156,74,0.08)" : "transparent",
        opacity: isFaded ? 0.4 : 1,
        transition: "opacity 120ms, background 120ms",
      }}
    >
      <div
        style={{
          width: 16,
          height: 3,
          background: swatch,
          borderRadius: 1.5,
          boxShadow: isHovered ? `0 0 6px ${swatch}` : "none",
          transition: "box-shadow 120ms",
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: isHovered ? "#f5efde" : "#cfc7b5",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
    </div>
  )
}
