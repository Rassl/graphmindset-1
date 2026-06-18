"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Network, ShieldCheck, Heart, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BulletIcon } from "@/components/ui/bullet-icon"

// Static explainer — the bullet/sats economy in one scannable screen.
// X uses a plain profile link (the compose-DM deep link needs a numeric id);
// Reddit deep-links straight into a DM compose window.
const X_DM_URL = "https://x.com/sahibjanli26889"
const REDDIT_DM_URL = "https://www.reddit.com/message/compose/?to=rassl_ivan"

function Row({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="pt-0.5">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">
          {children}
        </p>
      </div>
    </div>
  )
}

export default function InfoPage() {
  const router = useRouter()

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push("/")}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-heading text-sm font-semibold uppercase tracking-wide">
          How it works
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-xl space-y-3 px-4 py-8">
          <Row icon={<Network className="h-4 w-4" />} title="What it is">
            A shared knowledge graph — add posts, connect ideas, get paid for the
            good ones.
          </Row>

          <Row icon={<BulletIcon className="h-4 w-4" />} title="Bullets = sats">
            1 bullet = 1 sat (the smallest unit of Bitcoin). Real money, sent over
            Lightning.
          </Row>

          <Row icon={<ShieldCheck className="h-4 w-4" />} title="Why posting costs">
            A few bullets per post — anti-spam, not a paywall. Cheap for you,
            costly for spammers.
          </Row>

          <Row icon={<Heart className="h-4 w-4" />} title="You earn from boosts">
            When someone boosts your post, those bullets go straight to you. No
            middleman.
          </Row>

          {/* Free bullets CTA */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-center">
            <Gift className="mx-auto h-6 w-6 text-amber-400" />
            <h2 className="mt-2 font-heading text-base font-semibold tracking-wide">
              Get free bullets
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              New here? DM me and I&#39;ll send you starter bullets — on the
              house.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <a
                href={X_DM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
              >
                DM on X
              </a>
              <a
                href={REDDIT_DM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#ff4500] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                DM on Reddit
              </a>
            </div>
          </div>

          <div className="pt-1 text-center">
            <Button
              onClick={() => router.push("/")}
              className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            >
              Start exploring
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
