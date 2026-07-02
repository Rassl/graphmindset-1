"use client"

import { LeftPane } from "./left-pane"
import { UniverseHeader } from "./universe-header"
import { ToolkitFAB } from "./toolkit"
import { GraphPane } from "@/components/universe/graph-pane"
import { SearchBar } from "@/components/search/search-bar"
import { useAppStore } from "@/stores/app-store"
import { useGraphStore } from "@/stores/graph-store"

// Phone layout. Either the content list/sidebar fills the screen, or — when the
// user flips the header's List/Graph switch — the full 3D graph pane does.
// GraphPane carries its own header (with the same switch), search and FAB, so
// in list mode we host equivalents here so navigation and search stay reachable.
export function MobileLayout() {
  const mobileView = useAppStore((s) => s.mobileView)
  const clearSelection = useGraphStore((s) => s.clearSelection)
  const sourcesOpen = useAppStore((s) => s.sourcesOpen)
  const myContentOpen = useAppStore((s) => s.myContentOpen)
  const followingOpen = useAppStore((s) => s.followingOpen)
  const agentOpen = useAppStore((s) => s.agentOpen)
  const workflowsOpen = useAppStore((s) => s.workflowsOpen)
  const toggleSources = useAppStore((s) => s.toggleSources)
  const toggleMyContent = useAppStore((s) => s.toggleMyContent)
  const toggleFollowing = useAppStore((s) => s.toggleFollowing)
  const toggleAgent = useAppStore((s) => s.toggleAgent)
  const toggleWorkflows = useAppStore((s) => s.toggleWorkflows)

  // Opening a panel clears any active node selection first, matching GraphPane.
  function openPanel(toggle: () => void) {
    clearSelection()
    toggle()
  }

  // Graph mode: GraphPane is fully self-contained (header + canvas + search +
  // FAB), so hand the whole screen to it. The header's List/Graph switch takes
  // the user back.
  if (mobileView === "graph") {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <GraphPane />
      </div>
    )
  }

  return (
    <section className="relative flex h-screen w-screen flex-col overflow-hidden bg-background noise-bg">
      <UniverseHeader />

      <div className="relative z-10 min-h-0 flex-1">
        <LeftPane />
      </div>

      <div className="relative z-20 px-4 pb-4 pt-3 bg-gradient-to-t from-background/95 via-background/70 to-transparent">
        <SearchBar />
      </div>

      <ToolkitFAB
        sourcesOpen={sourcesOpen}
        onToggleSources={() => openPanel(toggleSources)}
        myContentOpen={myContentOpen}
        onToggleMyContent={() => openPanel(toggleMyContent)}
        followingOpen={followingOpen}
        onToggleFollowing={() => openPanel(toggleFollowing)}
        agentOpen={agentOpen}
        onToggleAgent={() => openPanel(toggleAgent)}
        workflowsOpen={workflowsOpen}
        onToggleWorkflows={() => openPanel(toggleWorkflows)}
      />
    </section>
  )
}
