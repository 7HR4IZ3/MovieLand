import { useContext, useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeftIcon, ArrowUpRightIcon, DownloadSimpleIcon } from "@phosphor-icons/react"
import { EpisodeBrowser } from "../components/episodes"
import { detailPath } from "../components/media"
import { ServerPicker } from "../components/ServerPicker"
import { NotFound, Spinner } from "../components/states"
import { Button, buttonVariants } from "../components/ui/button"
import { CatalogDataContext, EnhancedContext } from "../lib/app-context"
import { getSeason, getTitle } from "../lib/catalog"
import { openProviderDownload, requestProviderDownload } from "../lib/download-service"
import { useDownloads } from "../lib/local-state"
import { isNativeDownloadAvailable, startNativeDownload } from "../lib/native-download"
import type { MediaTitle, Season } from "../lib/types"
import { downloadFileName, positiveParam, tmdbImageUrl } from "../lib/utils"
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
  const [notice, setNotice] = useState<"ok" | "error" | null>(null)
  const [noticeText, setNoticeText] = useState("")
  const [preparing, setPreparing] = useState(false)
  const { addDownload, updateDownload } = useDownloads()

  useEffect(() => {
    if (title?.tmdbId === id) return
    let live = true
    getTitle(mediaType, id).then((result) => { if (!live) return; setTitle(result ?? null); setMissing(!result) }).catch(() => undefined)
    return () => { live = false }
  }, [mediaType, id, title?.tmdbId])

  useEffect(() => {
    if (mediaType !== "tv") { setSeasonLoading(false); return }
    if (season?.tmdbId === id && season.seasonNumber === seasonNumber) { setSeasonLoading(false); return }
    let live = true
    setSeasonLoading(true)
    getSeason(id, seasonNumber).then((result) => { if (live) setSeason(result ?? null) }).catch(() => { if (live) setSeason(null) }).finally(() => { if (live) setSeasonLoading(false) })
    return () => { live = false }
  // `season` is intentionally read, not watched: this runs when the requested episode changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mediaType, seasonNumber])

  const currentEpisode = season?.episodes.find((item) => item.episodeNumber === episodeNumber)
  const displayTitle = title ? (currentEpisode ? `${title.title} · ${currentEpisode.name}` : title.title) : "MovieLand"
  const embedUrl = buildVideoEmbedUrl({ server, title: { tmdbId: id, imdbId: title?.imdbId }, mediaType, seasonNumber, episodeNumber })

  useEffect(() => {
    setPlayerLoading(true)
    // Some providers never fire a load event; do not spin forever.
    const timer = window.setTimeout(() => setPlayerLoading(false), 15_000)
    return () => window.clearTimeout(timer)
  }, [embedUrl])

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
      if (!isNativeDownloadAvailable) { setNotice("ok"); setNoticeText("File available. Open it from Downloads."); return }
      const file = await openProviderDownload(job.id)
      const item = addDownload({ engine: "native", remoteId: job.id, tmdbId: id, mediaType, title: job.title, seasonNumber: job.seasonNumber, episodeNumber: job.episodeNumber, episodeName: currentEpisode?.name, server: "VidLove", url: file.url, fileName: file.fileName ?? downloadFileName(job.title, mediaType, job.seasonNumber, job.episodeNumber), sourceType: "direct" })
      try {
        await startNativeDownload({ id: item.id, url: file.url, fileName: file.fileName })
        updateDownload(item.id, { status: "downloading", error: undefined })
        setNotice("ok"); setNoticeText("Download started.")
      } catch (error) {
        updateDownload(item.id, { status: "failed", error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    } catch (error) { setNotice("error"); setNoticeText(error instanceof Error ? error.message : "Download unavailable") }
    finally { setPreparing(false) }
  }

  if (missing) return <NotFound />
  const backdrop = tmdbImageUrl(title?.backdropPath, "w780")
  return <div className="watch">
    <div className="stage" aria-busy={enhanced && playerLoading}>
      {enhanced
        ? <iframe key={embedUrl ?? "empty"} title={`${serverLabel(server)} player for ${displayTitle}`} src={embedUrl ?? "about:blank"} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setPlayerLoading(false)} />
        : <>{backdrop && <img className="stage-poster" src={backdrop} alt="" />}<noscript><p className="stage-note">Playback requires JavaScript. You can still browse titles and episodes here.</p></noscript></>}
      {enhanced && playerLoading && embedUrl && <div className="player-loading-overlay"><Spinner label={`Loading ${serverLabel(server)}`} /></div>}
      {enhanced && !embedUrl && <p className="stage-note">Choose an episode to start.</p>}
    </div>

    <div className="watch-bar">
      <Link className={buttonVariants({ variant: "soft", size: "icon" })} to={title ? detailPath(title) : "/"} aria-label="Back" title="Back"><ArrowLeftIcon /></Link>
      <h1 className="watch-title">{displayTitle}</h1>
      <div className="watch-tools">
        <ServerPicker value={server} hrefFor={hrefFor} />
        <Button variant="soft" size="icon" aria-label="Download" title="Download" onClick={requestDownload} disabled={!enhanced || !embedUrl || !title || preparing} aria-busy={preparing}>{preparing ? <Spinner label="Preparing download" className="spinner-sm" /> : <DownloadSimpleIcon />}</Button>
        <a className={buttonVariants({ variant: "soft", size: "icon" })} href={embedUrl ?? "#"} target="_blank" rel="noreferrer" aria-label="Open in new tab" title="Open in new tab"><ArrowUpRightIcon /></a>
      </div>
    </div>
    {notice && <p className={`watch-notice ${notice}`} role="status">{noticeText}</p>}

    {mediaType === "tv" && title && <div className="watch-episodes"><EpisodeBrowser title={title} season={season} loading={seasonLoading} seasonNumber={seasonNumber} episodeNumber={episodeNumber} server={explicitServer} watchMode /></div>}
  </div>
}
