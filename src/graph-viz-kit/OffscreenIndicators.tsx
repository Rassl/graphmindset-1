import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Graph, ViewState } from "./types";

// Decks are pinned this far in from each screen edge (matches the design's
// 104px anchor inset).
const ANCHOR_INSET = 104;
// A node only counts as "off-screen" (deck-eligible) once it's essentially at
// or past the viewport edge — independent of where the decks sit.
const OFFSCREEN_MARGIN = 8;
// Card footprint used by the ported geometry. Narrower than the design's 210
// so the collapsed stack fits inside a tighter wrapper ring.
const CARD_W = 144;
const CARD_H = 66;
// Diameter of the circular wrapper ring around a collapsed deck.
const RING_D = 128;
// DOM card pool per deck. A deck with more off-screen members than this caps
// here (rare for a 1-hop neighbourhood); the rest aren't shown.
const CARD_POOL = 30;
// Coverflow scroll throttle (ms), from the design.
const WHEEL_THROTTLE = 80;
// Stacking for the whole deck overlay. GraphView's in-scene <Html> labels use
// drei zIndexRanges up to ~1e8, so the decks must sit well above that to stay
// on top of everything in the scene (collapsed rings and, especially, the
// expanded coverflow). Internal backdrop/expanded ordering is handled by the
// per-element zIndex within this container's stacking context.
const Z_OVERLAY = 2000000000;

type EdgeSide = "top" | "bottom" | "left" | "right";
const EDGE_SIDES: readonly EdgeSide[] = ["left", "top", "right", "bottom"];

// Directional glyph each card points with — toward its screen edge.
const CARD_ARROW: Record<EdgeSide, string> = {
  left: "◂",
  right: "▸",
  top: "▴",
  bottom: "▾",
};

// Per-edge basis: inward normal (inx,iny) and tangent (tx,ty).
const M_BY_EDGE: Record<EdgeSide, { inx: number; iny: number; tx: number; ty: number }> = {
  left: { inx: 1, iny: 0, tx: 0, ty: 1 },
  right: { inx: -1, iny: 0, tx: 0, ty: 1 },
  top: { inx: 0, iny: 1, tx: 1, ty: 0 },
  bottom: { inx: 0, iny: -1, tx: 1, ty: 0 },
};

// Group-label offset from the anchor, per edge.
const LABEL_POS: Record<EdgeSide, { x: number; y: number }> = {
  left: { x: 6, y: -CARD_H / 2 - 30 },
  right: { x: -116, y: -CARD_H / 2 - 30 },
  top: { x: CARD_W / 2 + 18, y: -8 },
  bottom: { x: CARD_W / 2 + 18, y: -16 },
};

// Match the app's dark cyan scene styling — mirrors GraphView's in-scene
// labels/pills (Barlow node names, JetBrains-Mono pills, cyan accents on
// glassy dark cards).
const CARD_GRAD = "linear-gradient(158deg, rgba(13,24,32,0.94) 0%, rgba(6,13,20,0.95) 100%)";
const TITLE_CYAN = "rgba(122,220,239,0.96)"; // node name, like scene labels
const MUTED = "rgba(150,185,200,0.62)"; // relation / group-label text
const CARD_BORDER = "rgba(103,210,238,0.28)";
const ACCENT = "rgb(103,210,238)"; // cyan accent — ring + chevron
const CARD_SHADOW = "0 12px 32px rgba(0,0,0,0.55), 0 0 18px rgba(86,206,236,0.08)";
const BADGE_GRAD = "linear-gradient(160deg,#62d6f0,#3bb6dc)";
const BADGE_TEXT = "#04141d";
const BADGE_BORDER = "#04101a";
const FONT_LABEL = "'Barlow', sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

// Direction the open ring's "mouth" faces (SVG degrees, 0°=east, 90°=south),
// i.e. toward this deck's screen edge / off-screen direction.
const MOUTH_DEG: Record<EdgeSide, number> = { left: 180, right: 0, top: 270, bottom: 90 };
const SVGNS = "http://www.w3.org/2000/svg";

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

