import { useContext, useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeftIcon, HeartIcon, InfoIcon, PlayIcon, StarIcon, UsersIcon, XIcon } from "@phosphor-icons/react"
import { EpisodeBrowser } from "../components/episodes"
import { Poster, PosterCard, SafeImage } from "../components/media"
import { InlineError, NotFound, Spinner } from "../components/states"
import { Button, buttonVariants } from "../components/ui/button"
import { Skeleton } from "../components/ui/skeleton"
import { CatalogDataContext, EnhancedContext } from "../lib/app-context"
import { getSeason, getTitle } from "../lib/catalog"
import { useMyList } from "../lib/local-state"
import type { MediaTitle, Season } from "../lib/types"
import { cn, formatRuntime, formatYear, positiveParam, tmdbImageUrl } from "../lib/utils"

export function DetailPage({ mediaType }: { mediaType: "movie" | "tv" }) {
  const serverData = useContext(CatalogDataContext)
  const { tmdbId } = useParams()
  const id = Number(tmdbId)
  const [title, setTitle] = useState<MediaTitle | null>(serverData.title?.tmdbId === id ? serverData.title : null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [missing, setMissing] = useState(Boolean(serverData.titleLoaded && !serverData.title))

  useEffect(() => {
    if (serverData.title?.tmdbId === id && attempt === 0) return
    if (serverData.titleLoaded && !serverData.title && attempt === 0) return
    let live = true
    setTitle(null)
    setFailed(false)
    setMissing(false)
    getTitle(mediaType, id).then((result) => { if (!live) return; setTitle(result ?? null); setMissing(!result) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [mediaType, id, serverData.title, serverData.titleLoaded, attempt])

  if (failed) return <div className="page"><InlineError onRetry={() => setAttempt((value) => value + 1)} /></div>
  if (missing || !Number.isInteger(id)) return <NotFound />
  if (!title) return <div className="page-flush"><Skeleton className="sk-hero" /><span className="sr-only" role="status">Loading</span></div>
  return <DetailContent title={title} />
}

function DetailContent({ title }: { title: MediaTitle }) {
  const serverData = useContext(CatalogDataContext)
  const enhanced = useContext(EnhancedContext)
  const [params] = useSearchParams()
  const { toggle, has } = useMyList()
  const firstSeason = positiveParam(params.get("season"), title.seasons?.[0]?.seasonNumber ?? 1)
  const [seasonNumber, setSeasonNumber] = useState(firstSeason)
  const [season, setSeason] = useState<Season | null>(serverData.season?.tmdbId === title.tmdbId ? serverData.season : null)
  const [seasonLoading, setSeasonLoading] = useState(title.mediaType === "tv" && !serverData.titleLoaded)

  useEffect(() => {
    if (title.mediaType !== "tv") { setSeasonLoading(false); return }
    if (serverData.titleLoaded && seasonNumber === firstSeason && serverData.season?.tmdbId === title.tmdbId && serverData.season.seasonNumber === seasonNumber) {
      setSeason(serverData.season)
      setSeasonLoading(false)
      return
    }
    let live = true
    setSeason(null)
    setSeasonLoading(true)
    getSeason(title.tmdbId, seasonNumber).then((result) => { if (live) setSeason(result ?? null) }).catch(() => undefined).finally(() => { if (live) setSeasonLoading(false) })
    return () => { live = false }
  }, [title.tmdbId, title.mediaType, seasonNumber, serverData.titleLoaded, serverData.season, firstSeason])

  const saved = has(title.tmdbId, title.mediaType)
  const firstEpisode = season?.episodes[0]?.episodeNumber ?? 1
  const backdrop = tmdbImageUrl(title.backdropPath, "w780")
  const playPath = title.mediaType === "tv" ? `/watch/series/${title.tmdbId}?season=${seasonNumber}&episode=${firstEpisode}` : `/watch/movie/${title.tmdbId}`

  return <div className="page-flush detail">
    <section className="detail-hero">
      {backdrop && <img className="hero-img" src={backdrop} alt="" fetchPriority="high" />}
      <div className="hero-shade" />
      <Link className={cn(buttonVariants({ variant: "soft", size: "icon" }), "detail-back")} to="/" aria-label="Back" title="Back"><ArrowLeftIcon /></Link>
      <div className="detail-head">
        <div className="detail-poster"><Poster item={title} large /></div>
        <div className="detail-copy">
          <h1>{title.title}</h1>
          <p className="meta"><span>{formatYear(title.releaseDate)}</span><span>{title.mediaType === "tv" ? `${title.seasons?.length ?? 0} seasons` : formatRuntime(title.runtime)}</span>{title.rating ? <span className="rating"><StarIcon size={12} weight="fill" aria-hidden="true" />{title.rating.toFixed(1)}</span> : null}</p>
          <div className="hero-actions">
            <Link className={buttonVariants({ variant: "solid", size: "lg" })} to={playPath} aria-label="Play" title="Play"><PlayIcon size={24} weight="fill" /></Link>
            <Button variant="soft" size="lg" disabled={!enhanced} aria-label={saved ? "Remove from my list" : "Save to my list"} title={saved ? "Remove from my list" : "Save to my list"} aria-pressed={saved} className={cn(saved && "on")} onClick={() => toggle(title.tmdbId, title.mediaType)}><HeartIcon size={24} weight={saved ? "fill" : "regular"} /></Button>
          </div>
        </div>
      </div>
    </section>

    <div className="detail-body">
      {(title.overview || title.genres.length > 0) && <details className="about">
        <summary className="btn btn-soft btn-icon" aria-label="About" title="About"><InfoIcon /></summary>
        <div className="about-panel">{title.genres.length > 0 && <div className="chips">{title.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>}{title.overview && <p>{title.overview}</p>}</div>
      </details>}

      {title.mediaType === "tv" && <EpisodeBrowser title={title} season={season} loading={seasonLoading} seasonNumber={seasonNumber} episodeNumber={firstEpisode} onSeasonChange={setSeasonNumber} />}
      <Trailers title={title} />
      <Cast title={title} />
      {title.images?.length ? <section className="strip" aria-label="Images"><div className="strip-track">{title.images.slice(0, 10).map((image) => <SafeImage className="still" loading="lazy" key={image.filePath} src={tmdbImageUrl(image.filePath, "w500")} />)}</div></section> : null}
      {title.recommendations?.length ? <section className="rail" aria-label="Similar"><div className="rail-track">{title.recommendations.map((item) => <PosterCard item={item} key={`${item.mediaType}-${item.tmdbId}`} />)}</div></section> : null}
    </div>
  </div>
}

function Trailers({ title }: { title: MediaTitle }) {
  const enhanced = useContext(EnhancedContext)
  const [active, setActive] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const trailers = title.trailers?.filter((trailer) => trailer.site === "YouTube") ?? []
  if (!trailers.length) return null
  return <section className="strip" aria-label="Trailers">
    {active && <div className="trailer-frame">
      <iframe title="Trailer" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(active)}?rel=0&modestbranding=1&autoplay=1`} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoaded(true)} />
      {!loaded && <div className="player-loading-overlay"><Spinner label="Loading trailer" /></div>}
      <Button className="trailer-close" variant="soft" size="icon" aria-label="Close trailer" onClick={() => { setActive(null); setLoaded(false) }}><XIcon /></Button>
    </div>}
    <div className="strip-track">
      {trailers.map((trailer) => <a className={cn("trailer", active === trailer.key && "selected")} key={trailer.key} href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} target="_blank" rel="noreferrer" title={trailer.name} aria-label={trailer.name}
        onClick={(event) => { if (!enhanced) return; event.preventDefault(); setLoaded(false); setActive(trailer.key) }}>
        <SafeImage loading="lazy" src={`https://i.ytimg.com/vi/${encodeURIComponent(trailer.key)}/hqdefault.jpg`} />
        <span className="trailer-play"><PlayIcon size={20} weight="fill" /></span>
      </a>)}
    </div>
  </section>
}

function Cast({ title }: { title: MediaTitle }) {
  if (!title.credits?.length) return null
  return <section className="strip" aria-label="Cast"><div className="strip-track">{title.credits.slice(0, 12).map((credit) => <div className="person" key={credit.id} title={credit.character ? `${credit.name} · ${credit.character}` : credit.name}>
    <span className="person-empty"><UsersIcon size={20} aria-hidden="true" /><SafeImage loading="lazy" src={tmdbImageUrl(credit.profilePath, "w342")} /></span>
    <span>{credit.name}</span>
  </div>)}</div></section>
}
