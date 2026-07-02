"use client"

import { List, Orbit } from "lucide-react"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"

// Segmented List / Graph switch for mobile — flips which surface fills the
// screen: the content list or the 3D graph canvas. Hidden on desktop (both
// panes are always visible there), so it carries its own `sm:hidden`.
export function MobileViewToggle({ className }: { className?: string }) {
  const mobileView = useAppStore((s) => s.mobileView)
  const setMobileView = useAppStore((s) => s.setMobileView)

  const options = [
    { value: "list" as const, label: "List", icon: List },
    { value: "graph" as const, label: "Graph", icon: Orbit },
  ]

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-md border border-border/50 bg-background/70 p-0.5 backdrop-blur-sm sm:hidden",
        className,
      )}
      role="group"
      aria-label="Mobile view"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = mobileView === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            // Stop the click from bubbling to the header (which resets search).
            onClick={(e) => {
              e.stopPropagation()
              setMobileView(value)
            }}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
