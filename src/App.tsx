import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useMutation, useQuery } from "convex/react"
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  IconContext, ArrowLeftIcon as ArrowLeft, ArrowRightIcon, CalendarBlankIcon as CalendarDays,
  CheckIcon as Check, CaretDownIcon as ChevronDown, CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight, ClockIcon as Clock3, CopyIcon as Copy,
  DownloadSimpleIcon as DownloadIcon, ArrowUpRightIcon as ExternalLink, FilmSlateIcon as Film,
  HeartIcon as Heart, HouseIcon as Home, InfoIcon as Info, ChatCircleIcon as MessageCircle,
  PauseIcon as Pause, PlayIcon as Play, PlusIcon as Plus, BroadcastIcon as Radio,
  MagnifyingGlassIcon as Search, PaperPlaneTiltIcon as Send, HardDrivesIcon as Server,
  ShareNetworkIcon as Share2, StarIcon as Star, TrashIcon as Trash2, TelevisionIcon as Tv,
  UsersIcon as Users, UsersThreeIcon as UsersRound, XIcon as X,
} from "@phosphor-icons/react"
import { api } from "../convex/_generated/api"
import type { Id } from "../convex/_generated/dataModel"
import { Badge } from "./components/ui/badge"
import { Button, buttonVariants } from "./components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"
import { Input } from "./components/ui/input"
import { Skeleton } from "./components/ui/skeleton"
import { AdMobBanner } from "./components/AdMobBanner"
import { AdMobLifecycle } from "./components/AdMobLifecycle"
import { AdMobNativeAdvanced } from "./components/AdMobNativeAdvanced"
import { getBrowse, getDiscover, getGenreRails, getSeason, getTitle, searchCatalog } from "./lib/catalog"
import type { ServerCatalogData } from "./lib/catalog-data"
import { isConvexConfigured } from "./lib/convex"
import { useDownloads, useMyList, type DownloadItem } from "./lib/local-state"
import { clearProviderDownloads, openProviderDownload, requestProviderDownload, removeProviderDownload } from "./lib/download-service"
import { isNativeDownloadAvailable, pauseNativeDownload, removeNativeDownload, resumeNativeDownload, startNativeDownload } from "./lib/native-download"
import { cn, formatRuntime, formatYear, tmdbImageUrl } from "./lib/utils"
import { buildVideoEmbedUrl, isVideoServer, requestProviderPlayback, VIDEO_SERVERS, type VideoServer } from "./lib/video"
import { maybeShowMovieLandInterstitial } from "./lib/admob"
import type { BrowseResponse, CatalogRail, GenreRailsResponse, MediaRecommendation, MediaTitle, Season } from "./lib/types"
import {
  createPartyHostToken,
  getPartyIdentity,
  getPartySessionId,
  getRoomHostToken,
  hashPartyToken,
  makePartyRequestId,
  roomPath,
  savePartyIdentity,
  saveRoomHostToken,
  type PartyIdentity,
} from "./lib/watchparty"

const fallbackBackdrop = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1800&q=80"
type PosterItem = MediaTitle | MediaRecommendation
const CatalogDataContext = createContext<ServerCatalogData>({})
const EnhancedContext = createContext(false)

