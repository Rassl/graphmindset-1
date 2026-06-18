"use client"

import { useRouter } from "next/navigation"
import { Gift } from "lucide-react"
import { useAppStore } from "@/stores/app-store"
import { useGraphStore } from "@/stores/graph-store"

export function UniverseHeader() {
  const router = useRouter()
  const graphName = useAppStore((s) => s.graphName)
  const closeAllPanels = useAppStore((s) => s.closeAllPanels)
  const setSearchTerm = useAppStore((s) => s.setSearchTerm)
  const clearSelection = useGraphStore((s) => s.clearSelection)
  const title = graphName || "Knowledge Graph"

  function handleClick() {
    closeAllPanels()
    clearSelection()
    setSearchTerm("")
  }

  function handleInfoClick(e: React.MouseEvent) {
    e.stopPropagation()
    router.push("/info")
  }

  return (
    <header
      className="relative z-20 flex items-baseline gap-3 border-b border-border/50 bg-background/70 backdrop-blur-md px-5 py-3 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={handleClick}
    >
      <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent pointer-events-none" />

      <h1
        className="font-heading text-xl sm:text-2xl font-semibold leading-none uppercase text-foreground glow-text-cyan whitespace-nowrap"
        style={{ letterSpacing: "0.35em" }}
      >
        Universe
      </h1>

      <span className="h-4 w-px bg-border/60 self-center" aria-hidden />

      <h2
        className="font-heading text-base sm:text-lg font-medium leading-none uppercase text-foreground/80 truncate"
        style={{ letterSpacing: "0.28em" }}
      >
        {title}
      </h2>

      {/* Claim-bullets CTA — pinned right, opens the "How it works" page */}
      <button
        type="button"
        onClick={handleInfoClick}
        aria-label="How it works — claim your free bullets"
        className="group relative ml-auto inline-flex items-center gap-1.5 self-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 hover:text-amber-200"
      >
        <Gift className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Claim your bullets</span>
        <span className="sm:hidden">Bullets</span>
        {/* Pulsing "free" dot to draw the eye */}
        <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
        </span>
      </button>
    </header>
  )
}
