import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowClockwiseIcon, FilmSlateIcon, HouseIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { buttonVariants, Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"
import { cn } from "../lib/utils"

/** Spinner with a screen-reader label; the label is never shown. */
export function Spinner({ label, className }: { label: string; className?: string }) {
  return <span className={cn("spinner", className)} role="status"><span className="sr-only">{label}</span></span>
}

/** Icon-led empty state. The label is announced but not drawn. */
export function EmptyState({ icon, label, action }: { icon?: ReactNode; label: string; action?: ReactNode }) {
  return <div className="state">{icon ?? <FilmSlateIcon size={44} weight="thin" />}<span className="sr-only">{label}</span>{action}</div>
}

export function HomeLink() {
  return <Link className={buttonVariants({ variant: "soft", size: "icon" })} to="/" aria-label="Home" title="Home"><HouseIcon /></Link>
}

export function InlineError({ onRetry }: { onRetry: () => void }) {
  return <div className="state" role="alert"><WarningCircleIcon size={40} weight="thin" /><span className="sr-only">Unable to load</span><Button size="icon" onClick={onRetry} aria-label="Try again" title="Try again"><ArrowClockwiseIcon /></Button></div>
}

export function NotFound() { return <div className="page"><EmptyState label="Page not found" action={<HomeLink />} /></div> }

export function ScriptRequired({ title, copy }: { title: string; copy: string }) {
  return <div className="page"><div className="state"><FilmSlateIcon size={44} weight="thin" /><h1 className="state-title">{title}</h1><p className="state-copy">{copy}</p><Link className={buttonVariants({ variant: "soft" })} to="/">Browse titles</Link></div></div>
}

export function PosterGridSkeleton() { return <div className="grid" role="status" aria-busy="true"><span className="sr-only">Loading titles</span>{Array.from({ length: 12 }, (_, item) => <Skeleton className="sk-poster" key={item} />)}</div> }
export function RailSkeleton({ rows = 3 }: { rows?: number }) { return <div role="status" aria-busy="true"><span className="sr-only">Loading</span>{Array.from({ length: rows }, (_, row) => <section className="rail" key={row}><Skeleton className="sk-line" /><div className="rail-track">{Array.from({ length: 6 }, (_, item) => <Skeleton className="sk-poster sk-rail" key={item} />)}</div></section>)}</div> }
export function HeroSkeleton() { return <div role="status" aria-busy="true"><span className="sr-only">Loading the catalog</span><Skeleton className="sk-hero" /></div> }
export function EpisodeListSkeleton() { return <div className="episode-list" role="status" aria-busy="true"><span className="sr-only">Loading episodes</span>{[1, 2, 3].map((item) => <Skeleton className="sk-episode" key={item} />)}</div> }