export function AppWithCatalogData({ data }: { data: ServerCatalogData }) {
  const location = useLocation()
  const route = location.pathname + location.search
  const initialRoute = useRef(route)
  const [enhanced, setEnhanced] = useState(false)
  useEffect(() => setEnhanced(true), [])
  return <EnhancedContext.Provider value={enhanced}><CatalogDataContext.Provider value={route === initialRoute.current ? data : {}}><IconContext.Provider value={{ weight: "bold", size: 20, "aria-hidden": true }}><App /></IconContext.Provider></CatalogDataContext.Provider></EnhancedContext.Provider>
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`
}

function formatSpeed(value: number) {
  return value > 0 ? `${formatBytes(value)}/s` : "Waiting for speed"
}

function LoadingIndicator({ label, compact = false }: { label: string; compact?: boolean }) {
  return <span className={cn("loading-indicator", compact && "compact")} role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" />{label}</span>
}

function LoadingButtonContent({ label }: { label: string }) {
  return <span className="loading-button-content"><span className="loading-spinner small" aria-hidden="true" />{label}</span>
}

function downloadFileName(title: string, mediaType: "movie" | "tv", seasonNumber?: number, episodeNumber?: number) {
  const suffix = mediaType === "tv" ? ` S${String(seasonNumber ?? 1).padStart(2, "0")}E${String(episodeNumber ?? 1).padStart(2, "0")}` : ""
  return `${title}${suffix}.mp4`.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim()
}

function App() {
  const location = useLocation()
  const previousPath = useRef<string | null>(null)
  useEffect(() => {
    const previous = previousPath.current
    previousPath.current = location.pathname
    if (!previous || previous === location.pathname) return
    if (!/^\/(movie|series)\//.test(location.pathname)) return
    const timer = window.setTimeout(() => {
      void maybeShowMovieLandInterstitial()
    }, 700)
    return () => window.clearTimeout(timer)
  }, [location.pathname])
  const routes = <Routes key={location.pathname + location.search}>
    <Route path="/" element={<DiscoverPage />} />
    <Route path="/privacy" element={<PrivacyPolicyPage />} />
    <Route path="/search" element={<SearchPage />} />
    <Route path="/my-list" element={<MyListPage />} />
    <Route path="/downloads" element={<DownloadsPage />} />
    <Route path="/watchparty" element={<WatchPartyPage />} />
    <Route path="/watchparty/:roomId" element={<WatchPartyRoomPage />} />
    <Route path="/browse/genre/:genreSlug" element={<BrowsePage />} />
    <Route path="/browse/:category" element={<BrowsePage />} />
    <Route path="/movie/:tmdbId" element={<DetailPage mediaType="movie" />} />
    <Route path="/series/:tmdbId" element={<DetailPage mediaType="tv" />} />
    <Route path="/watch/movie/:tmdbId" element={<WatchPage mediaType="movie" />} />
    <Route path="/watch/series/:tmdbId" element={<WatchPage mediaType="tv" />} />
    <Route path="*" element={<NotFound />} />
  </Routes>

  if (location.pathname.startsWith("/watch/")) return <><AdMobLifecycle /><div className="mobile-player-shell">{routes}</div></>
  return <><AdMobLifecycle /><div className="mobile-app-shell"><Header /><main className="mobile-main">{routes}</main><MobileTabBar /><Footer /></div></>
}

function Header() {
  return <header className="mobile-header">
    <div className="mobile-header-row">
      <Link className="mobile-brand" to="/"><span className="brand-mark"><Film size={17} /></span><span>MovieLand</span></Link>
      <Link className={buttonVariants({ variant: "ghost", size: "icon" })} to="/search?q=" aria-label="Search"><Search size={20} /></Link>
    </div>
  </header>
}

function MobileTabBar() {
  const location = useLocation()
  const isDiscover = location.pathname === "/"
  const isSearch = location.pathname.startsWith("/search") || location.pathname.startsWith("/browse/")
  const isList = location.pathname.startsWith("/my-list")
  const isDownloads = location.pathname.startsWith("/downloads")
  const isParty = location.pathname.startsWith("/watchparty")
  return <nav className="mobile-tab-bar" aria-label="Primary navigation">
    <Link className={cn("mobile-tab", isDiscover && "active")} to="/" aria-label="Home" title="Home" aria-current={isDiscover ? "page" : undefined}><Home size={19} /><span className="sr-only">Home</span></Link>
    <Link className={cn("mobile-tab", isSearch && "active")} to="/search?q=" aria-label="Search" title="Search" aria-current={isSearch ? "page" : undefined}><Search size={19} /><span className="sr-only">Search</span></Link>
    <Link className={cn("mobile-tab", isList && "active")} to="/my-list" aria-label="My list" title="My list" aria-current={isList ? "page" : undefined}><Heart size={19} /><span className="sr-only">My list</span></Link>
    <Link className={cn("mobile-tab", isDownloads && "active")} to="/downloads" aria-label="Downloads" title="Downloads" aria-current={isDownloads ? "page" : undefined}><DownloadIcon size={19} /><span className="sr-only">Downloads</span></Link>
    <Link className={cn("mobile-tab", isParty && "active")} to="/watchparty" aria-label="Watchparty" title="Watchparty" aria-current={isParty ? "page" : undefined}><UsersRound size={23} /><span className="sr-only">Party</span></Link>
  </nav>
}

function DiscoverPage() {
  const serverData = useContext(CatalogDataContext)
  const [state, setState] = useState<{ rails: CatalogRail[]; source: "tmdb" | "fixture" } | null>(serverData.discover ?? null)
  const [genreState, setGenreState] = useState<GenreRailsResponse | null>(serverData.genres ?? null)
  const [genreLoading, setGenreLoading] = useState(Boolean(serverData.discover && !serverData.genres))
  const [error, setError] = useState("")
  useEffect(() => {
    if (serverData.discover) return
    let live = true
    getDiscover().then((result) => {
      if (!live) return
      setState(result)
      setGenreLoading(true)
      getGenreRails().then((genres) => { if (live) setGenreState(genres) }).catch(() => undefined).finally(() => { if (live) setGenreLoading(false) })
    }).catch((reason) => { if (live) setError(String(reason)) })
    return () => { live = false }
  }, [serverData.discover])
  const featured = state?.rails[0]?.items[0]
  return <div className="mobile-page discovery-page" id="top">
    {error && <InlineError message={error} onRetry={() => window.location.reload()} />}
    {!state && !error ? <MobileDiscoverySkeleton /> : state && <>
      {featured && <FeaturedCard item={featured} />}
      <AdMobBanner />
      <AdMobNativeAdvanced />
      {state.rails.map((rail) => <MediaRail key={rail.key} rail={rail} />)}
      {genreLoading && <GenreRailsSkeleton />}
      {genreState && <GenreRailsSection rails={genreState.rails} />}
    </>}
  </div>
}

function BrowsePage({ genreSlug }: { genreSlug?: string }) {
  const serverData = useContext(CatalogDataContext)
  const { category = "", genreSlug: routeGenreSlug } = useParams()
  const [params, setParams] = useSearchParams()
  const resolvedGenreSlug = genreSlug ?? routeGenreSlug
  const browseCategory = resolvedGenreSlug ? `genre-${resolvedGenreSlug}` : category
  const requestedYear = positiveParam(params.get("year"), new Date().getFullYear())
  const requestedPage = positiveParam(params.get("page"), 1)
  const [state, setState] = useState<BrowseResponse | null>(serverData.browse ?? null)
  const [items, setItems] = useState<MediaTitle[]>(serverData.browse?.items ?? [])
  const [error, setError] = useState("")
  useEffect(() => {
    if (serverData.browse) return
    let live = true
    setState(null)
    setItems([])
    setError("")
    getBrowse(browseCategory, { page: requestedPage, year: browseCategory === "top-250-movies" ? requestedYear : undefined, genreSlug: resolvedGenreSlug }).then((result) => {
      if (!live) return
      setState(result)
      setItems(result.items)
    }).catch((reason) => { if (live) setError(String(reason)) })
    return () => { live = false }
  }, [browseCategory, resolvedGenreSlug, requestedYear, requestedPage, serverData.browse])
  function changeYear(value: string) {
    const next = new URLSearchParams(params)
    next.set("year", value)
    next.delete("page")
    setParams(next)
  }
  const yearOptions = Array.from({ length: Math.max(1, new Date().getFullYear() - 1949) }, (_, index) => new Date().getFullYear() - index)
  const displayItems = state ? items : []
  const pagePath = (page: number) => {
    const next = new URLSearchParams(params)
    next.set("page", String(page))
    return `?${next}`
  }
  return <div className="mobile-page browse-page" aria-busy={!state && !error}><Link className="back-link" to="/"><ArrowLeft size={22} /><span className="sr-only">Back to discover</span></Link>{error && <InlineError message={error} onRetry={() => window.location.reload()} />}{!state && !error ? <PosterGridSkeleton /> : state && <><div className="mobile-page-heading"><div><p className="page-kicker">Browse</p><h1>{state.label}</h1></div><Badge variant="outline">{state.totalResults} titles</Badge></div>{browseCategory === "top-250-movies" && <form method="get" className="native-filter-form"><label className="browse-filter"><span>Year</span><select name="year" value={requestedYear} onChange={(event) => changeYear(event.target.value)}>{yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}</select><ChevronDown size={14} /></label><Button type="submit" variant="outline">Apply</Button></form>}{resolvedGenreSlug && <p className="browse-description">Movies and series tagged {params.get("name") ?? state.label}.</p>}<PosterGrid items={displayItems} /><nav className="catalog-pagination" aria-label="Catalog pages">{requestedPage > 1 && <Link className={buttonVariants({ variant: "outline" })} to={pagePath(requestedPage - 1)}>Previous page</Link>}{state.page < state.totalPages && <Link className={buttonVariants({ variant: "outline" })} to={pagePath(state.page + 1)}>Next page</Link>}</nav></>}</div>
}

function FeaturedCard({ item }: { item: MediaTitle }) {
  const detailPath = `/${item.mediaType === "tv" ? "series" : "movie"}/${item.tmdbId}`
  const watchPath = item.mediaType === "tv" ? `/watch/series/${item.tmdbId}?season=1&episode=1` : `/watch/movie/${item.tmdbId}`
  return <section className="featured-card" aria-label="Featured title"><img src={tmdbImageUrl(item.backdropPath, "w780") ?? fallbackBackdrop} alt={`${item.title} backdrop`} /><div className="featured-scrim" /><div className="featured-copy"><div className="featured-copy-main"><p className="featured-label">Featured</p><h1>{item.title}</h1><p><span>{item.mediaType === "tv" ? "Series" : "Movie"}</span><i>·</i><span>{formatYear(item.releaseDate)}</span><i>·</i><span className="rating"><Star size={12} weight="fill" /> {item.rating?.toFixed(1) ?? "—"}</span></p><div className="featured-actions"><Link className={buttonVariants({ size: "icon" })} to={watchPath} aria-label={`Play ${item.title}`} title="Play"><Play size={22} weight="fill" /></Link><Link className={buttonVariants({ variant: "outline", size: "icon" })} to={detailPath} aria-label={`About ${item.title}`} title="Details"><Info size={22} /></Link></div></div></div></section>
}

function SearchPage() {
  const serverData = useContext(CatalogDataContext)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const query = params.get("q")?.trim() ?? ""
  const [input, setInput] = useState(query)
  const [items, setItems] = useState<MediaTitle[] | null>(serverData.search?.items ?? null)
  const [error, setError] = useState("")
  useEffect(() => {
    if (serverData.search) return
    setInput(query)
    if (!query) { setItems([]); return }
    let live = true
    setItems(null)
    setError("")
    searchCatalog(query).then((result) => { if (live) setItems(result.items) }).catch((reason) => { if (live) setError(String(reason)) })
    return () => { live = false }
  }, [query, serverData.search])
  function submit(event: FormEvent) { event.preventDefault(); navigate(`/search?q=${encodeURIComponent(input.trim())}`) }
  return <div className="mobile-page search-page" aria-busy={Boolean(query && !items)}><div className="mobile-page-heading"><div><p className="page-kicker">Catalog</p><h1>Search</h1></div></div><form className="mobile-page-search" action="/search" method="get" onSubmit={submit}><Search size={17} aria-hidden="true" /><Input name="q" aria-label="Search catalog" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Search movies, series, people…" /><Button type="submit" size="icon" aria-label="Submit search" title="Search"><ArrowRightIcon size={22} /></Button></form>{query && <div className="results-summary"><h2>“{query}”</h2><span>{items?.length ?? 0} titles</span></div>}{error && <InlineError message={error} onRetry={() => window.location.reload()} />}{!query ? <SearchPrompt /> : !items ? <PosterGridSkeleton /> : items.length ? <PosterGrid items={items} /> : <EmptyState title="No results" copy="Try another title, actor, or genre." action={<Link className={buttonVariants({ variant: "outline" })} to="/">Back to home</Link>} />}</div>
}

function DownloadsPage() {
  const enhanced = useContext(EnhancedContext)
  const { items, syncError, clearDownloads, removeDownload, updateDownload } = useDownloads()
  const [notice, setNotice] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  async function controlDownload(item: DownloadItem) {
    if (busyId) return
    if (item.engine === "browser" && item.remoteId) {
      // Reserve a tab during the click so async link refresh is not blocked.
      const tab = window.open("about:blank", "_blank")
      if (!tab) { setNotice("Allow a new tab to open the download."); return }
      tab.opener = null
      setBusyId(item.id)
      try {
        const file = await openProviderDownload(item.remoteId)
        tab.location.replace(file.url)
        updateDownload(item.id, { status: "opened", error: undefined })
        setNotice("Opened in your browser. Download progress is managed by the browser.")
      } catch (error) {
        tab.close()
        setNotice(error instanceof Error ? error.message : "Download unavailable")
      } finally { setBusyId(null) }
      return
    }
    if (item.engine !== "native" || item.sourceType !== "direct") {
      setNotice("Download unavailable. Use the download option inside the VidLove player, if offered.")
      return
    }
    setBusyId(item.id)
    try {
      if (item.status === "downloading") await pauseNativeDownload(item.id)
      else if (item.status === "paused") await resumeNativeDownload(item.id)
      else {
        const file = item.remoteId ? await openProviderDownload(item.remoteId) : { url: item.url, fileName: item.fileName ?? downloadFileName(item.title, item.mediaType, item.seasonNumber, item.episodeNumber) }
        await startNativeDownload({ id: item.id, url: file.url, fileName: file.fileName })
        updateDownload(item.id, { status: "downloading", error: undefined })
      }
    } catch (error) {
      updateDownload(item.id, { status: "failed", error: error instanceof Error ? error.message : String(error) })
    } finally { setBusyId(null) }
  }

  async function deleteDownload(item: DownloadItem) {
    if (busyId) return
    setBusyId(item.id)
    try {
      if (["browser", "native"].includes(item.engine ?? "") && item.remoteId) await removeProviderDownload(item.remoteId)
      if (item.engine === "native") await removeNativeDownload(item.id)
      removeDownload(item.id)
    } catch { setNotice("Could not remove this download. Try again.") }
    finally { setBusyId(null) }
  }

  async function clearAll() {
    if (busyId || !window.confirm("Clear this device's download history and native downloads?")) return
    setBusyId("clear")
    try {
      if (isConvexConfigured) await clearProviderDownloads()
      for (const item of items) if (item.engine === "native") await removeNativeDownload(item.id)
      clearDownloads()
    } catch { setNotice("Could not clear all downloads. Try again.") }
    finally { setBusyId(null) }
  }

  if (!enhanced) return <ScriptRequired title="Downloads" copy="Enable JavaScript to access download history on this device." />
  return <div className="mobile-page downloads-page">
    <div className="mobile-page-heading"><div><p className="page-kicker">On this device</p><h1>Downloads</h1></div><Badge variant="outline">{items.length}</Badge></div>
    {(notice || syncError) && <p className="download-notice" role="status">{notice || syncError}</p>}
    {!items.length ? <EmptyState title="No downloads yet" copy="Available files appear here when you request a download." action={<Link className={buttonVariants({ variant: "outline" })} to="/">Browse titles</Link>} /> : <>
      <div className="downloads-toolbar"><span>{items.length} {items.length === 1 ? "item" : "items"}</span><Button variant="ghost" size="icon" aria-label="Clear all downloads" title="Clear all downloads" disabled={Boolean(busyId)} onClick={clearAll}><Trash2 size={22} /></Button></div>
      <section className="download-list" aria-label="Downloads">
        {items.map(item => {
          const browser = item.engine === "browser"
          const progress = item.totalBytes > 0 ? Math.min(100, Math.round(item.bytesDownloaded / item.totalBytes * 100)) : 0
          const statusLabel = browser ? item.status === "opened" ? "Opened in browser" : "File available" : item.status === "completed" ? "Downloaded" : item.status === "downloading" ? "Downloading" : item.status === "paused" ? "Paused" : item.status === "failed" ? "Unavailable" : "Waiting for file"
          return <article className="download-item" key={item.id}>
            <div className="download-item-main">
              <div className="download-item-copy"><strong>{item.title}</strong><span>{item.mediaType === "tv" ? `S${String(item.seasonNumber).padStart(2, "0")} · E${String(item.episodeNumber).padStart(2, "0")}` : "Movie"}</span><small>VidLove · {statusLabel}</small></div>
              {item.engine === "native" ? <div className="download-progress" role="progressbar" aria-label={statusLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="download-progress-track"><span style={{ width: `${progress}%` }} /></div><div className="download-progress-meta"><span>{item.error ?? (item.totalBytes > 0 ? `${formatBytes(item.bytesDownloaded)} of ${formatBytes(item.totalBytes)}` : formatBytes(item.bytesDownloaded))}</span><span>{item.status === "downloading" ? formatSpeed(item.speedBytesPerSecond) : progress ? `${progress}%` : ""}</span></div></div> : item.error ? <small>{item.error}</small> : null}
            </div>
            <div className="download-item-actions">
              {browser && <Button variant="outline" size="icon" disabled={Boolean(busyId)} onClick={() => controlDownload(item)} aria-label={`Open ${item.title} download`} title="Open download"><DownloadIcon size={22} /></Button>}
              {item.engine === "native" && ["downloading", "paused", "failed"].includes(item.status) && <Button variant="outline" size="icon" disabled={Boolean(busyId)} onClick={() => controlDownload(item)} aria-label={item.status === "downloading" ? "Pause download" : item.status === "paused" ? "Resume download" : "Retry download"} title={item.status === "downloading" ? "Pause" : "Resume"}>{item.status === "downloading" ? <Pause size={22} /> : <Play size={22} />}</Button>}
              <Button variant="ghost" size="icon" disabled={Boolean(busyId)} aria-label={`Remove ${item.title} download`} onClick={() => deleteDownload(item)}><Trash2 size={16} /></Button>
            </div>
          </article>
        })}
      </section>
    </>}
  </div>
}

function MyListPage() {
  const enhanced = useContext(EnhancedContext)
  const { entries } = useMyList()
  const [items, setItems] = useState<MediaTitle[] | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let live = true
    Promise.all(entries.map((entry) => getTitle(entry.mediaType, entry.tmdbId))).then((results) => { if (live) setItems(results.filter((item): item is MediaTitle => Boolean(item))) }).catch((reason) => { if (live) setError(String(reason)) })
    return () => { live = false }
  }, [entries])
  if (!enhanced) return <ScriptRequired title="My list" copy="Enable JavaScript to access titles saved on this device." />
  return <div className="mobile-page search-page"><div className="mobile-page-heading"><div><p className="page-kicker">Library</p><h1>My list</h1></div><Badge variant="outline">{entries.length}</Badge></div>{error && <InlineError message={error} onRetry={() => window.location.reload()} />}{items === null ? <PosterGridSkeleton /> : items.length ? <PosterGrid items={items} /> : <EmptyState title="Your list is empty" copy="Save a title to find it here." action={<Link className={buttonVariants()} to="/">Browse titles</Link>} />}</div>
}

function DetailPage({ mediaType }: { mediaType: "movie" | "tv" }) {
  const serverData = useContext(CatalogDataContext)
  const { tmdbId } = useParams()
  const id = Number(tmdbId)
  const [title, setTitle] = useState<MediaTitle | null>(serverData.title ?? null)
  const [error, setError] = useState("")
  useEffect(() => {
    if (serverData.title?.tmdbId === id) return
    let live = true
    setTitle(null)
    setError("")
    getTitle(mediaType, id).then((result) => { if (live) setTitle(result ?? null) }).catch((reason) => { if (live) setError(String(reason)) })
    return () => { live = false }
  }, [mediaType, id, serverData.title])
  if (error) return <div className="mobile-page"><InlineError message={error} onRetry={() => window.location.reload()} /></div>
  if (!title && serverData.titleLoaded) return <NotFound />
  if (!title) return <div className="mobile-page"><DetailSkeleton /></div>
  return <DetailContent title={title} />
}

function DetailContent({ title }: { title: MediaTitle }) {
  const serverData = useContext(CatalogDataContext)
  const enhanced = useContext(EnhancedContext)
  const [params] = useSearchParams()
  const { toggle, has } = useMyList()
  const firstSeason = positiveParam(params.get("season"), title.seasons?.[0]?.seasonNumber ?? 1)
  const [seasonNumber, setSeasonNumber] = useState(firstSeason)
  const [season, setSeason] = useState<Season | null>(serverData.season ?? null)
  const [seasonLoading, setSeasonLoading] = useState(title.mediaType === "tv" && !serverData.titleLoaded)
  useEffect(() => {
    if (title.mediaType !== "tv") {
      setSeasonLoading(false)
      return
    }
    if (serverData.titleLoaded && seasonNumber === firstSeason) {
      setSeason(serverData.season ?? null)
      setSeasonLoading(false)
      return
    }
    let live = true
    setSeason(null)
    setSeasonLoading(true)
    getSeason(title.tmdbId, seasonNumber).then((result) => { if (live) setSeason(result ?? null) }).catch(() => undefined).finally(() => { if (live) setSeasonLoading(false) })
    return () => { live = false }
  }, [title.tmdbId, title.mediaType, seasonNumber, serverData.titleLoaded, firstSeason])
  const firstEpisode = season?.episodes[0]?.episodeNumber ?? 1
  return <div className="mobile-page detail-page">
    <div className="detail-visual"><img className="detail-backdrop-image" src={tmdbImageUrl(title.backdropPath, "w780") ?? fallbackBackdrop} alt={`${title.title} backdrop`} /><div className="detail-visual-scrim" /><Link className="detail-back-link" to="/"><ArrowLeft size={22} /><span className="sr-only">Back to discover</span></Link><div className="detail-hero"><Poster item={title} size="large" /><div className="detail-title"><p className="detail-type">{title.mediaType === "tv" ? "Series" : "Movie"}</p><h1>{title.title}</h1><div className="meta-line"><span>{formatYear(title.releaseDate)}</span><span>·</span><span>{title.mediaType === "tv" ? `${title.seasons?.length ?? 0} seasons` : formatRuntime(title.runtime)}</span><span>·</span><span className="rating"><Star size={12} weight="fill" /> {title.rating?.toFixed(1) ?? "—"}</span></div></div></div></div>
    <div className="detail-body"><div className="genre-list">{title.genres.map((genre) => <span key={genre}>{genre}</span>)}</div><p className="detail-overview">{title.overview}</p><div className="action-row"><Link className={buttonVariants({ size: "icon" })} aria-label="Play title" title="Play" to={title.mediaType === "tv" ? `/watch/series/${title.tmdbId}?season=${seasonNumber}&episode=${firstEpisode}` : `/watch/movie/${title.tmdbId}`}><Play size={22} weight="fill" /></Link><Button disabled={!enhanced} variant="outline" size="icon" aria-label={has(title.tmdbId) ? "Remove from my list" : "Save to my list"} title={has(title.tmdbId) ? "Remove from my list" : "Save to my list"} aria-pressed={has(title.tmdbId)} className={cn(has(title.tmdbId) && "selected")} onClick={() => toggle(title.tmdbId, title.mediaType)}><Heart size={22} weight={has(title.tmdbId) ? "fill" : "bold"} /></Button></div></div>
    {title.mediaType === "tv" && <EpisodeBrowser title={title} season={season} loading={seasonLoading} seasonNumber={seasonNumber} episodeNumber={firstEpisode} onSeasonChange={setSeasonNumber} />}
    <InfoGrid title={title} />
    <TrailerSection title={title} />
    <GallerySection title={title} />
    <CreditsSection title={title} />
    {title.recommendations?.length ? <RecommendationSection items={title.recommendations} /> : null}
    <div className="detail-attribution"><Info size={14} /> Metadata, trailers, and artwork provided by TMDB.</div>
  </div>
}

function InfoGrid({ title }: { title: MediaTitle }) {
  return <section className="info-grid" aria-label="Title facts"><div><CalendarDays size={15} /><span>Release</span><strong>{title.releaseDate ?? "Unknown"}</strong></div><div><Clock3 size={15} /><span>Runtime</span><strong>{title.mediaType === "tv" ? "Series" : formatRuntime(title.runtime)}</strong></div><div><Star size={15} /><span>Rating</span><strong>{title.rating?.toFixed(1) ?? "—"} / 10</strong></div><div><Tv size={15} /><span>Format</span><strong>{title.mediaType === "tv" ? "TV series" : "Feature film"}</strong></div></section>
}

function TrailerSection({ title }: { title: MediaTitle }) {
  const trailers = title.trailers?.filter((trailer) => trailer.site === "YouTube") ?? []
  if (!trailers.length) return null
  return <section className="detail-section"><SectionHeading eyebrow="Watch" title="Trailers" count={`${trailers.length}`} /><div className="trailer-list">{trailers.map((trailer) => <article className="trailer-card" key={trailer.key}><div className="trailer-frame"><iframe loading="lazy" title={trailer.name} src={`https://www.youtube.com/embed/${encodeURIComponent(trailer.key)}?rel=0&modestbranding=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div><div className="trailer-copy"><strong>{trailer.name}</strong><span>{trailer.type}{trailer.official ? " · Official" : ""}</span></div></article>)}</div></section>
}

