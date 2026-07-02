"use client"

import { useEffect } from "react"
import { LeftPane } from "./left-pane"
import { GraphPane } from "@/components/universe/graph-pane"
import { MobileLayout } from "./mobile-layout"
import { AddModal } from "@/components/modals/add-modal"
import { BudgetModal } from "@/components/modals/budget-modal"
import { EditNodeModal } from "@/components/modals/edit-node-modal"
import { MediaPlayer } from "@/components/player/media-player"
import { useDefaultLayout } from "react-resizable-panels"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { useSchemaStore } from "@/stores/schema-store"
import { useNeighborFetch } from "@/hooks/use-neighbor-fetch"
import { useDeepLink } from "@/hooks/use-deep-link"
import { usePanelGraphSync } from "@/hooks/use-panel-graph-sync"
import { useIsMobile } from "@/hooks/use-mobile"
import { isMocksEnabled } from "@/lib/mock-data"
import { SMALL_SCHEMAS } from "@/app/ontology/mock-small"

export function AppLayout() {
  useDeepLink()
  useNeighborFetch()
  usePanelGraphSync()
  const isMobile = useIsMobile()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "graphmindset-main-layout" })
  const schemas = useSchemaStore((s) => s.schemas)
  const fetchSchemas = useSchemaStore((s) => s.fetchAll)

  useEffect(() => {
    if (schemas.length > 0) return
    if (isMocksEnabled()) {
      useSchemaStore.getState().setSchemas(SMALL_SCHEMAS)
    } else {
      fetchSchemas()
    }
  }, [schemas.length, fetchSchemas])

  return (
    <>
      {isMobile ? (
        // Phones get the sidebar full-width — the 3D graph pane is dropped in
        // favour of the content panels, with search + the toolkit FAB kept
        // reachable (both otherwise live inside GraphPane).
        <MobileLayout />
      ) : (
        <ResizablePanelGroup
          id="main-layout"
          orientation="horizontal"
          defaultLayout={defaultLayout ?? { "left-pane": 33, "right-pane": 67 }}
          onLayoutChanged={onLayoutChanged}
          className="h-screen w-screen overflow-hidden"
        >
          <ResizablePanel id="left-pane" defaultSize="33%" minSize="20%" maxSize="60%">
            <LeftPane />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel id="right-pane" defaultSize="67%" minSize="40%">
            <GraphPane />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      <AddModal />
      <EditNodeModal />
      <BudgetModal />
      <MediaPlayer />
    </>
  )
}
