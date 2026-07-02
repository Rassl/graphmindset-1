"use client"

import { create } from "zustand"

// //
export type MobileView = "list" | "graph"

interface AppState {
  searchTerm: string
  // Which surface fills the screen on mobile: the content list/sidebar, or the
  // 3D graph canvas. No effect on desktop (both panes are always shown there).
  mobileView: MobileView
  sidebarOpen: boolean
  myContentOpen: boolean
  sourcesOpen: boolean
  clipsOpen: boolean
  followingOpen: boolean
  agentOpen: boolean
  workflowsOpen: boolean
  graphName: string
  graphDescription: string
  myContentRefreshKey: number
}

interface AppActions {
  setSearchTerm: (val: string) => void
  setMobileView: (val: MobileView) => void
  setSidebarOpen: (val: boolean) => void
  setMyContentOpen: (val: boolean) => void
  setSourcesOpen: (val: boolean) => void
  setClipsOpen: (val: boolean) => void
  setFollowingOpen: (open: boolean) => void
  setAgentOpen: (agentOpen: boolean) => void
  setWorkflowsOpen: (val: boolean) => void
  toggleMyContent: () => void
  toggleSources: () => void
  toggleFollowing: () => void
  toggleAgent: () => void
  toggleWorkflows: () => void
  closeAllPanels: () => void
  setGraphMeta: (name: string, description: string) => void
  bumpMyContentRefresh: () => void
}

export type AppStore = AppState & AppActions

export const useAppStore = create<AppStore>((set) => ({
  searchTerm: "",
  mobileView: "list",
  sidebarOpen: true,
  myContentOpen: false,
  sourcesOpen: false,
  clipsOpen: false,
  followingOpen: false,
  agentOpen: false,
  workflowsOpen: false,
  graphName: "",
  graphDescription: "",
  myContentRefreshKey: 0,
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setMobileView: (mobileView) => set({ mobileView }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setMyContentOpen: (myContentOpen) => set({ myContentOpen, sourcesOpen: false, clipsOpen: false, followingOpen: false, agentOpen: false, workflowsOpen: false }),
  setSourcesOpen: (sourcesOpen) => set({ sourcesOpen, myContentOpen: false, clipsOpen: false, followingOpen: false, agentOpen: false, workflowsOpen: false }),
  setClipsOpen: (clipsOpen) => set({ clipsOpen, sourcesOpen: false, myContentOpen: false, followingOpen: false, agentOpen: false, workflowsOpen: false }),
  setFollowingOpen: (open) => set({ followingOpen: open, sourcesOpen: false, myContentOpen: false, clipsOpen: false, agentOpen: false, workflowsOpen: false }),
  setAgentOpen: (agentOpen) => set({ agentOpen, sourcesOpen: false, myContentOpen: false, clipsOpen: false, followingOpen: false, workflowsOpen: false }),
  setWorkflowsOpen: (workflowsOpen) => set({ workflowsOpen, sourcesOpen: false, myContentOpen: false, clipsOpen: false, followingOpen: false, agentOpen: false }),
  toggleMyContent: () =>
    set((s) => ({ myContentOpen: !s.myContentOpen, sourcesOpen: false, clipsOpen: false, followingOpen: false, agentOpen: false, workflowsOpen: false })),
  toggleSources: () =>
    set((s) => ({ sourcesOpen: !s.sourcesOpen, myContentOpen: false, clipsOpen: false, followingOpen: false, agentOpen: false, workflowsOpen: false })),
  toggleFollowing: () =>
    set((s) => ({ followingOpen: !s.followingOpen, sourcesOpen: false, myContentOpen: false, clipsOpen: false, agentOpen: false, workflowsOpen: false })),
  toggleAgent: () =>
    set((s) => ({ agentOpen: !s.agentOpen, sourcesOpen: false, myContentOpen: false, clipsOpen: false, followingOpen: false, workflowsOpen: false })),
  toggleWorkflows: () =>
    set((s) => ({ workflowsOpen: !s.workflowsOpen, sourcesOpen: false, myContentOpen: false, clipsOpen: false, followingOpen: false, agentOpen: false })),
  closeAllPanels: () => set({ sourcesOpen: false, myContentOpen: false, clipsOpen: false, followingOpen: false, agentOpen: false, workflowsOpen: false }),
  setGraphMeta: (graphName, graphDescription) =>
    set({ graphName, graphDescription }),
  bumpMyContentRefresh: () => set((s) => ({ myContentRefreshKey: s.myContentRefreshKey + 1 })),
}))