function GallerySection({ title }: { title: MediaTitle }) {
  if (!title.images?.length) return null
  return <section className="detail-section"><SectionHeading eyebrow="Gallery" title="Images" count={`${title.images.length}`} /><div className="gallery-grid">{title.images.slice(0, 8).map((image) => <img loading="lazy" key={image.filePath} src={tmdbImageUrl(image.filePath, "w500")} alt={`${title.title} still`} />)}</div></section>
}

function CreditsSection({ title }: { title: MediaTitle }) {
  if (!title.credits?.length) return null
  return <section className="detail-section"><SectionHeading eyebrow="Cast" title="Top billed" count={`${title.credits.length}`} /><div className="credit-list credit-list-rich">{title.credits.slice(0, 8).map((credit) => <div className="credit-person" key={credit.id}>{credit.profilePath ? <img loading="lazy" src={tmdbImageUrl(credit.profilePath, "w342")} alt="" /> : <div className="credit-avatar"><Users size={16} /></div>}<strong>{credit.name}</strong><span>{credit.character ?? "Cast"}</span></div>)}</div></section>
}

function EpisodeBrowser({ title, season, loading = false, seasonNumber, episodeNumber, onSeasonChange, server, watchMode = false }: { title: MediaTitle; season: Season | null; loading?: boolean; seasonNumber: number; episodeNumber: number; onSeasonChange?: (season: number) => void; server?: VideoServer; watchMode?: boolean }) {
  const navigate = useNavigate()
  const enhanced = useContext(EnhancedContext)
  const [showAll, setShowAll] = useState(true)
  const episodePath = (nextSeason: number, nextEpisode: number) => `/watch/series/${title.tmdbId}?season=${nextSeason}&episode=${nextEpisode}${server ? `&server=${server}` : ""}`
  useEffect(() => setShowAll(true), [title.tmdbId, seasonNumber])
  function changeSeason(nextSeason: number) {
    if (watchMode) navigate(episodePath(nextSeason, 1))
    else onSeasonChange?.(nextSeason)
  }
  const visibleEpisodes = season ? (showAll ? season.episodes : season.episodes.slice(0, 10)) : []
  return <section className={cn("detail-section episodes-section", watchMode && "watch-episodes")} aria-busy={loading}><SectionHeading eyebrow="Series" title="Episodes" count={season ? `${season.episodes.length} episodes` : undefined} /><div className="episode-toolbar"><form method="get" className="native-filter-form">{watchMode && <input type="hidden" name="episode" value="1" />}<label className="select-wrap"><span>Season</span><select name="season" value={seasonNumber} onChange={(event) => changeSeason(Number(event.target.value))} disabled={loading}>{title.seasons?.map((item) => <option key={item.seasonNumber} value={item.seasonNumber}>{item.name}</option>)}</select><ChevronDown size={14} /></label><Button type="submit" variant="outline">Apply</Button></form>{season?.overview && <p>{season.overview}</p>}</div>{loading ? <EpisodeListSkeleton /> : !season ? <div className="episode-loading">Episodes are unavailable right now.</div> : <><div className="episode-list">{visibleEpisodes.map((item) => { const isCurrent = episodeNumber === item.episodeNumber; return <Link className={cn("episode-row", isCurrent && "selected")} key={item.id} to={episodePath(seasonNumber, item.episodeNumber)}><span className="episode-number">{String(item.episodeNumber).padStart(2, "0")}</span>{item.stillPath ? <img className="episode-thumb" loading="lazy" src={tmdbImageUrl(item.stillPath, "w342")} alt="" /> : <div className="episode-thumb episode-thumb-empty"><Play size={14} /></div>}<span className="episode-info"><strong>{item.name}</strong><span>{item.overview}</span>{isCurrent && watchMode && <em className="episode-current">Playing now</em>}</span><span className="episode-runtime">{formatRuntime(item.runtime)}</span><ChevronRight size={17} /></Link> })}</div>{season.episodes.length > 10 && <button className="episodes-toggle" type="button" disabled={!enhanced} aria-expanded={showAll} onClick={() => setShowAll((current) => !current)}>{showAll ? "Show fewer episodes" : `View all ${season.episodes.length} episodes`}</button>}</>}</section>
}

