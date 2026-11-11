import { useContext, useEffect, useRef, useState, type ImgHTMLAttributes } from "react"
import { Link } from "react-router-dom"
import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon, InfoIcon, PlayIcon, StarIcon, TelevisionIcon } from "@phosphor-icons/react"
import { buttonVariants, Button } from "./ui/button"
import { EnhancedContext } from "../lib/app-context"
import type { CatalogRail, MediaRecommendation, MediaTitle } from "../lib/types"
import { cn, formatYear, tmdbImageUrl } from "../lib/utils"

export type PosterItem = MediaTitle | MediaRecommendation

export function detailPath(item: Pick<PosterItem, "mediaType" | "tmdbId">) {
  return `/${item.mediaType === "tv" ? "series" : "movie"}/${item.tmdbId}`
}

export function watchPath(item: Pick<PosterItem, "mediaType" | "tmdbId">) {
  return item.mediaType === "tv" ? `/watch/series/${item.tmdbId}?season=1&episode=1` : `/watch/movie/${item.tmdbId}`
}

/** Image that disappears when it fails, leaving whatever sits beneath it visible. */
export function SafeImage({ src, alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const { failed, ref, onError } = useImageFallback(src)
  if (!src || failed) return null
  return <img ref={ref} src={src} alt={alt} decoding="async" onError={onError} {...props} />
}

/**
 * Tracks image load failures. Server-rendered images can fail before React
 * attaches handlers, so the settled state is also checked after mount.
 */
function useImageFallback(src?: string) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    setFailed(false)
    const image = ref.current
    if (image?.complete && image.naturalWidth === 0) setFailed(true)
  }, [src])
  return { failed, ref, onError: () => setFailed(true) }
}

export function Poster({ item, large = false }: { item: PosterItem; large?: boolean }) {
  const image = tmdbImageUrl(item.posterPath, large ? "w780" : "w342")
  const { failed, ref, onError } = useImageFallback(image)
  return <div className={cn("poster", failed && "poster-failed")}>
    {image && !failed && <img ref={ref} src={image} alt={`${item.title} poster`} loading={large ? "eager" : "lazy"} decoding="async" onError={onError} />}
    {(failed || !image) && <span>{item.title}</span>}
  </div>
}

export function PosterCard({ item }: { item: PosterItem }) {
  return <Link className="card" to={detailPath(item)} aria-label={item.title} title={item.title}>
    <Poster item={item} />
    {item.mediaType === "tv" && <span className="card-type" aria-hidden="true"><TelevisionIcon size={12} weight="fill" /></span>}
    {item.rating ? <span className="card-rating"><StarIcon size={10} weight="fill" aria-hidden="true" />{item.rating.toFixed(1)}</span> : null}
  </Link>
}

export function PosterGrid({ items }: { items: PosterItem[] }) {
  return <div className="grid">{items.map((item) => <PosterCard item={item} key={`${item.mediaType}-${item.tmdbId}`} />)}</div>
}

export function Rail({ rail, href }: { rail: Pick<CatalogRail, "key" | "label" | "items" | "href">; href?: string }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const enhanced = useContext(EnhancedContext)
  const scroll = (direction: number) => trackRef.current?.scrollBy({ left: direction * trackRef.current.clientWidth * 0.8, behavior: "smooth" })
  return <section className="rail" aria-label={rail.label}>
    <div className="rail-head">
      <h2>{rail.label}</h2>
      <div className="rail-actions">
        {enhanced && <><Button variant="ghost" size="icon" className="rail-nav" aria-label="Scroll left" onClick={() => scroll(-1)}><CaretLeftIcon size={18} /></Button><Button variant="ghost" size="icon" className="rail-nav" aria-label="Scroll right" onClick={() => scroll(1)}><CaretRightIcon size={18} /></Button></>}
        <Link className={buttonVariants({ variant: "ghost", size: "icon" })} to={href ?? rail.href ?? `/browse/${rail.key}`} aria-label={`Browse ${rail.label}`} title="Browse"><ArrowRightIcon size={18} /></Link>
      </div>
    </div>
    <div className="rail-track" ref={trackRef}>{rail.items.map((item) => <PosterCard item={item} key={`${item.mediaType}-${item.tmdbId}`} />)}</div>
  </section>
}

export function Hero({ item }: { item: MediaTitle }) {
  const backdrop = tmdbImageUrl(item.backdropPath, "w780")
  return <section className="hero" aria-label="Featured">
    {backdrop && <img className="hero-img" src={backdrop} alt="" fetchPriority="high" />}
    <div className="hero-shade" />
    <div className="hero-copy">
      <h1>{item.title}</h1>
      <p className="meta"><span>{formatYear(item.releaseDate)}</span>{item.rating ? <span className="rating"><StarIcon size={12} weight="fill" aria-hidden="true" />{item.rating.toFixed(1)}</span> : null}{item.mediaType === "tv" && <TelevisionIcon size={14} aria-label="Series" />}</p>
      <div className="hero-actions">
        <Link className={buttonVariants({ variant: "solid", size: "lg" })} to={watchPath(item)} aria-label={`Play ${item.title}`} title="Play"><PlayIcon size={24} weight="fill" /></Link>
        <Link className={buttonVariants({ variant: "soft", size: "lg" })} to={detailPath(item)} aria-label={`About ${item.title}`} title="Details"><InfoIcon size={24} /></Link>
      </div>
    </div>
  </section>
}
