import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeftIcon, ArrowUpRightIcon, DownloadSimpleIcon, HeartIcon, SkipBackIcon, SkipForwardIcon, StarIcon } from "@phosphor-icons/react"
import { EpisodeBrowser, watchEpisodePath } from "../components/episodes"
import { detailPath, PosterCard } from "../components/media"
import { ServerPicker } from "../components/ServerPicker"
import { NotFound, Spinner } from "../components/states"
import { Button, buttonVariants } from "../components/ui/button"
import { CatalogDataContext, EnhancedContext } from "../lib/app-context"
import { getSeason, getTitle } from "../lib/catalog"
import { openProviderDownload, requestProviderDownload } from "../lib/download-service"
import { useDownloads, useMyList, useWatched } from "../lib/local-state"
import { isNativeDownloadAvailable, startNativeDownload } from "../lib/native-download"
import type { MediaTitle, Season } from "../lib/types"
import { cn, downloadFileName, formatRuntime, formatYear, positiveParam, tmdbImageUrl } from "../lib/utils"
import { buildVideoEmbedUrl, DEFAULT_VIDEO_SERVER, getPreferredServer, isVideoServer, serverLabel, type VideoServer } from "../lib/video"

export function WatchPage({ mediaType }: { mediaType: "movie" | "tv" }) {
  const serverData = useContext(CatalogDataContext)
  const enhanced = useContext(EnhancedContext)
  const { tmdbId } = useParams()
  const [params] = useSearchParams()
  const id = Number(tmdbId)
  const seasonNumber = positiveParam(params.get("season"), 1)
  const episodeNumber = positiveParam(params.get("episode"), 1)
  const serverParam = params.get("server")
  const explicitServer = isVideoServer(serverParam) ? serverParam : undefined

  // The remembered server is read after mount so server and client markup match.
  const [remembered, setRemembered] = useState<VideoServer>(DEFAULT_VIDEO_SERVER)
  useEffect(() => setRemembered(getPreferredServer()), [])
  const server = explicitServer ?? remembered

  const [title, setTitle] = useState<MediaTitle | null>(serverData.title?.tmdbId === id ? serverData.title : null)
  const [missing, setMissing] = useState(Boolean(serverData.titleLoaded && !serverData.title))
  const [season, setSeason] = useState<Season | null>(serverData.season?.tmdbId === id ? serverData.season : null)
  const [seasonLoading, setSeasonLoading] = useState(mediaType === "tv" && !serverData.titleLoaded)
  const [playerLoading, setPlayerLoading] = useState(true)
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const { addDownload, updateDownload } = useDownloads()
  const { toggle, has } = useMyList()
  const { seen, mark } = useWatched(id)
  const sideRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (title?.tmdbId === id) return
    let live = true
    getTitle(mediaType, id).then((result) => { if (!live) return; setTitle(result ?? null); setMissing(!result) }).catch(() => undefined)
    return () => { live = false }
    // `title` is read to skip a refetch, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, id])

  useEffect(() => {
    if (mediaType !== "tv") { setSeasonLoading(false); return }
    if (season?.tmdbId === id && season.seasonNumber === seasonNumber) { setSeasonLoading(false); return }
    let live = true
    setSeasonLoading(true)
    getSeason(id, seasonNumber).then((result) => { if (live) setSeason(result ?? null) }).catch(() => { if (live) setSeason(null) }).finally(() => { if (live) setSeasonLoading(false) })
    return () => { live = false }
    // `season` is read, not watched: this runs when the requested season changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mediaType, seasonNumber])

  // Opening an episode counts as watching it; this also powers "resume" on the details page.
  useEffect(() => { if (enhanced && mediaType === "tv") mark(seasonNumber, episodeNumber) }, [enhanced, mediaType, seasonNumber, episodeNumber, mark])

  const currentEpisode = season?.seasonNumber === seasonNumber ? season.episodes.find((item) => item.episodeNumber === episodeNumber) : undefined
  const embedUrl = buildVideoEmbedUrl({ server, title: { tmdbId: id, imdbId: title?.imdbId }, mediaType, seasonNumber, episodeNumber })
  const heading = title?.title ?? "MovieLand"
  const playerTitle = currentEpisode ? `${heading} · ${currentEpisode.name}` : heading

  useEffect(() => {
    setPlayerLoading(true)
    // Some providers never fire a load event; do not spin forever.
    const timer = window.setTimeout(() => setPlayerLoading(false), 15_000)
    return () => window.clearTimeout(timer)
  }, [embedUrl])

  // On desktop the episode list scrolls on its own; keep the playing episode in view.
  useEffect(() => {
    const side = sideRef.current
    const row = side?.querySelector<HTMLElement>(".episode.selected")
    if (!side || !row || side.scrollHeight <= side.clientHeight + 1) return
    side.scrollTo({ top: row.offsetTop - side.clientHeight / 3 })
  }, [season, episodeNumber, seasonNumber])

  // Previous and next episode, crossing season boundaries using the season list.
  const neighbours = useMemo(() => {
    if (mediaType !== "tv" || !title?.seasons?.length) return { prev: undefined, next: undefined }
    const seasons = [...title.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber)
    const index = seasons.findIndex((item) => item.seasonNumber === seasonNumber)
    const count = season?.seasonNumber === seasonNumber ? season.episodes.length : seasons[index]?.episodeCount ?? 0
    const link = (s: number, e: number) => watchEpisodePath(id, s, e, explicitServer)
    let next: string | undefined
    if (episodeNumber < count) next = link(seasonNumber, episodeNumber + 1)
    else if (seasons[index + 1]) next = link(seasons[index + 1].seasonNumber, 1)
    let prev: string | undefined
    if (episodeNumber > 1) prev = link(seasonNumber, episodeNumber - 1)
    else if (index > 0 && seasons[index - 1].episodeCount > 0) prev = link(seasons[index - 1].seasonNumber, seasons[index - 1].episodeCount)
    return { prev, next }
  }, [mediaType, title, season, seasonNumber, episodeNumber, id, explicitServer])

  const hrefFor = (next: VideoServer) => {
    const query = new URLSearchParams(params)
    query.set("server", next)
    return `?${query}`
  }

  async function requestDownload() {
    if (!embedUrl || !title || preparing) return
    setPreparing(true)
    setNotice(null)
    try {
      const job = await requestProviderDownload({ tmdbId: id, mediaType, seasonNumber: mediaType === "tv" ? seasonNumber : undefined, episodeNumber: mediaType === "tv" ? episodeNumber : undefined })
      if (!isNativeDownloadAvailable) { setNotice({ tone: "ok", text: "File available. Open it from Downloads." }); return }
      const file = await openProviderDownload(job.id)
      const item = addDownload({ engine: "native", remoteId: job.id, tmdbId: id, mediaType, title: job.title, seasonNumber: job.seasonNumber, episodeNumber: job.episodeNumber, episodeName: currentEpisode?.name, server: "VidLove", url: file.url, fileName: file.fileName ?? downloadFileName(job.title, mediaType, job.seasonNumber, job.episodeNumber), sourceType: "direct" })
      try {
        await startNativeDownload({ id: item.id, url: file.url, fileName: file.fileName })
        updateDownload(item.id, { status: "downloading", error: undefined })
        setNotice({ tone: "ok", text: "Download started." })
      } catch (error) {
        updateDownload(item.id, { status: "failed", error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Download unavailable" }) }
    finally { setPreparing(false) }
  }

  if (missing) return <NotFound />
  const backdrop = tmdbImageUrl(title?.backdropPath, "w780")
  const saved = title ? has(title.tmdbId, title.mediaType) : false
  const isSeries = mediaType === "tv"
  const episodeLabel = isSeries ? `S${seasonNumber} · E${episodeNumber}` : null
  const runtime = isSeries ? currentEpisode?.runtime : title?.runtime

  return <div className={cn("watch", isSeries && "watch-series")}>
    <div className="watch-primary">
      <div className="stage-wrap">
        <div className="stage" aria-busy={enhanced && playerLoading}>
          {enhanced
            ? <iframe key={embedUrl ?? "empty"} title={`${serverLabel(server)} player for ${playerTitle}`} src={embedUrl ?? "about:blank"} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setPlayerLoading(false)} />
            : <>{backdrop && <img className="stage-poster" src={backdrop} alt="" />}<noscript><p className="stage-note">Playback requires JavaScript. You can still browse titles and episodes here.</p></noscript></>}
          {enhanced && playerLoading && embedUrl && <div className="player-loading-overlay"><Spinner label={`Loading ${serverLabel(server)}`} /></div>}
          {enhanced && !embedUrl && <p className="stage-note">Choose an episode to start.</p>}
        </div>
      </div>

      <div className="watch-bar">
        <Link className={buttonVariants({ variant: "soft", size: "icon" })} to={title ? detailPath(title) : "/"} aria-label="Back to details" title="Back"><ArrowLeftIcon /></Link>
        <div className="watch-tools">
          <ServerPicker value={server} hrefFor={hrefFor} />
          <Button variant="soft" size="icon" aria-label="Download" title="Download" onClick={requestDownload} disabled={!enhanced || !embedUrl || !title || preparing} aria-busy={preparing}>{preparing ? <Spinner label="Preparing download" className="spinner-sm" /> : <DownloadSimpleIcon />}</Button>
          <Button variant="soft" size="icon" className={cn(saved && "on")} aria-label={saved ? "Remove from my list" : "Save to my list"} aria-pressed={saved} title={saved ? "Remove from my list" : "Save to my list"} disabled={!enhanced || !title} onClick={() => title && toggle(title.tmdbId, title.mediaType)}><HeartIcon weight={saved ? "fill" : "regular"} /></Button>
          <a className={buttonVariants({ variant: "soft", size: "icon" })} href={embedUrl ?? "#"} target="_blank" rel="noreferrer" aria-label="Open in new tab" title="Open in new tab"><ArrowUpRightIcon /></a>
        </div>
      </div>

      <div className="watch-heading">
        <div className="watch-heading-copy">
          <h1>{title ? <Link to={detailPath(title)}>{heading}</Link> : heading}</h1>
          <p className="meta">
            {episodeLabel && <span className="badge">{episodeLabel}</span>}
            {isSeries && currentEpisode && <span className="meta-episode">{currentEpisode.name}</span>}
            {title && <span>{formatYear(title.releaseDate)}</span>}
            {runtime ? <span>{formatRuntime(runtime)}</span> : null}
            {title?.rating ? <span className="rating"><StarIcon size={12} weight="fill" aria-hidden="true" />{title.rating.toFixed(1)}</span> : null}
          </p>
        </div>
        {isSeries && <div className="watch-skip">
          {neighbours.prev ? <Link className={buttonVariants({ variant: "soft", size: "icon" })} to={neighbours.prev} aria-label="Previous episode" title="Previous episode"><SkipBackIcon weight="fill" /></Link> : <Button variant="soft" size="icon" disabled aria-label="Previous episode"><SkipBackIcon weight="fill" /></Button>}
          {neighbours.next ? <Link className={buttonVariants({ variant: "solid", size: "icon" })} to={neighbours.next} aria-label="Next episode" title="Next episode"><SkipForwardIcon weight="fill" /></Link> : <Button variant="soft" size="icon" disabled aria-label="Next episode"><SkipForwardIcon weight="fill" /></Button>}
        </div>}
      </div>
      {notice && <p className={cn("watch-notice", notice.tone)} role="status">{notice.text}</p>}

      {!isSeries && title?.recommendations?.length ? <section className="rail watch-more" aria-label="Similar"><div className="rail-track">{title.recommendations.map((item) => <PosterCard item={item} key={`${item.mediaType}-${item.tmdbId}`} />)}</div></section> : null}
    </div>

    {isSeries && title && <aside className="watch-side" ref={sideRef} aria-label="Episodes">
      <EpisodeBrowser title={title} season={season} loading={seasonLoading} seasonNumber={seasonNumber} episodeNumber={episodeNumber} server={explicitServer} seen={seen} watchMode />
    </aside>}
  </div>
}