function WatchPage({ mediaType }: { mediaType: "movie" | "tv" }) {
  const serverData = useContext(CatalogDataContext)
  const enhanced = useContext(EnhancedContext)
  const { tmdbId } = useParams()
  const [params] = useSearchParams()
  const id = Number(tmdbId)
  const seasonNumber = positiveParam(params.get("season"), 1)
  const episodeNumber = positiveParam(params.get("episode"), 1)
  const serverParam = params.get("server")
  const server: VideoServer = isVideoServer(serverParam) ? serverParam : "vidlove"
  const [title, setTitle] = useState<MediaTitle | null>(serverData.title ?? null)
  const [season, setSeason] = useState<Season | null>(serverData.season ?? null)
  const [seasonLoading, setSeasonLoading] = useState(mediaType === "tv" && !serverData.titleLoaded)
  const [playerLoading, setPlayerLoading] = useState(true)
  const playerLoadId = useRef(0)
  const playerLoadStartedAt = useRef(Date.now())
  const [downloadNotice, setDownloadNotice] = useState("")
  const { addDownload, updateDownload } = useDownloads()
  useEffect(() => { if (serverData.titleLoaded) return; let live = true; getTitle(mediaType, id).then((result) => { if (live) setTitle(result ?? null) }).catch(() => undefined); return () => { live = false } }, [mediaType, id, serverData.titleLoaded])
  useEffect(() => {
    if (mediaType !== "tv") {
      setSeasonLoading(false)
      return
    }
    if (serverData.titleLoaded) return
    let live = true
    setSeason(null)
    setSeasonLoading(true)
    getSeason(id, seasonNumber).then((result) => { if (live) setSeason(result ?? null) }).catch(() => undefined).finally(() => { if (live) setSeasonLoading(false) })
    return () => { live = false }
  }, [id, mediaType, seasonNumber, serverData.titleLoaded])
  const currentEpisode = season?.episodes.find((item) => item.episodeNumber === episodeNumber)
  const displayTitle = currentEpisode ? `${title?.title} · ${currentEpisode.name}` : title?.title ?? "MovieLand player"
  const embedUrl = buildVideoEmbedUrl({ server, title: { tmdbId: id, imdbId: title?.imdbId }, mediaType, seasonNumber, episodeNumber })
  useEffect(() => {
    playerLoadId.current += 1
    playerLoadStartedAt.current = Date.now()
    setPlayerLoading(true)
  }, [embedUrl])

  function handlePlayerLoad() {
    const loadId = playerLoadId.current
    const remaining = Math.max(0, 320 - (Date.now() - playerLoadStartedAt.current))
    window.setTimeout(() => {
      if (playerLoadId.current === loadId) setPlayerLoading(false)
    }, remaining)
  }

  const [preparingDownload, setPreparingDownload] = useState(false)
  async function requestDownload() {
    if (!embedUrl || !title || preparingDownload) return
    setPreparingDownload(true)
    setDownloadNotice("")
    try {
      const job = await requestProviderDownload({ tmdbId: id, mediaType, seasonNumber: mediaType === "tv" ? seasonNumber : undefined, episodeNumber: mediaType === "tv" ? episodeNumber : undefined })
      if (!isNativeDownloadAvailable) {
        setDownloadNotice("File available. Open it from Downloads.")
        return
      }
      const file = await openProviderDownload(job.id)
      const item = addDownload({ engine: "native", remoteId: job.id, tmdbId: id, mediaType, title: job.title, seasonNumber: job.seasonNumber, episodeNumber: job.episodeNumber, episodeName: currentEpisode?.name, server: "VidLove", url: file.url, fileName: file.fileName, sourceType: "direct" })
      try {
        await startNativeDownload({ id: item.id, url: file.url, fileName: file.fileName })
        updateDownload(item.id, { status: "downloading", error: undefined })
        setDownloadNotice("Download started.")
      } catch (error) {
        updateDownload(item.id, { status: "failed", error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    } catch (error) { setDownloadNotice(error instanceof Error ? error.message : "Download unavailable") }
    finally { setPreparingDownload(false) }
  }

  const serverLabel = VIDEO_SERVERS.find((option) => option.id === server)?.label ?? "VidLove"
  if (serverData.titleLoaded && !title) return <NotFound />
  return <div className="watch-page">
    <div className="player-stage" aria-busy={enhanced && playerLoading}>
      <div className="player-stage-actions"><Link className="player-stage-action" aria-label="Back to details" to={title ? `/${title.mediaType === "tv" ? "series" : "movie"}/${title.tmdbId}` : "/"}><ArrowLeft size={18} /></Link><Link className="player-stage-action" aria-label="Close player" to="/"><X size={18} /></Link></div>
      <iframe key={embedUrl ?? "empty-player"} title={`${serverLabel} player for ${displayTitle}`} src={embedUrl ?? "about:blank"} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={handlePlayerLoad} />
      {enhanced && playerLoading && <div className="player-loading-overlay"><LoadingIndicator label={`Loading ${serverLabel} player…`} /></div>}
    </div>
    <div className="watch-content">
      <noscript><p className="download-notice">VidLove playback requires JavaScript. You can still browse titles and episodes here.</p></noscript>
      <div className="watch-identity"><div><p className="watch-identity-kicker">{mediaType === "tv" ? `S${String(seasonNumber).padStart(2, "0")} · E${String(episodeNumber).padStart(2, "0")}` : "Movie"} · {serverLabel}</p><h1>{displayTitle}</h1></div>{title && <Link className="watch-details-link" to={`/${title.mediaType === "tv" ? "series" : "movie"}/${title.tmdbId}`}><Info size={22} /><span className="sr-only">Details</span></Link>}</div>
      {mediaType === "tv" && title && <EpisodeBrowser title={title} season={season} loading={seasonLoading} seasonNumber={seasonNumber} episodeNumber={episodeNumber} server={server} watchMode />}
      <div className="watch-footer"><div className="watch-status"><span className="watch-status-dot" aria-hidden="true" /><span><strong>{serverLabel} player</strong><small>Playback controls stay inside the provider iframe.</small>{downloadNotice && <small className="watch-feedback" aria-live="polite">{downloadNotice}</small>}</span></div><div className="watch-footer-actions"><Button variant="outline" size="icon" aria-label="Save to downloads" title="Download" onClick={requestDownload} disabled={!enhanced || !embedUrl || !title || preparingDownload} aria-busy={preparingDownload}><DownloadIcon size={22} /></Button><a aria-label="Open video provider" title="Open video provider" className={buttonVariants({ variant: "outline", size: "icon" })} href={embedUrl ?? "https://player.vidlove.cc/"} target="_blank" rel="noreferrer"><ExternalLink size={22} /></a></div></div>
    </div>
  </div>
}

function WatchPartyPage() {
  const enhanced = useContext(EnhancedContext)
  if (!enhanced) return <ScriptRequired title="Watchparty" copy="Enable JavaScript to join a room, chat, and synchronize playback." />
  if (!isConvexConfigured) return <WatchPartyUnavailable />
  return <LiveWatchPartyLobby />
}

function WatchPartyUnavailable() {
  return <div className="mobile-page watchparty-page"><div className="mobile-page-heading"><div><p className="page-kicker">Together</p><h1>Watchparty</h1></div><Badge variant="outline">Offline</Badge></div><EmptyState title="Watchparty unavailable" copy="Please try again later." action={<Link className={buttonVariants({ variant: "outline" })} to="/">Back to discover</Link>} /></div>
}

function LiveWatchPartyLobby() {
  const navigate = useNavigate()
  const createRoom = useMutation(api.watchParty.createRoom)
  const [identity, setIdentity] = useState<PartyIdentity>(() => getPartyIdentity())
  const [usernameInput, setUsernameInput] = useState(identity.username)
  const [searchInput, setSearchInput] = useState("")
  const [results, setResults] = useState<MediaTitle[]>([])
  const [selectedTitle, setSelectedTitle] = useState<MediaTitle | null>(null)
  const [season, setSeason] = useState<Season | null>(null)
  const [seasonLoading, setSeasonLoading] = useState(false)
  const [seasonNumber, setSeasonNumber] = useState(1)
  const [episodeNumber, setEpisodeNumber] = useState(1)
  const [joinInput, setJoinInput] = useState("")
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!selectedTitle || selectedTitle.mediaType !== "tv") {
      setSeason(null)
      setSeasonLoading(false)
      setSeasonNumber(1)
      setEpisodeNumber(1)
      return
    }
    const firstSeason = selectedTitle.seasons?.[0]?.seasonNumber ?? 1
    setSeasonNumber(firstSeason)
  }, [selectedTitle])

  useEffect(() => {
    if (!selectedTitle || selectedTitle.mediaType !== "tv") return
    let live = true
    setSeason(null)
    setSeasonLoading(true)
    getSeason(selectedTitle.tmdbId, seasonNumber).then((result) => {
      if (!live) return
      setSeason(result ?? null)
      setEpisodeNumber(result?.episodes[0]?.episodeNumber ?? 1)
    }).catch(() => { if (live) setSeason(null) }).finally(() => { if (live) setSeasonLoading(false) })
    return () => { live = false }
  }, [selectedTitle, seasonNumber])

  async function submitSearch(event: FormEvent) {
    event.preventDefault()
    const query = searchInput.trim()
    if (!query) return
    setLoadingSearch(true)
    setError("")
    try {
      setResults((await searchCatalog(query)).items.slice(0, 8))
    } catch (reason) {
      setError(String(reason))
    } finally {
      setLoadingSearch(false)
    }
  }

  function saveIdentity() {
    const next = { userId: identity.userId, username: usernameInput.trim().slice(0, 32) || "Guest" }
    savePartyIdentity(next)
    setIdentity(next)
    setUsernameInput(next.username)
  }

  async function handleCreateRoom() {
    if (!selectedTitle) {
      setError("Choose a movie or series first")
      return
    }
    if (selectedTitle.mediaType === "tv" && (!seasonNumber || !episodeNumber)) {
      setError("Choose a season and episode first")
      return
    }
    const nextIdentity = { userId: identity.userId, username: usernameInput.trim().slice(0, 32) || "Guest" }
    savePartyIdentity(nextIdentity)
    setIdentity(nextIdentity)
    setUsernameInput(nextIdentity.username)
    setCreating(true)
    setError("")
    const hostToken = createPartyHostToken()
    try {
      const room = await createRoom({
        tmdbId: selectedTitle.tmdbId,
        imdbId: selectedTitle.imdbId,
        mediaType: selectedTitle.mediaType,
        seasonNumber: selectedTitle.mediaType === "tv" ? seasonNumber : undefined,
        episodeNumber: selectedTitle.mediaType === "tv" ? episodeNumber : undefined,
        server: "vidlove",
        userId: identity.userId,
        username: nextIdentity.username,
        sessionId: getPartySessionId(),
        hostTokenHash: await hashPartyToken(hostToken),
      })
      saveRoomHostToken(room.roomId, hostToken)
      navigate(roomPath(room.roomId))
    } catch (reason) {
      setError(String(reason))
    } finally {
      setCreating(false)
    }
  }

  function handleJoin(event: FormEvent) {
    event.preventDefault()
    const value = joinInput.trim().replace(/\/$/, "").split("/").pop()
    if (value) navigate(roomPath(value))
  }

  const selectedEpisode = season?.episodes.find((item) => item.episodeNumber === episodeNumber)
  return <div className="mobile-page watchparty-page"><div className="mobile-page-heading"><div><p className="page-kicker">Together</p><h1>Watchparty</h1></div><UsersRound size={24} aria-label="Watch together" /></div><p className="watchparty-intro">Watch together. Share a room link.</p>{error && <InlineError message={error} onRetry={() => setError("")} />}<Card className="party-card"><CardHeader><CardTitle><UsersRound size={18} /> Your name</CardTitle></CardHeader><CardContent className="party-name-form"><label className="party-field"><span className="sr-only">Username</span><Input value={usernameInput} onChange={(event) => setUsernameInput(event.target.value)} maxLength={32} placeholder="Guest" /></label><Button variant="outline" size="icon" aria-label="Save name" title="Save name" onClick={saveIdentity}><Check size={22} /></Button></CardContent></Card><Card className="party-card"><CardHeader><CardTitle><Search size={18} /> Choose a title</CardTitle></CardHeader><CardContent><form className="party-search-form" onSubmit={submitSearch}><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search titles…" aria-label="Search titles catalog" /><Button type="submit" size="icon" aria-label="Search titles" title="Search" disabled={loadingSearch}>{loadingSearch ? <LoadingButtonContent label="Loading" /> : <Search size={22} />}</Button></form>{results.length > 0 && <div className="party-search-results">{results.map((item) => <button className={cn("party-media-option", selectedTitle?.tmdbId === item.tmdbId && selectedTitle.mediaType === item.mediaType && "selected")} type="button" key={`${item.mediaType}-${item.tmdbId}`} onClick={() => setSelectedTitle(item)}><Poster item={item} /><span><strong>{item.title}</strong><small>{item.mediaType === "tv" ? "Series" : "Movie"} · {formatYear(item.releaseDate)}</small></span><Check size={16} /></button>)}</div>}{selectedTitle && <div className="party-selection"><Poster item={selectedTitle} /><div><p className="section-label">Selected title</p><strong>{selectedTitle.title}</strong><span>{selectedTitle.mediaType === "tv" ? "Series" : "Movie"} · {formatYear(selectedTitle.releaseDate)}</span></div></div>}{selectedTitle?.mediaType === "tv" && <div className="party-episode-selectors"><label className="party-field"><span>Season</span><select value={seasonNumber} onChange={(event) => setSeasonNumber(Number(event.target.value))} disabled={seasonLoading}>{selectedTitle.seasons?.map((item) => <option value={item.seasonNumber} key={item.seasonNumber}>{item.name}</option>)}</select></label><label className="party-field"><span>Episode</span><select value={episodeNumber} onChange={(event) => setEpisodeNumber(Number(event.target.value))} disabled={seasonLoading}>{season?.episodes.map((item) => <option value={item.episodeNumber} key={item.episodeNumber}>{String(item.episodeNumber).padStart(2, "0")} · {item.name}</option>)}</select></label>{seasonLoading && <LoadingIndicator compact label="Loading episodes…" />}</div>}{selectedEpisode && <p className="party-selection-note">Starting with episode {String(selectedEpisode.episodeNumber).padStart(2, "0")} · {selectedEpisode.name}</p>}<Button className="party-create-button" size="icon" aria-label="Create room" title="Create room" onClick={handleCreateRoom} disabled={!selectedTitle || creating || seasonLoading}>{creating ? <LoadingButtonContent label="Loading" /> : <UsersRound size={23} />}</Button></CardContent></Card><Card className="party-card"><CardHeader><CardTitle><MessageCircle size={18} /> Join a room</CardTitle></CardHeader><CardContent><form className="party-search-form" onSubmit={handleJoin}><Input value={joinInput} onChange={(event) => setJoinInput(event.target.value)} placeholder="Room link" aria-label="Room link or room id" /><Button type="submit" variant="outline" size="icon" aria-label="Join room" title="Join room"><ArrowRightIcon size={22} /></Button></form></CardContent></Card></div>
}