// Arc spanning the full circle except a gap of `gapDeg` centered on the mouth.
function ringArcPath(c: number, r: number, mouthDeg: number, gapDeg: number): string {
  const a0 = mouthDeg + gapDeg / 2;
  const a1 = mouthDeg + 360 - gapDeg / 2;
  const [x0, y0] = polar(c, c, r, a0);
  const [x1, y1] = polar(c, c, r, a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const _v3 = new THREE.Vector3();

interface Props {
  graph: Graph;
  viewState: ViewState;
  onNodeClick: (id: number) => void;
  hovered?: number | null;
}

interface Member {
  nodeId: number;
  label: string;
  relation: string;
  degree: number;
}

interface CardDom {
  el: HTMLDivElement;
  title: HTMLDivElement;
  rel: HTMLSpanElement;
  badge: HTMLDivElement;
  nodeId: number | null;
}

interface DeckDom {
  container: HTMLDivElement;
  ring: HTMLDivElement;
  label: HTMLDivElement;
  cards: CardDom[];
  members: Member[]; // live, recomputed each frame
  expMembers: Member[]; // frozen snapshot while expanded
}

function anchorFor(edge: EdgeSide, w: number, h: number): { x: number; y: number } {
  switch (edge) {
    case "left": return { x: ANCHOR_INSET, y: h / 2 };
    case "right": return { x: w - ANCHOR_INSET, y: h / 2 };
    case "top": return { x: w / 2, y: ANCHOR_INSET };
    default: return { x: w / 2, y: h - ANCHOR_INSET };
  }
}

// Ported verbatim from the design's geom(): collapsed = compact tilted stack
// centered on the anchor; expanded = coverflow carousel (focused card pops
// forward in Z, neighbours tilt back and recede).
function geom(
  edge: EdgeSide,
  i: number,
  n: number,
  expanded: boolean,
  focus: number,
  vw: number,
  vh: number
): { transform: string; zIndex: number; opacity: number } {
  const W = CARD_W, H = CARD_H;
  const M = M_BY_EDGE[edge];
  const reach = (M.tx !== 0 ? vw : vh) || 800;
  let tx: number, ty: number, tz = 0, rx = 0, ry = 0, rz = 0, s = 1, z = 100 - i, op = 1;

  if (!expanded) {
    // Compact, tightly-stacked pile so the wrapper ring can stay small.
    s = 0.58 - i * 0.018;
    tx = -W / 2 - M.inx * i * 4 + M.tx * i * 1.5;
    ty = -H / 2 - M.iny * i * 4 + M.ty * i * 1.5;
    tz = -i * 3;
    rz = i * 1.5;
    z = 100 - i;
    op = i < 5 ? 1 - i * 0.14 : 0;
  } else {
    const d = i - focus;
    const horiz = M.tx !== 0;
    const sp = Math.min(94, reach * 0.17);
    const along = Math.sign(d) * (Math.min(Math.abs(d), 1) * sp + Math.max(Math.abs(d) - 1, 0) * sp * 0.55);
    const push = 150;
    tx = M.tx * along + M.inx * push - W / 2;
    ty = M.ty * along + M.iny * push - H / 2;
    tz = d === 0 ? 70 : -Math.abs(d) * 130;
    const a = Math.min(Math.abs(d), 3) * (d > 0 ? -1 : 1) * 22;
    if (horiz) ry = a; else rx = -a;
    s = d === 0 ? 1 : 0.8;
    op = Math.abs(d) > 4 ? 0 : (d === 0 ? 1 : 0.78);
    z = 100 - Math.abs(d);
  }

  const anc = anchorFor(edge, vw, vh);
  tx += anc.x;
  ty += anc.y;
  const transform =
    `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) translateZ(${tz}px) ` +
    `rotateX(${rx}deg) rotateY(${ry}deg) rotate(${rz.toFixed(2)}deg) scale(${s})`;
  return { transform, zIndex: Math.round(z), opacity: op };
}

export function OffscreenIndicators({ graph, viewState, onNodeClick, hovered = null }: Props) {
  const decksRef = useRef<Record<EdgeSide, DeckDom> | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const expandedRef = useRef<EdgeSide | null>(null);
  const focusRef = useRef<Record<EdgeSide, number>>({ left: 0, top: 0, right: 0, bottom: 0 });
  const sizeRef = useRef({ w: 1440, h: 860 });
  const onNodeClickRef = useRef(onNodeClick);
  const hoveredRef = useRef(hovered);
  const relayoutRef = useRef<(w: number, h: number) => void>(() => { });

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);
  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  // Navigating / leaving subgraph mode collapses any expanded deck.
  const selectedId = viewState.mode === "subgraph" ? viewState.selectedNodeId : null;
  useEffect(() => {
    expandedRef.current = null;
  }, [selectedId, viewState.mode]);

  const { camera, size, gl } = useThree();

  useEffect(() => {
    const canvasParent = gl.domElement.parentElement;

    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      zIndex: String(Z_OVERLAY),
      overflow: "visible",
    });
    (canvasParent ?? document.body).appendChild(container);

    // Dim vignette behind the expanded deck; click to collapse.
    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
      position: "absolute",
      inset: "0",
      zIndex: "38",
      display: "none",
      pointerEvents: "auto",
      background: "radial-gradient(circle at center, rgba(4,8,14,0) 30%, rgba(4,8,14,0.62) 100%)",
    });
    container.appendChild(backdrop);
    backdropRef.current = backdrop;

    const decks = {} as Record<EdgeSide, DeckDom>;

    for (const edge of EDGE_SIDES) {
      const deckContainer = document.createElement("div");
      Object.assign(deckContainer.style, {
        position: "absolute",
        inset: "0",
        pointerEvents: "none",
        perspective: "1300px",
        transformStyle: "preserve-3d",
        zIndex: "10",
        display: "none",
      });

      // --- Directional open ring: a C-shape whose mouth opens toward this
      // deck's screen edge, signalling "a group of markers — off this way". ---
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "absolute",
        width: `${RING_D}px`,
        height: `${RING_D}px`,
        marginLeft: `${-RING_D / 2}px`,
        marginTop: `${-RING_D / 2}px`,
        cursor: "pointer",
        pointerEvents: "auto",
        zIndex: "8",
        transition: "opacity .38s ease, transform .38s cubic-bezier(.22,.7,.3,1)",
      });
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("width", `${RING_D}`);
      svg.setAttribute("height", `${RING_D}`);
      svg.setAttribute("viewBox", `0 0 ${RING_D} ${RING_D}`);
      Object.assign(svg.style, {
        position: "absolute",
        inset: "0",
        overflow: "visible",
        pointerEvents: "none",
        filter: "drop-shadow(0 0 6px rgba(86,206,236,0.45))",
      });
      const cc = RING_D / 2;
      const mouth = MOUTH_DEG[edge];
      const GAP = 104;
      const rOuter = cc - 3;
      const outerArc = document.createElementNS(SVGNS, "path");
      outerArc.setAttribute("d", ringArcPath(cc, rOuter, mouth, GAP));
      outerArc.setAttribute("fill", "none");
      outerArc.setAttribute("stroke", ACCENT);
      outerArc.setAttribute("stroke-width", "2");
      outerArc.setAttribute("stroke-linecap", "round");
      outerArc.setAttribute("stroke-opacity", "0.82");
      svg.appendChild(outerArc);
      // Faint concentric inner arc with a wider gap → a funnel toward the mouth.
      const innerArc = document.createElementNS(SVGNS, "path");
      innerArc.setAttribute("d", ringArcPath(cc, cc - 12, mouth, GAP + 22));
      innerArc.setAttribute("fill", "none");
      innerArc.setAttribute("stroke", ACCENT);
      innerArc.setAttribute("stroke-width", "1");
      innerArc.setAttribute("stroke-opacity", "0.3");
      innerArc.setAttribute("stroke-dasharray", "2 5");
      svg.appendChild(innerArc);
      // Chevron at the mouth, pointing outward toward the edge.
      const [tipx, tipy] = polar(cc, cc, rOuter + 6, mouth);
      const [alx, aly] = polar(cc, cc, rOuter - 5, mouth + 17);
      const [arx, ary] = polar(cc, cc, rOuter - 5, mouth - 17);
      const chevron = document.createElementNS(SVGNS, "polyline");
      chevron.setAttribute(
        "points",
        `${alx.toFixed(1)},${aly.toFixed(1)} ${tipx.toFixed(1)},${tipy.toFixed(1)} ${arx.toFixed(1)},${ary.toFixed(1)}`
      );
      chevron.setAttribute("fill", "none");
      chevron.setAttribute("stroke", ACCENT);
      chevron.setAttribute("stroke-width", "2");
      chevron.setAttribute("stroke-linecap", "round");
      chevron.setAttribute("stroke-linejoin", "round");
      svg.appendChild(chevron);
      ring.appendChild(svg);
      ring.addEventListener("click", () => expand(edge));
      deckContainer.appendChild(ring);

      // --- Group label ---
      const label = document.createElement("div");
      Object.assign(label.style, {
        position: "absolute",
        fontFamily: FONT_MONO,
        fontSize: "10px",
        fontWeight: "500",
        letterSpacing: "2px",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        color: MUTED,
        pointerEvents: "none",
        transition: "opacity .3s ease",
      });
      deckContainer.appendChild(label);

      // --- Card pool ---
      const cards: CardDom[] = [];
      for (let i = 0; i < CARD_POOL; i++) {
        const el = document.createElement("div");
        Object.assign(el.style, {
          position: "absolute",
          left: "0",
          top: "0",
          boxSizing: "border-box",
          width: `${CARD_W}px`,
          minHeight: "60px",
          padding: "11px 15px 12px",
          borderRadius: "11px",
          background: CARD_GRAD,
          border: `1px solid ${CARD_BORDER}`,
          boxShadow: CARD_SHADOW,
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          transformStyle: "preserve-3d",
          transformOrigin: "center center",
          pointerEvents: "auto",
          willChange: "transform",
          cursor: "pointer",
          display: "none",
          transition: "transform .34s cubic-bezier(.22,.7,.3,1), opacity .26s ease",
        });

        const title = document.createElement("div");
        Object.assign(title.style, {
          fontFamily: FONT_LABEL,
          fontWeight: "700",
          fontSize: "14px",
          color: TITLE_CYAN,
          letterSpacing: "0.4px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textShadow: "0 0 12px rgba(86,206,236,0.3)",
        });

        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "6px",
        });
        const rel = document.createElement("span");
        Object.assign(rel.style, {
          fontFamily: FONT_MONO,
          fontSize: "10px",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: MUTED,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        });
        const arrow = document.createElement("span");
        Object.assign(arrow.style, {
          fontSize: "13px",
          lineHeight: "1",
          color: "rgba(103,210,238,0.55)",
          marginLeft: "8px",
        });
        arrow.textContent = CARD_ARROW[edge];
        row.appendChild(rel);
        row.appendChild(arrow);

        const badge = document.createElement("div");
        Object.assign(badge.style, {
          position: "absolute",
          top: "-9px",
          right: "-9px",
          minWidth: "25px",
          height: "25px",
          padding: "0 6px",
          boxSizing: "border-box",
          borderRadius: "50%",
          background: BADGE_GRAD,
          color: BADGE_TEXT,
          fontFamily: FONT_MONO,
          fontWeight: "700",
          fontSize: "12px",
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${BADGE_BORDER}`,
          boxShadow: "0 0 12px rgba(86,206,236,0.5)",
        });

        el.appendChild(title);
        el.appendChild(row);
        el.appendChild(badge);
        el.addEventListener("mouseenter", () => {
          el.style.borderColor = "rgba(122,220,239,0.6)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.borderColor = CARD_BORDER;
        });
        const slot = i;
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (expandedRef.current !== edge) {
            const dk = decksRef.current?.[edge];
            // A lone marker has nothing to browse — navigate straight to it.
            if (dk && dk.members.length === 1) onNodeClickRef.current(dk.members[0].nodeId);
            else expand(edge);
          } else {
            // Click a side card to bring it into focus.
            focusRef.current[edge] = slot;
            relayoutRef.current(sizeRef.current.w, sizeRef.current.h);
          }
        });

        deckContainer.appendChild(el);
        cards.push({ el, title, rel, badge, nodeId: null });
      }

      container.appendChild(deckContainer);
      decks[edge] = { container: deckContainer, ring, label, cards, members: [], expMembers: [] };
    }

    decksRef.current = decks;

    // --- Layout + state helpers (closures, stable for the component's life) ---
    function setCardContent(card: CardDom, m: Member) {
      if (card.nodeId === m.nodeId) return;
      card.nodeId = m.nodeId;
      card.title.textContent = m.label;
      card.rel.textContent = m.relation || "";
      if (m.degree > 0) {
        card.badge.textContent = String(m.degree);
        card.badge.style.display = "flex";
      } else {
        card.badge.style.display = "none";
      }
    }

    function layoutDeck(edge: EdgeSide, w: number, h: number) {
      const deck = decks[edge];
      const exp = expandedRef.current === edge;
      const renderMembers = exp ? deck.expMembers : deck.members;
      const count = renderMembers.length;
      if (count === 0) {
        deck.container.style.display = "none";
        return;
      }
      deck.container.style.display = "block";
      deck.container.style.zIndex = exp ? "50" : "10";
      const anc = anchorFor(edge, w, h);

      // A lone off-screen node isn't a "group" — drop the ring/label and show
      // it as a single readable marker card.
      const single = !exp && count === 1;

      deck.ring.style.left = `${anc.x}px`;
      deck.ring.style.top = `${anc.y}px`;
      if (single) {
        deck.ring.style.display = "none";
      } else {
        deck.ring.style.display = "block";
        deck.ring.style.opacity = exp ? "0" : "1";
        deck.ring.style.transform = exp ? "scale(.55)" : "scale(1)";
        deck.ring.style.pointerEvents = exp ? "none" : "auto";
      }

      deck.label.style.display = single ? "none" : "block";
      if (!single) {
        deck.label.style.left = `${anc.x + LABEL_POS[edge].x}px`;
        deck.label.style.top = `${anc.y + LABEL_POS[edge].y}px`;
        deck.label.style.opacity = exp ? "0.85" : "0.5";
        deck.label.textContent = `${count} · ${edge.toUpperCase()}`;
      }

      if (single) {
        const card = deck.cards[0];
        card.el.style.display = "block";
        setCardContent(card, renderMembers[0]);
        card.el.style.transform =
          `translate(${(anc.x - CARD_W / 2).toFixed(1)}px,${(anc.y - CARD_H / 2).toFixed(1)}px) scale(0.85)`;
        card.el.style.zIndex = "100";
        card.el.style.opacity = "1";
        card.el.style.pointerEvents = "auto";
        for (let i = 1; i < deck.cards.length; i++) deck.cards[i].el.style.display = "none";
        return;
      }

      const n = Math.max(1, count);
      const focus = focusRef.current[edge] ?? Math.floor((n - 1) / 2);
      for (let i = 0; i < deck.cards.length; i++) {
        const card = deck.cards[i];
        if (i >= count) {
          card.el.style.display = "none";
          continue;
        }
        card.el.style.display = "block";
        setCardContent(card, renderMembers[i]);
        const g = geom(edge, i, n, exp, focus, w, h);
        card.el.style.transform = g.transform;
        card.el.style.zIndex = String(g.zIndex);
        card.el.style.opacity = String(g.opacity);
        card.el.style.pointerEvents = g.opacity > 0 ? "auto" : "none";
      }
    }

    function relayout(w: number, h: number) {
      backdrop.style.display = expandedRef.current !== null ? "block" : "none";
      for (const edge of EDGE_SIDES) layoutDeck(edge, w, h);
    }
    relayoutRef.current = relayout;

    function expand(edge: EdgeSide) {
      const deck = decks[edge];
      if (deck.members.length === 0) return;
      expandedRef.current = edge;
      deck.expMembers = deck.members.slice(0, CARD_POOL);
      focusRef.current[edge] = Math.max(0, Math.floor((deck.expMembers.length - 1) / 2));
      relayout(sizeRef.current.w, sizeRef.current.h);
    }

    function collapse() {
      if (expandedRef.current === null) return;
      expandedRef.current = null;
      relayout(sizeRef.current.w, sizeRef.current.h);
    }

    function scroll(dir: number): boolean {
      const ed = expandedRef.current;
      if (!ed) return false;
      const n = decks[ed].expMembers.length;
      if (!n) return false;
      const cur = focusRef.current[ed] ?? Math.floor((n - 1) / 2);
      const next = Math.max(0, Math.min(n - 1, cur + dir));
      if (next !== cur) {
        focusRef.current[ed] = next;
        relayout(sizeRef.current.w, sizeRef.current.h);
      }
      return true;
    }

    backdrop.addEventListener("click", collapse);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        collapse();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        if (scroll(1)) e.preventDefault();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        if (scroll(-1)) e.preventDefault();
      }
    };
    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      if (!expandedRef.current) return; // collapsed → let the camera zoom
      // Capture-phase + preventDefault so the orbit controls don't also zoom.
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastWheel < WHEEL_THROTTLE) return;
      lastWheel = now;
      scroll(e.deltaY > 0 ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel, { capture: true } as EventListenerOptions);
      container.parentElement?.removeChild(container);
      decksRef.current = null;
      backdropRef.current = null;
      relayoutRef.current = () => { };
    };
  }, []);

  useFrame(() => {
    const decks = decksRef.current;
    if (!decks) return;

    const w = size.width;
    const h = size.height;
    sizeRef.current.w = w;
    sizeRef.current.h = h;

    if (viewState.mode !== "subgraph") {
      if (expandedRef.current !== null) expandedRef.current = null;
      for (const edge of EDGE_SIDES) {
        decks[edge].members = [];
        decks[edge].container.style.display = "none";
      }
      if (backdropRef.current) backdropRef.current.style.display = "none";
      return;
    }

    const sel = viewState.selectedNodeId;
    const depthMap = viewState.depthMap;
    const cx = w / 2;
    const cy = h / 2;
    const edgeX = w / 2 - OFFSCREEN_MARGIN;
    const edgeY = h / 2 - OFFSCREEN_MARGIN;

    // Relation labels from the anchor (hovered, else selected) to each
    // neighbor — built in one O(E) pass keyed by the other endpoint.
    const anchor = hoveredRef.current ?? sel;
    const relByNode = new Map<number, string[]>();
    if (anchor !== null) {
      for (const e of graph.edges) {
        if (!e.label) continue;
        if (e.src === anchor) (relByNode.get(e.dst) ?? relByNode.set(e.dst, []).get(e.dst)!).push(e.label);
        else if (e.dst === anchor) (relByNode.get(e.src) ?? relByNode.set(e.src, []).get(e.src)!).push(e.label);
      }
    }

    // Bucket every off-screen depth-1 neighbor into one of the 4 edge decks.
    const buckets: Record<EdgeSide, Member[]> = { top: [], bottom: [], left: [], right: [] };
    for (const [nodeId, depth] of depthMap) {
      if (depth !== 1 || nodeId === sel) continue;
      const node = graph.nodes[nodeId];
      if (!node) continue;

      _v3.set(node.position.x, node.position.y, node.position.z);
      _v3.project(camera);
      if (_v3.z > 1) continue;

      const sx = ((_v3.x + 1) / 2) * w;
      const sy = ((-_v3.y + 1) / 2) * h;
      const onScreen =
        sx >= OFFSCREEN_MARGIN && sx <= w - OFFSCREEN_MARGIN &&
        sy >= OFFSCREEN_MARGIN && sy <= h - OFFSCREEN_MARGIN;
      if (onScreen) continue;

      const dx = sx - cx;
      const dy = sy - cy;
      const angle = Math.atan2(dy, dx);
      const absCos = Math.abs(Math.cos(angle));
      const absSin = Math.abs(Math.sin(angle));

      let edge: EdgeSide;
      if (edgeX * absSin <= edgeY * absCos) edge = dx >= 0 ? "right" : "left";
      else edge = dy >= 0 ? "bottom" : "top";

      buckets[edge].push({
        nodeId,
        label: node.label,
        relation: (relByNode.get(nodeId) ?? []).join("  ·  "),
        degree: node.degree ?? 0,
      });
    }

    // Stable ordering so the stack doesn't churn as the camera orbits.
    for (const edge of EDGE_SIDES) {
      buckets[edge].sort((a, b) => a.nodeId - b.nodeId);
      decks[edge].members = buckets[edge];
    }

    relayoutRef.current(w, h);
  });

  return null;
}