function WatchPartyRoomPage() {
  const { roomId } = useParams()
  const enhanced = useContext(EnhancedContext)
  if (!enhanced) return <ScriptRequired title="Watchparty" copy="Enable JavaScript to join this room and synchronize playback." />
  if (!isConvexConfigured) return <WatchPartyUnavailable />
  if (!roomId) return <div className="mobile-page"><EmptyState title="Room link is incomplete" copy="Ask the host for a new Watchparty link." action={<Link className={buttonVariants({ variant: "outline" })} to="/watchparty">Create or join a room</Link>} /></div>
  return <LiveWatchPartyRoom roomId={roomId as Id<"watchPartyRooms">} />
}

function LiveWatchPartyRoom({ roomId }: { roomId: Id<"watchPartyRooms"> }) {
  const navigate = useNavigate()
  const identity = getPartyIdentity()
  const sessionId = getPartySessionId()
  const hostToken = getRoomHostToken(String(roomId))
  const roomData = useQuery(api.watchParty.getRoom, { roomId })
  const messages = useQuery(api.watchParty.listMessages, { roomId }) ?? []
  const joinRoom = useMutation(api.watchParty.joinRoom)
  const heartbeat = useMutation(api.watchParty.heartbeat)
  const sendMessage = useMutation(api.watchParty.sendMessage)
  const requestPlayback = useMutation(api.watchParty.requestPlayback)
  const applyPlaybackRequest = useMutation(api.watchParty.applyPlaybackRequest)
  const syncPlayback = useMutation(api.watchParty.syncPlayback)
  const claimHost = useMutation(api.watchParty.claimHost)
  const setServer = useMutation(api.watchParty.setServer)
  const [title, setTitle] = useState<MediaTitle | null>(null)
  const [error, setError] = useState("")
  const [tokenHash, setTokenHash] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const [syncStatus, setSyncStatus] = useState("Room state is waiting for the player")
  const [now, setNow] = useState(() => Date.now())
  const [embedLoaded, setEmbedLoaded] = useState(false)
  const [switchingServer, setSwitchingServer] = useState<VideoServer | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const appliedRequestRef = useRef("")
  const positionRef = useRef(0)

  useEffect(() => { hashPartyToken(hostToken).then(setTokenHash) }, [hostToken])
  useEffect(() => {
    let live = true
    joinRoom({ roomId, userId: identity.userId, username: identity.username, sessionId }).catch((reason) => { if (live) setError(String(reason)) })
    return () => { live = false }
  }, [identity.userId, identity.username, joinRoom, roomId, sessionId])
  useEffect(() => {
    const sendHeartbeat = () => heartbeat({ roomId, userId: identity.userId, username: identity.username, sessionId }).catch(() => undefined)
    sendHeartbeat()
    const timer = window.setInterval(sendHeartbeat, 15_000)
    return () => window.clearInterval(timer)
  }, [heartbeat, identity.userId, identity.username, roomId, sessionId])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!roomData?.room) return
    let live = true
    getTitle(roomData.room.mediaType, roomData.room.tmdbId).then((result) => { if (live) setTitle(result ?? null) }).catch(() => undefined)
    return () => { live = false }
  }, [roomData?.room?.mediaType, roomData?.room?.tmdbId])
  useEffect(() => {
    setEmbedLoaded(false)
  }, [roomData?.room?.server, roomData?.room?.tmdbId, roomData?.room?.seasonNumber, roomData?.room?.episodeNumber])

  const isHost = Boolean(roomData?.room && tokenHash && roomData.room.hostUserId === identity.userId && roomData.room.hostSessionId === sessionId)
  const pendingRequest = roomData?.playback?.pendingRequest
  useEffect(() => {
    if (!isHost || !pendingRequest || !tokenHash || appliedRequestRef.current === pendingRequest.requestId) return
    appliedRequestRef.current = pendingRequest.requestId
    applyPlaybackRequest({ roomId, hostTokenHash: tokenHash, requestId: pendingRequest.requestId }).then(() => setSyncStatus("Host applied the room sync request")).catch((reason) => { appliedRequestRef.current = ""; setError(String(reason)) })
  }, [applyPlaybackRequest, isHost, pendingRequest, roomId, tokenHash])

  const snapshotPlayback = roomData?.playback
  const snapshotPosition = snapshotPlayback ? Math.max(0, snapshotPlayback.positionSeconds + (snapshotPlayback.isPlaying ? (now - snapshotPlayback.positionUpdatedAt) / 1000 : 0)) : 0
  positionRef.current = snapshotPosition
  useEffect(() => {
    if (!isHost || !snapshotPlayback?.isPlaying || !tokenHash) return
    const sendSnapshot = () => syncPlayback({ roomId, hostTokenHash: tokenHash, isPlaying: true, positionSeconds: positionRef.current, revision: snapshotPlayback.revision }).catch(() => undefined)
    const timer = window.setInterval(sendSnapshot, 5_000)
    return () => window.clearInterval(timer)
  }, [isHost, roomId, snapshotPlayback?.isPlaying, snapshotPlayback?.revision, syncPlayback, tokenHash])

  if (roomData === undefined) return <div className="mobile-page watchparty-page"><div className="party-room-loading" role="status" aria-live="polite"><LoadingIndicator label="Loading room…" /><Skeleton className="party-room-skeleton" /></div></div>
  if (roomData === null) return <div className="mobile-page watchparty-page"><EmptyState title="Room unavailable" copy="This room may have expired or the link may be invalid." action={<Link className={buttonVariants()} to="/watchparty">Create or join another room</Link>} /></div>

  const room = roomData.room
  const playback = roomData.playback
  const position = playback ? Math.max(0, playback.positionSeconds + (playback.isPlaying ? (now - playback.positionUpdatedAt) / 1000 : 0)) : 0
  const displayTitle = title?.title ?? (room.mediaType === "tv" ? `Series ${room.tmdbId}` : `Movie ${room.tmdbId}`)
  const embedUrl = buildVideoEmbedUrl({ server: room.server, title: { tmdbId: room.tmdbId, imdbId: room.imdbId }, mediaType: room.mediaType, seasonNumber: room.seasonNumber, episodeNumber: room.episodeNumber })
  const serverLabel = VIDEO_SERVERS.find((option) => option.id === room.server)?.label ?? "VidLove"
  const hostIsPresent = roomData.members.some((member) => member.userId === room.hostUserId)

  async function togglePlayback() {
    if (!playback) return
    const nextPlaying = !playback.isPlaying
    const requestId = makePartyRequestId()
    const providerMessageSent = requestProviderPlayback(iframeRef.current, { action: nextPlaying ? "play" : "pause", positionSeconds: position, revision: playback.revision })
    setSyncStatus(providerMessageSent ? "Sync requested — waiting for the active host" : "Provider control unavailable — syncing room state")
    try {
      await requestPlayback({ roomId, userId: identity.userId, username: identity.username, requestId, isPlaying: nextPlaying, positionSeconds: position })
      if (isHost) setSyncStatus("Sync applied")
    } catch (reason) {
      setError(String(reason))
    }
  }

  async function copyRoomLink() {
    const link = `${window.location.origin}${roomPath(String(roomId))}`
    try { await navigator.clipboard?.writeText(link); setSyncStatus("Room link copied") } catch { setSyncStatus(link) }
  }

  async function shareRoom() {
    const link = `${window.location.origin}${roomPath(String(roomId))}`
    if (navigator.share) { await navigator.share({ title: `Join ${displayTitle} on MovieLand`, url: link }).catch(() => undefined) }
    else await copyRoomLink()
  }

  async function handleClaimHost() {
    const newToken = createPartyHostToken()
    try {
      await claimHost({ roomId, userId: identity.userId, username: identity.username, sessionId, hostTokenHash: await hashPartyToken(newToken) })
      saveRoomHostToken(String(roomId), newToken)
      setSyncStatus("You are now the active host")
    } catch (reason) { setError(String(reason)) }
  }

  async function handleServerChange(nextServer: VideoServer) {
    if (!isHost || nextServer === room.server || switchingServer) return
    setSwitchingServer(nextServer)
    setEmbedLoaded(false)
    const nextLabel = VIDEO_SERVERS.find((option) => option.id === nextServer)?.label ?? nextServer
    setSyncStatus(`Loading ${nextLabel}…`)
    try {
      await setServer({ roomId, hostTokenHash: tokenHash, server: nextServer })
    } catch (reason) {
      setSwitchingServer(null)
      setError(String(reason))
    }
  }

  async function handleMessage(event: FormEvent) {
    event.preventDefault()
    const body = messageInput.trim()
    if (!body) return
    try {
      await sendMessage({ roomId, userId: identity.userId, username: identity.username, body })
      setMessageInput("")
    } catch (reason) { setError(String(reason)) }
  }

  return <div className="mobile-page watchparty-page"><div className="party-room-topbar"><Link className="back-link" to="/watchparty"><ArrowLeft size={17} /> Watchparty</Link><div className="party-room-actions"><Button variant="ghost" size="icon" aria-label="Copy room link" onClick={copyRoomLink}><Copy size={17} /></Button><Button variant="ghost" size="icon" aria-label="Share room" onClick={shareRoom}><Share2 size={17} /></Button></div></div><div className="party-room-heading"><div><p className="page-kicker">Room</p><h1>{displayTitle}</h1><p>{room.mediaType === "tv" ? `Season ${room.seasonNumber} · Episode ${room.episodeNumber}` : "Movie"}</p></div><Badge variant={isHost ? "default" : "outline"}>{isHost ? "Host" : "Guest"}</Badge></div>{error && <InlineError message={error} onRetry={() => setError("")} />}<section className="party-player" aria-label="Watchparty video" aria-busy={!embedLoaded}><div className="party-player-frame">{embedUrl ? <iframe ref={iframeRef} title={`${serverLabel} player for ${displayTitle}`} src={embedUrl} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { setEmbedLoaded(true); setSwitchingServer(null) }} /> : <div className="party-player-empty">This provider needs a valid season and episode.</div>}{!embedLoaded && embedUrl && <div className="player-loading-overlay"><LoadingIndicator label={`Loading ${serverLabel} player…`} /></div>}<span className="party-player-status">{embedLoaded ? serverLabel : "Loading player"}</span></div><div className="party-playback-controls"><Button size="icon" aria-label={playback?.isPlaying ? "Pause for everyone" : "Play for everyone"} title={playback?.isPlaying ? "Pause for everyone" : "Play for everyone"} onClick={togglePlayback} disabled={!playback || !embedLoaded}><span className="party-control-icon">{playback?.isPlaying ? <Pause size={17} /> : <Play size={17} weight="fill" />}</span></Button><div className="party-sync-status" aria-live="polite">{syncStatus}<small>{Math.floor(position / 60)}:{String(Math.floor(position % 60)).padStart(2, "0")}</small></div></div></section><section className="party-server-section"><div className="party-section-heading"><div><p className="section-label">Playback source</p><h2>Server</h2></div><Badge variant="outline">{isHost ? "Host controlled" : "Read only"}</Badge></div><div className="party-server-options">{VIDEO_SERVERS.map((option) => <button className={cn("party-server-option", room.server === option.id && "selected")} type="button" key={option.id} disabled={!isHost || room.server === option.id || Boolean(switchingServer)} onClick={() => handleServerChange(option.id)}><Server size={15} /><span>{option.label}</span>{switchingServer === option.id ? <LoadingIndicator compact label="Loading" /> : room.server === option.id && <Check size={15} />}</button>)}</div></section>{!isHost && !hostIsPresent && <Button className="party-claim-host" variant="outline" onClick={handleClaimHost}>Claim host after inactivity</Button>}<section className="party-chat"><div className="party-section-heading"><div><p className="section-label">Room chat</p><h2><MessageCircle size={17} /> Chat</h2></div><Badge variant="outline"><Users size={13} /> {roomData.members.length}</Badge></div><div className="party-message-list" aria-live="polite">{messages.length ? messages.map((message) => <article className={cn("party-message", message.userId === identity.userId && "own")} key={`${message.userId}-${message.createdAt}`}><strong>{message.username}</strong><p>{message.body}</p></article>) : <p className="party-empty-chat">Say hello when everyone is in.</p>}</div><form className="party-composer" onSubmit={handleMessage}><Input value={messageInput} onChange={(event) => setMessageInput(event.target.value)} maxLength={500} placeholder={`Message as ${identity.username}`} aria-label="Chat message" /><Button size="icon" type="submit" aria-label="Send message"><Send size={17} /></Button></form></section><p className="party-disclaimer">Playback sync depends on the selected video provider.</p></div>
}

function MediaRail({ rail }: { rail: CatalogRail }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollRail = (direction: number) => trackRef.current?.scrollBy({ left: direction * 260, behavior: "smooth" })
  return <section className="media-rail" id={rail.key === "continue" ? "my-list" : undefined}><div className="section-header"><div><h2>{rail.label}</h2><p className="section-caption">{rail.items.length} titles</p></div><div className="section-actions"><Link className="section-link" to={rail.href ?? `/browse/${rail.key}`} aria-label={`Browse ${rail.label}`} title={`Browse ${rail.label}`}><ArrowRightIcon size={22} /></Link><div className="rail-controls"><Button variant="ghost" size="icon" aria-label={`Scroll ${rail.label} left`} onClick={() => scrollRail(-1)}><ChevronLeft size={18} /></Button><Button variant="ghost" size="icon" aria-label={`Scroll ${rail.label} right`} onClick={() => scrollRail(1)}><ChevronRight size={18} /></Button></div></div></div><div className="rail-track" ref={trackRef}>{rail.items.map((item) => <PosterCard item={item} key={`${item.mediaType}-${item.tmdbId}`} />)}</div></section>
}

function GenreRailsSection({ rails }: { rails: GenreRailsResponse["rails"] }) {
  return <section className="genre-collection" aria-labelledby="genres-heading"><div className="genre-collection-heading"><p className="section-label">Browse by</p><h2 id="genres-heading">Genres</h2></div>{rails.map((rail) => <MediaRail key={rail.key} rail={rail} />)}</section>
}

function RecommendationSection({ items }: { items: MediaRecommendation[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  return <section className="detail-section recommendation-section"><SectionHeading eyebrow="Because you watched this" title="You might like" count={`${items.length}`} /><div className="rail-track" ref={trackRef}>{items.map((item) => <PosterCard item={item} key={`${item.mediaType}-${item.tmdbId}`} />)}</div></section>
}

function PosterGrid({ items }: { items: PosterItem[] }) { return <div className="poster-grid">{items.map((item) => <PosterCard item={item} key={`${item.mediaType}-${item.tmdbId}`} />)}</div> }
function PosterCard({ item }: { item: PosterItem }) { return <Link className="poster-card" aria-label={`Open ${item.title}`} to={`/${item.mediaType === "tv" ? "series" : "movie"}/${item.tmdbId}`}><Poster item={item} /><div className="poster-card-copy"><strong>{item.title}</strong><div className="poster-card-meta"><span>{formatYear(item.releaseDate)}</span><i>·</i><span>{item.mediaType === "tv" ? "Series" : "Movie"}</span><i>·</i><span className="rating"><Star size={10} weight="fill" /> {item.rating?.toFixed(1) ?? "—"}</span></div></div></Link> }
function Poster({ item, size = "regular" }: { item: PosterItem; size?: "regular" | "large" }) { const [failed, setFailed] = useState(false); const image = tmdbImageUrl(item.posterPath, size === "large" ? "w780" : "w500"); return <div className={cn("poster", size === "large" && "poster-large", failed && "poster-failed")} style={{ background: failed || !image ? "#f2f2ef" : undefined }}>{image && !failed && <img src={image} alt={`${item.title} poster`} loading={size === "large" ? "eager" : "lazy"} onError={() => setFailed(true)} />}{failed && <span>{item.title}</span>}</div> }
function SectionHeading({ eyebrow, title, count }: { eyebrow?: string; title: string; count?: string }) { return <div className="section-heading"><div>{eyebrow && <p className="section-label">{eyebrow}</p>}<h2>{title}</h2></div>{count && <span className="section-count">{count}</span>}</div> }
function positiveParam(value: string | null, fallback: number) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : fallback }
function InlineError({ onRetry }: { message: string; onRetry: () => void }) { return <Card className="state-box error-state" role="alert"><CardHeader><CardTitle>Unable to load</CardTitle></CardHeader><CardContent><span>Please try again.</span><Button variant="outline" onClick={onRetry}>Try again</Button></CardContent></Card> }
function EmptyState({ title, copy, action }: { title: string; copy: string; action: ReactNode }) { return <Card className="state-box empty-state"><CardContent>{title.toLowerCase().includes("download") ? <DownloadIcon size={32} /> : title.toLowerCase().includes("list") ? <Heart size={32} /> : <Film size={32} />}<strong>{title}</strong><span>{copy}</span>{action}</CardContent></Card> }
function SearchPrompt() { return <Card className="search-prompt"><CardContent><Search size={32} /><h2>Find your next film.</h2></CardContent></Card> }
function MobileDiscoverySkeleton() { return <div className="catalog-loading-state" role="status" aria-live="polite"><LoadingIndicator label="Loading the catalog…" /><Skeleton className="skeleton-featured" />{[1, 2, 3, 4].map((row) => <section className="media-rail" key={row}><Skeleton className="skeleton-heading" /><div className="rail-track">{[1, 2, 3, 4].map((item) => <Skeleton className="skeleton-poster" key={item} />)}</div></section>)}</div> }
function PosterGridSkeleton() { return <div className="catalog-loading-state" role="status" aria-live="polite"><LoadingIndicator label="Loading titles…" /><div className="poster-grid">{[1, 2, 3, 4, 5, 6].map((item) => <Skeleton className="skeleton-grid-poster" key={item} />)}</div></div> }
function EpisodeListSkeleton() { return <div className="episode-loading-state" role="status" aria-live="polite"><LoadingIndicator label="Loading episodes…" />{[1, 2, 3].map((item) => <div className="episode-skeleton-row" key={item}><Skeleton className="episode-skeleton-number" /><Skeleton className="episode-skeleton-thumb" /><div><Skeleton className="episode-skeleton-line" /><Skeleton className="episode-skeleton-line short" /></div></div>)}</div> }
function GenreRailsSkeleton() { return <section className="genre-loading-state" role="status" aria-live="polite"><LoadingIndicator label="Loading genres…" />{[1, 2].map((row) => <div className="media-rail" key={row}><Skeleton className="skeleton-heading" /><div className="rail-track">{[1, 2, 3, 4].map((item) => <Skeleton className="skeleton-poster" key={item} />)}</div></div>)}</section> }
function DetailSkeleton() { return <div className="detail-skeleton catalog-loading-state" role="status" aria-live="polite"><LoadingIndicator label="Loading title details…" /><Skeleton className="skeleton-detail-backdrop" /><div className="detail-skeleton-copy"><Skeleton className="skeleton-detail-poster" /><div><Skeleton className="skeleton-line short" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /></div></div></div> }
function PrivacyPolicyPage() {
  return <div className="mobile-page legal-page">
    <Link className="back-link" to="/"><ArrowLeft size={22} /><span className="sr-only">Back to MovieLand</span></Link>
    <div className="legal-heading">
      <p className="page-kicker">MovieLand</p>
      <h1>Privacy policy</h1>
      <p>Last updated October 5, 2026</p>
    </div>
    <p className="legal-lead">MovieLand helps you discover movies and series. This policy explains what information the app stores, why it is used, and the choices available to you.</p>
    <div className="legal-sections">
      <section>
        <h2>Information we handle</h2>
        <p>MovieLand does not require an account for catalog browsing. The web and mobile app may store your saved titles, watch progress, download queue, temporary Watchparty identity, and room preferences on your device using local storage.</p>
        <p>When you create or join a Watchparty, the temporary user ID, username, room activity, chat messages, presence heartbeat, and playback state are sent to Convex so the room can work in real time. This is temporary application identity, not production authentication.</p>
      </section>
      <section>
        <h2>How information is used</h2>
        <p>We use this information to provide catalog search and discovery, remember local preferences, synchronize Watchparty rooms, display chat messages, and operate playback and download features that you request.</p>
        <p>We do not sell personal information, use Watchparty usernames for advertising profiles, or scrape IMDb. Movie metadata, artwork, credits, and external IDs are supplied by TMDB.</p>
      </section>
      <section>
        <h2>Third-party services</h2>
        <p>MovieLand connects to services that have their own privacy policies and terms:</p>
        <ul>
          <li><a href="https://www.themoviedb.org/privacy-policy" target="_blank" rel="noreferrer">TMDB</a> for catalog metadata and artwork.</li>
          <li>Convex for Watchparty room state, chat, and realtime presence.</li>
          <li>Google AdMob for ads in supported native builds. Ad requests and consent choices are handled according to Google's policies.</li>
          <li>Video providers opened through an iframe or external link. Their pages may collect information directly under their own policies.</li>
        </ul>
      </section>
      <section>
        <h2>Storage and retention</h2>
        <p>When you request an available download, Convex stores the title, episode, file name, and browser handoff history with a seven-day expiry and hourly cleanup. A random device credential in local storage protects access to that history. Clearing site data removes the credential. Your browser or the iOS app transfers supported files directly. MovieLand does not capture or assemble player streams on a server.</p>
        <p>Local data remains on your device until you clear it, uninstall the app, or remove it through an available app control. Watchparty rooms, messages, playback, and presence records are designed to expire and be cleaned up after the room's inactive lifetime. Provider logs and ad data are controlled by the relevant third party.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>You can remove saved titles and downloads from MovieLand, clear the app's site data in your browser, leave a Watchparty, or uninstall the native app. You can also manage advertising and privacy choices through the consent controls shown by the supported native build.</p>
      </section>
      <section>
        <h2>Children's privacy</h2>
        <p>MovieLand is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided information, contact the app publisher through the distribution channel where MovieLand was installed.</p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>We may update this policy when MovieLand's data practices change. The current version will remain available at this URL. For privacy questions or requests, contact the app publisher through the Google Play listing or the channel where you received the app.</p>
      </section>
    </div>
  </div>
}

function Footer() { return <footer className="mobile-footer"><span>Metadata by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a></span><Link to="/privacy" aria-label="Privacy policy" title="Privacy policy"><Info size={20} /></Link></footer> }
function ScriptRequired({ title, copy }: { title: string; copy: string }) {
  return <div className="mobile-page"><h1>{title}</h1><EmptyState title={`${title} unavailable`} copy={copy} action={<Link className={buttonVariants({ variant: "outline" })} to="/">Browse titles</Link>} /></div>
}

function NotFound() { return <div className="mobile-page"><EmptyState title="Page not found" copy="That title or route is not available." action={<Link className={buttonVariants({ variant: "outline" })} to="/">Back to home</Link>} /></div> }

export default App
