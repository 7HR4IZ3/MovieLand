import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useMutation, useQuery } from "convex/react"
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeft, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Copy, ExternalLink,
  Film, Heart, Home, Info, MessageCircle, Pause, Play, Plus, Radio, RotateCcw, RotateCw, Search, Send, Server, Share2, Star,
  Tv, Users, UsersRound, X,
} from "lucide-react"
import { api } from "../convex/_generated/api"
import type { Id } from "../convex/_generated/dataModel"
import { Badge } from "./components/ui/badge"
import { Button, buttonVariants } from "./components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"
import { Input } from "./components/ui/input"
import { Skeleton } from "./components/ui/skeleton"
import { getBrowse, getDiscover, getGenreRails, getSeason, getTitle, searchCatalog } from "./lib/catalog"
import { isConvexConfigured } from "./lib/convex"
import { useMyList } from "./lib/local-state"
import { cn, formatRuntime, formatYear, tmdbImageUrl } from "./lib/utils"
import { buildVideoEmbedUrl, requestProviderPlayback, requestProviderSeek, supportsProviderSeek, VIDEO_SERVERS, type VideoServer } from "./lib/video"
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

function App() {
  const location = useLocation()
  const routes = <Routes>
    <Route path="/" element={<DiscoverPage />} />
    <Route path="/search" element={<SearchPage />} />
    <Route path="/my-list" element={<MyListPage />} />
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

  if (location.pathname.startsWith("/watch/")) return <div className="mobile-player-shell">{routes}</div>
  return <div className="mobile-app-shell"><Header /><main className="mobile-main">{routes}</main><MobileTabBar /><Footer /></div>
}

function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState(new URLSearchParams(location.search).get("q") ?? "")
  const isSearch = location.pathname.startsWith("/search")

  useEffect(() => setQuery(new URLSearchParams(location.search).get("q") ?? ""), [location.search])

  function submit(event: FormEvent) {
    event.preventDefault()
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return <header className="mobile-header">
    <div className="mobile-header-row">
      <Link className="mobile-brand" to="/"><span className="brand-mark"><Film size={17} /></span><span>MovieLand</span></Link>
      {isSearch ? <form className="mobile-header-search" onSubmit={submit} role="search"><Search size={16} aria-hidden="true" /><Input autoFocus aria-label="Search movies and series" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles…" /><button type="submit" aria-label="Search"><ArrowLeft size={16} /></button></form> : <Link className={buttonVariants({ variant: "ghost", size: "icon" })} to="/search?q=" aria-label="Search"><Search size={20} /></Link>}
    </div>
  </header>
}

function MobileTabBar() {
  const location = useLocation()
  const isDiscover = location.pathname === "/"
  const isSearch = location.pathname.startsWith("/search") || location.pathname.startsWith("/browse/")
  const isList = location.pathname.startsWith("/my-list")
  const isParty = location.pathname.startsWith("/watchparty")
  return <nav className="mobile-tab-bar" aria-label="Primary navigation">
    <Link className={cn("mobile-tab", isDiscover && "active")} to="/" aria-current={isDiscover ? "page" : undefined}><Home size={19} /><span>Home</span></Link>
    <Link className={cn("mobile-tab", isSearch && "active")} to="/search?q=" aria-current={isSearch ? "page" : undefined}><Search size={19} /><span>Search</span></Link>
    <Link className={cn("mobile-tab", isList && "active")} to="/my-list" aria-current={isList ? "page" : undefined}><Heart size={19} /><span>My list</span></Link>
    <Link className={cn("mobile-tab", isParty && "active")} to="/watchparty" aria-current={isParty ? "page" : undefined}><Radio size={19} /><span>Party</span></Link>
  </nav>
}

function DiscoverPage() {
  const [state, setState] = useState<{ rails: CatalogRail[]; source: "tmdb" | "fixture" } | null>(null)
  const [genreState, setGenreState] = useState<GenreRailsResponse | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let live = true
    getDiscover().then((result) => {
      if (!live) return
      setState(result)
      getGenreRails().then((genres) => { if (live) setGenreState(genres) }).catch(() => undefined)
    }).catch((reason) => { if (live) setError(String(reason)) })
    return () => { live = false }
  }, [])
  const featured = state?.rails[0]?.items[0]
  return <div className="mobile-page discovery-page" id="top">
    <div className="mobile-page-heading"><div><p className="page-kicker">Home</p><h1>Discover</h1></div><Badge variant="outline">{state?.source === "fixture" ? "Offline" : "TMDB live"}</Badge></div>
    {error && <InlineError message={error} onRetry={() => window.location.reload()} />}
    {!state && !error ? <MobileDiscoverySkeleton /> : state && <>
      {featured && <FeaturedCard item={featured} />}
      {state.rails.map((rail) => <MediaRail key={rail.key} rail={rail} />)}
      {genreState && <GenreRailsSection rails={genreState.rails} />}
    </>}
  </div>
}

function BrowsePage({ genreSlug }: { genreSlug?: string }) {
  const { category = "", genreSlug: routeGenreSlug } = useParams()
  const [params, setParams] = useSearchParams()
  const resolvedGenreSlug = genreSlug ?? routeGenreSlug
  const browseCategory = resolvedGenreSlug ? `genre-${resolvedGenreSlug}` : category
  const requestedYear = positiveParam(params.get("year"), new Date().getFullYear())
  const [state, setState] = useState<BrowseResponse | null>(null)
  const [items, setItems] = useState<MediaTitle[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let live = true
    setState(null)
    setItems([])
    setError("")
    getBrowse(browseCategory, { page: 1, year: browseCategory === "top-250-movies" ? requestedYear : undefined, genreSlug: resolvedGenreSlug }).then((result) => {
      if (!live) return
      setState(result)
      setItems(result.items)
    }).catch((reason) => { if (live) setError(String(reason)) })
    return () => { live = false }
  }, [browseCategory, resolvedGenreSlug, requestedYear])
  function changeYear(value: string) {
    const next = new URLSearchParams(params)
    next.set("year", value)
    setParams(next)
  }
  async function loadMore() {
    if (!state || loadingMore || state.page >= state.totalPages) return
    setLoadingMore(true)
    try {
      const result = await getBrowse(browseCategory, { page: state.page + 1, year: browseCategory === "top-250-movies" ? requestedYear : undefined, genreSlug: resolvedGenreSlug })
      setState((current) => current ? { ...result, items: [...current.items, ...result.items] } : result)
      setItems((current) => [...current, ...result.items])
    } catch (reason) {
      setError(String(reason))
    } finally {
      setLoadingMore(false)
    }
  }
  const yearOptions = Array.from({ length: Math.max(1, new Date().getFullYear() - 1949) }, (_, index) => new Date().getFullYear() - index)
  const displayItems = state ? items : []
  return <div className="mobile-page browse-page"><Link className="back-link" to="/"><ArrowLeft size={17} /> Back to discover</Link>{error && <InlineError message={error} onRetry={() => window.location.reload()} />}{!state && !error ? <PosterGridSkeleton /> : state && <><div className="mobile-page-heading"><div><p className="page-kicker">Browse</p><h1>{state.label}</h1></div><Badge variant="outline">{state.totalResults} titles</Badge></div>{browseCategory === "top-250-movies" && <label className="browse-filter"><span>Year</span><select value={requestedYear} onChange={(event) => changeYear(event.target.value)}>{yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}</select><ChevronDown size={14} /></label>}{resolvedGenreSlug && <p className="browse-description">Movies and series tagged {params.get("name") ?? state.label}.</p>}<PosterGrid items={displayItems} />{state.page < state.totalPages && <Button className="load-more" variant="outline" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</Button>}</>}</div>
}

function FeaturedCard({ item }: { item: MediaTitle }) {
  return <section className="featured-card" aria-label="Featured title"><img src={tmdbImageUrl(item.backdropPath, "w780") ?? fallbackBackdrop} alt="" /><div className="featured-copy"><div className="featured-copy-main"><Badge variant="secondary">Trending now</Badge><h2>{item.title}</h2><p><span>{item.mediaType === "tv" ? "Series" : "Movie"}</span><i>·</i><span>{formatYear(item.releaseDate)}</span><i>·</i><span className="rating"><Star size={12} fill="currentColor" /> {item.rating?.toFixed(1) ?? "—"}</span></p></div><Link className={buttonVariants({ size: "sm" })} to={`/${item.mediaType === "tv" ? "series" : "movie"}/${item.tmdbId}`}><Play size={15} fill="currentColor" /> Details</Link></div></section>
}

function SearchPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const query = params.get("q")?.trim() ?? ""
  const [input, setInput] = useState(query)
  const [items, setItems] = useState<MediaTitle[] | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    setInput(query)
    if (!query) { setItems([]); return }
    let live = true
    setItems(null)
    setError("")
    searchCatalog(query).then((result) => { if (live) setItems(result.items) }).catch((reason) => { if (live) setError(String(reason)) })
    return () => { live = false }
  }, [query])
  function submit(event: FormEvent) { event.preventDefault(); navigate(`/search?q=${encodeURIComponent(input.trim())}`) }
  return <div className="mobile-page search-page"><div className="mobile-page-heading"><div><p className="page-kicker">Catalog</p><h1>Search</h1></div></div><form className="mobile-page-search" onSubmit={submit}><Search size={17} aria-hidden="true" /><Input aria-label="Search catalog" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Search movies, series, people…" /><Button type="submit" size="icon" aria-label="Submit search"><ArrowLeft size={17} /></Button></form>{query && <div className="results-summary"><h2>Results for “{query}”</h2><span>{items?.length ?? 0} titles</span></div>}{error && <InlineError message={error} onRetry={() => window.location.reload()} />}{!query ? <SearchPrompt /> : !items ? <PosterGridSkeleton /> : items.length ? <PosterGrid items={items} /> : <EmptyState title="No results" copy="Try another title, actor, or genre." action={<Link className={buttonVariants({ variant: "outline" })} to="/">Back to home</Link>} />}</div>
}

function MyListPage() {
  const { entries } = useMyList()
  const [items, setItems] = useState<MediaTitle[] | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let live = true
    Promise.all(entries.map((entry) => getTitle(entry.mediaType, entry.tmdbId))).then((results) => { if (live) setItems(results.filter((item): item is MediaTitle => Boolean(item))) }).catch((reason) => { if (live) setError(String(reason)) })
    return () => { live = false }
  }, [entries])
  return <div className="mobile-page search-page"><div className="mobile-page-heading"><div><p className="page-kicker">Library</p><h1>My list</h1></div><Badge variant="outline">{entries.length}</Badge></div>{error && <InlineError message={error} onRetry={() => window.location.reload()} />}{items === null ? <PosterGridSkeleton /> : items.length ? <PosterGrid items={items} /> : <EmptyState title="Your list is empty" copy="Save titles from their detail pages to find them here." action={<Link className={buttonVariants()} to="/">Browse titles</Link>} />}</div>
}

function DetailPage({ mediaType }: { mediaType: "movie" | "tv" }) {
  const { tmdbId } = useParams()
  const id = Number(tmdbId)
  const [title, setTitle] = useState<MediaTitle | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let live = true
    setTitle(null)
    setError("")
    getTitle(mediaType, id).then((result) => { if (live) setTitle(result ?? null) }).catch((reason) => { if (live) setError(String(reason)) })
    return () => { live = false }
  }, [mediaType, id])
  if (error) return <div className="mobile-page"><InlineError message={error} onRetry={() => window.location.reload()} /></div>
  if (!title) return <div className="mobile-page"><DetailSkeleton /></div>
  return <DetailContent title={title} />
}

function DetailContent({ title }: { title: MediaTitle }) {
  const { toggle, has } = useMyList()
  const firstSeason = title.seasons?.[0]?.seasonNumber ?? 1
  const [seasonNumber, setSeasonNumber] = useState(firstSeason)
  const [season, setSeason] = useState<Season | null>(null)
  useEffect(() => {
    if (title.mediaType !== "tv") return
    let live = true
    getSeason(title.tmdbId, seasonNumber).then((result) => { if (live) setSeason(result ?? null) }).catch(() => undefined)
    return () => { live = false }
  }, [title.tmdbId, title.mediaType, seasonNumber])
  const firstEpisode = season?.episodes[0]?.episodeNumber ?? 1
  return <div className="mobile-page detail-page">
    <Link className="back-link" to="/"><ArrowLeft size={17} /> Back to discover</Link>
    <div className="detail-backdrop"><img src={tmdbImageUrl(title.backdropPath, "w780") ?? fallbackBackdrop} alt="" /><div /></div>
    <div className="detail-hero detail-hero-overlap"><Poster item={title} size="large" /><div className="detail-title"><Badge variant="outline">{title.mediaType === "tv" ? "Series" : "Movie"}</Badge><h1>{title.title}</h1><div className="meta-line"><span>{formatYear(title.releaseDate)}</span><span>·</span><span>{title.mediaType === "tv" ? `${title.seasons?.length ?? 0} seasons` : formatRuntime(title.runtime)}</span><span>·</span><span className="rating"><Star size={12} fill="currentColor" /> {title.rating?.toFixed(1) ?? "—"}</span></div></div></div>
    <div className="genre-list">{title.genres.map((genre) => <Badge variant="secondary" key={genre}>{genre}</Badge>)}</div>
    <p className="detail-overview">{title.overview}</p>
    <div className="action-row"><Link className={buttonVariants()} to={title.mediaType === "tv" ? `/watch/series/${title.tmdbId}?season=${seasonNumber}&episode=${firstEpisode}` : `/watch/movie/${title.tmdbId}`}><Play size={16} fill="currentColor" /> {title.mediaType === "tv" ? "Play series" : "Watch now"}</Link><Button variant="outline" className={cn(has(title.tmdbId) && "selected")} onClick={() => toggle(title.tmdbId, title.mediaType)}>{has(title.tmdbId) ? <Check size={16} /> : <Plus size={16} />} {has(title.tmdbId) ? "Saved" : "My list"}</Button></div>
    {title.mediaType === "tv" && <EpisodeBrowser title={title} season={season} seasonNumber={seasonNumber} episodeNumber={firstEpisode} onSeasonChange={setSeasonNumber} />}
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

function EpisodeBrowser({ title, season, seasonNumber, episodeNumber, onSeasonChange, server, watchMode = false }: { title: MediaTitle; season: Season | null; seasonNumber: number; episodeNumber: number; onSeasonChange?: (season: number) => void; server?: VideoServer; watchMode?: boolean }) {
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const episodePath = (nextSeason: number, nextEpisode: number) => `/watch/series/${title.tmdbId}?season=${nextSeason}&episode=${nextEpisode}${server ? `&server=${server}` : ""}`
  useEffect(() => setShowAll(false), [title.tmdbId, seasonNumber])
  function changeSeason(nextSeason: number) {
    if (watchMode) navigate(episodePath(nextSeason, 1))
    else onSeasonChange?.(nextSeason)
  }
  const visibleEpisodes = season ? (showAll ? season.episodes : season.episodes.slice(0, 10)) : []
  return <section className={cn("detail-section episodes-section", watchMode && "watch-episodes")}><SectionHeading eyebrow="Series" title="Episodes" count={season ? `${season.episodes.length} episodes` : undefined} /><div className="episode-toolbar"><label className="select-wrap"><span>Season</span><select value={seasonNumber} onChange={(event) => changeSeason(Number(event.target.value))}>{title.seasons?.map((item) => <option key={item.seasonNumber} value={item.seasonNumber}>{item.name}</option>)}</select><ChevronDown size={14} /></label>{season?.overview && <p>{season.overview}</p>}</div>{!season ? <div className="episode-loading">Loading episodes…</div> : <><div className="episode-list">{visibleEpisodes.map((item) => { const isCurrent = episodeNumber === item.episodeNumber; return <Link className={cn("episode-row", isCurrent && "selected")} key={item.id} to={episodePath(seasonNumber, item.episodeNumber)}><span className="episode-number">{String(item.episodeNumber).padStart(2, "0")}</span>{item.stillPath ? <img className="episode-thumb" loading="lazy" src={tmdbImageUrl(item.stillPath, "w342")} alt="" /> : <div className="episode-thumb episode-thumb-empty"><Play size={14} /></div>}<span className="episode-info"><strong>{item.name}</strong><span>{item.overview}</span>{isCurrent && <em className="episode-current">Playing now</em>}</span><span className="episode-runtime">{formatRuntime(item.runtime)}</span><ChevronRight size={17} /></Link> })}</div>{season.episodes.length > 10 && <button className="episodes-toggle" type="button" aria-expanded={showAll} onClick={() => setShowAll((current) => !current)}>{showAll ? "Show fewer episodes" : `View all ${season.episodes.length} episodes`}</button>}</>}</section>
}

function WatchPage({ mediaType }: { mediaType: "movie" | "tv" }) {
  const { tmdbId } = useParams()
  const [params, setParams] = useSearchParams()
  const id = Number(tmdbId)
  const seasonNumber = positiveParam(params.get("season"), 1)
  const episodeNumber = positiveParam(params.get("episode"), 1)
  const serverParam = params.get("server")
  const server: VideoServer = serverParam === "vidapi" || serverParam === "cdnm" || serverParam === "nontongo" ? serverParam : "vidlove"
  const [title, setTitle] = useState<MediaTitle | null>(null)
  const [season, setSeason] = useState<Season | null>(null)
  const [embedState, setEmbedState] = useState<"loading" | "ready" | "error">("loading")
  const [seekNotice, setSeekNotice] = useState("")
  const iframeRef = useRef<HTMLIFrameElement>(null)
  useEffect(() => { let live = true; getTitle(mediaType, id).then((result) => { if (live) setTitle(result ?? null) }).catch(() => undefined); return () => { live = false } }, [mediaType, id])
  useEffect(() => { if (mediaType !== "tv") return; let live = true; getSeason(id, seasonNumber).then((result) => { if (live) setSeason(result ?? null) }).catch(() => undefined); return () => { live = false } }, [id, mediaType, seasonNumber])
  const currentEpisode = season?.episodes.find((item) => item.episodeNumber === episodeNumber)
  const displayTitle = currentEpisode ? `${title?.title} · ${currentEpisode.name}` : title?.title ?? "MovieLand player"
  const embedUrl = buildVideoEmbedUrl({ server, title: { tmdbId: id, imdbId: title?.imdbId }, mediaType, seasonNumber, episodeNumber })
  function seekBy(deltaSeconds: number) {
    if (!requestProviderSeek(iframeRef.current, server, deltaSeconds)) return
    const direction = deltaSeconds < 0 ? "Rewound" : "Forwarded"
    setSeekNotice(`${direction} ${Math.abs(deltaSeconds)} seconds`)
    window.setTimeout(() => setSeekNotice(""), 1200)
  }
  function selectServer(nextServer: VideoServer) {
    const nextParams = new URLSearchParams(params)
    nextParams.set("server", nextServer)
    setParams(nextParams, { replace: true })
  }
  const serverLabel = VIDEO_SERVERS.find((option) => option.id === server)?.label ?? "VidLove"
  return <div className="watch-page"><div className="player-topbar"><Link className="player-back" to={title ? `/${title.mediaType === "tv" ? "series" : "movie"}/${title.tmdbId}` : "/"}><ArrowLeft size={19} /><span>Back</span></Link><div className="player-title"><span>{mediaType === "tv" ? `S${String(seasonNumber).padStart(2, "0")} · E${String(episodeNumber).padStart(2, "0")}` : "Now watching"}</span><strong>{displayTitle}</strong></div><Link className="icon-button" aria-label="Close player" to="/"><X size={19} /></Link></div><div className="player-stage"><iframe ref={iframeRef} title={`${serverLabel} player for ${displayTitle}`} src={embedUrl ?? "about:blank"} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setEmbedState("ready")} onError={() => setEmbedState("error")} />{supportsProviderSeek(server) && <div className="player-overlay-controls" aria-label="MovieLand playback controls"><button type="button" className="player-overlay-button" onClick={() => seekBy(-10)} aria-label="Rewind 10 seconds"><RotateCcw size={19} /><span>10</span></button><button type="button" className="player-overlay-button" onClick={() => seekBy(10)} aria-label="Forward 10 seconds"><RotateCw size={19} /><span>10</span></button></div>}<div className="embed-status" aria-live="polite">{seekNotice || (embedState === "loading" ? `Loading ${serverLabel}` : embedState === "error" ? `${serverLabel} player unavailable` : serverLabel)}</div></div><div className="watch-content">{mediaType === "tv" && title && <EpisodeBrowser title={title} season={season} seasonNumber={seasonNumber} episodeNumber={episodeNumber} server={server} watchMode />}<section className="server-panel"><div><p className="section-label">Playback</p><h2>Servers</h2></div><div className="server-options">{VIDEO_SERVERS.map((option) => <button className={cn("server-option", server === option.id && "selected")} key={option.id} type="button" aria-pressed={server === option.id} onClick={() => selectServer(option.id)}><Server size={16} /><span>{option.label}</span><Badge variant="outline">{server === option.id ? "Selected" : option.description}</Badge></button>)}</div></section><div className="watch-footer"><span><strong>Playing from {serverLabel}</strong><small>{server === "vidlove" ? "VidLove seek controls and provider download options are enabled." : "Provider controls are available inside the player."}</small></span><a className={buttonVariants({ variant: "outline", size: "sm" })} href={embedUrl ?? "https://player.vidlove.cc/"} target="_blank" rel="noreferrer">Open externally <ExternalLink size={14} /></a></div></div></div>
}

function WatchPartyPage() {
  if (!isConvexConfigured) return <WatchPartyUnavailable />
  return <LiveWatchPartyLobby />
}

function WatchPartyUnavailable() {
  return <div className="mobile-page watchparty-page"><div className="mobile-page-heading"><div><p className="page-kicker">Together</p><h1>Watchparty</h1></div><Badge variant="outline">Offline</Badge></div><EmptyState title="Convex is required" copy="Add VITE_CONVEX_URL to enable room creation, realtime chat, and playback sync." action={<Link className={buttonVariants({ variant: "outline" })} to="/">Back to discover</Link>} /></div>
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
  const [seasonNumber, setSeasonNumber] = useState(1)
  const [episodeNumber, setEpisodeNumber] = useState(1)
  const [joinInput, setJoinInput] = useState("")
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!selectedTitle || selectedTitle.mediaType !== "tv") {
      setSeason(null)
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
    getSeason(selectedTitle.tmdbId, seasonNumber).then((result) => {
      if (!live) return
      setSeason(result ?? null)
      setEpisodeNumber(result?.episodes[0]?.episodeNumber ?? 1)
    }).catch(() => { if (live) setSeason(null) })
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
  return <div className="mobile-page watchparty-page"><div className="mobile-page-heading"><div><p className="page-kicker">Together</p><h1>Watchparty</h1></div><Badge variant="outline"><UsersRound size={13} /> Realtime</Badge></div><p className="watchparty-intro">Create a private room, share the link, and watch with a synchronized room state.</p>{error && <InlineError message={error} onRetry={() => setError("")} />}<Card className="party-card"><CardHeader><CardTitle><UsersRound size={18} /> Your temporary identity</CardTitle></CardHeader><CardContent><label className="party-field"><span>Username</span><Input value={usernameInput} onChange={(event) => setUsernameInput(event.target.value)} maxLength={32} placeholder="Guest" /></label><div className="party-identity-id">userid <code>{identity.userId.slice(0, 12)}…</code><span>stored on this device</span></div><Button variant="outline" onClick={saveIdentity}>Save identity</Button></CardContent></Card><Card className="party-card"><CardHeader><CardTitle><Search size={18} /> Choose something to watch</CardTitle></CardHeader><CardContent><form className="party-search-form" onSubmit={submitSearch}><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search TMDB…" aria-label="Search TMDB catalog" /><Button type="submit" disabled={loadingSearch}>{loadingSearch ? "Searching…" : "Search"}</Button></form>{results.length > 0 && <div className="party-search-results">{results.map((item) => <button className={cn("party-media-option", selectedTitle?.tmdbId === item.tmdbId && selectedTitle.mediaType === item.mediaType && "selected")} type="button" key={`${item.mediaType}-${item.tmdbId}`} onClick={() => setSelectedTitle(item)}><Poster item={item} /><span><strong>{item.title}</strong><small>{item.mediaType === "tv" ? "Series" : "Movie"} · {formatYear(item.releaseDate)}</small></span><Check size={16} /></button>)}</div>}{selectedTitle && <div className="party-selection"><Poster item={selectedTitle} /><div><p className="section-label">Selected title</p><strong>{selectedTitle.title}</strong><span>{selectedTitle.mediaType === "tv" ? "Series" : "Movie"} · {formatYear(selectedTitle.releaseDate)}</span></div></div>}{selectedTitle?.mediaType === "tv" && <div className="party-episode-selectors"><label className="party-field"><span>Season</span><select value={seasonNumber} onChange={(event) => setSeasonNumber(Number(event.target.value))}>{selectedTitle.seasons?.map((item) => <option value={item.seasonNumber} key={item.seasonNumber}>{item.name}</option>)}</select></label><label className="party-field"><span>Episode</span><select value={episodeNumber} onChange={(event) => setEpisodeNumber(Number(event.target.value))}>{season?.episodes.map((item) => <option value={item.episodeNumber} key={item.episodeNumber}>{String(item.episodeNumber).padStart(2, "0")} · {item.name}</option>)}</select></label></div>}{selectedEpisode && <p className="party-selection-note">Starting with episode {String(selectedEpisode.episodeNumber).padStart(2, "0")} · {selectedEpisode.name}</p>}<Button className="party-create-button" onClick={handleCreateRoom} disabled={!selectedTitle || creating}><Radio size={16} /> {creating ? "Creating room…" : "Create room"}</Button></CardContent></Card><Card className="party-card"><CardHeader><CardTitle><MessageCircle size={18} /> Join a room</CardTitle></CardHeader><CardContent><form className="party-search-form" onSubmit={handleJoin}><Input value={joinInput} onChange={(event) => setJoinInput(event.target.value)} placeholder="Paste a room link or room id" aria-label="Room link or room id" /><Button type="submit" variant="outline">Join</Button></form><p className="party-help">Your saved temporary identity will be used when you join.</p></CardContent></Card></div>
}

function WatchPartyRoomPage() {
  const { roomId } = useParams()
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

  if (roomData === undefined) return <div className="mobile-page watchparty-page"><Skeleton className="party-room-skeleton" /></div>
  if (roomData === null) return <div className="mobile-page watchparty-page"><EmptyState title="Room unavailable" copy="This room may have expired or the link may be invalid." action={<Link className={buttonVariants()} to="/watchparty">Create or join another room</Link>} /></div>

  const room = roomData.room
  const playback = roomData.playback
  const position = playback ? Math.max(0, playback.positionSeconds + (playback.isPlaying ? (now - playback.positionUpdatedAt) / 1000 : 0)) : 0
  const displayTitle = title?.title ?? (room.mediaType === "tv" ? `Series ${room.tmdbId}` : `Movie ${room.tmdbId}`)
  const embedUrl = buildVideoEmbedUrl({ server: room.server, title: { tmdbId: room.tmdbId, imdbId: room.imdbId }, mediaType: room.mediaType, seasonNumber: room.seasonNumber, episodeNumber: room.episodeNumber })
  const serverLabel = VIDEO_SERVERS.find((option) => option.id === room.server)?.label ?? room.server
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

  async function handleMessage(event: FormEvent) {
    event.preventDefault()
    const body = messageInput.trim()
    if (!body) return
    try {
      await sendMessage({ roomId, userId: identity.userId, username: identity.username, body })
      setMessageInput("")
    } catch (reason) { setError(String(reason)) }
  }

  return <div className="mobile-page watchparty-page"><div className="party-room-topbar"><Link className="back-link" to="/watchparty"><ArrowLeft size={17} /> Watchparty</Link><div className="party-room-actions"><Button variant="ghost" size="icon" aria-label="Copy room link" onClick={copyRoomLink}><Copy size={17} /></Button><Button variant="ghost" size="icon" aria-label="Share room" onClick={shareRoom}><Share2 size={17} /></Button></div></div><div className="party-room-heading"><div><p className="page-kicker">Room</p><h1>{displayTitle}</h1><p>{room.mediaType === "tv" ? `Season ${room.seasonNumber} · Episode ${room.episodeNumber}` : "Movie"}</p></div><Badge variant={isHost ? "default" : "outline"}>{isHost ? "Host" : "Guest"}</Badge></div>{error && <InlineError message={error} onRetry={() => setError("")} />}<section className="party-player" aria-label="Watchparty video"><div className="party-player-frame">{embedUrl ? <iframe ref={iframeRef} title={`${serverLabel} player for ${displayTitle}`} src={embedUrl} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setEmbedLoaded(true)} /> : <div className="party-player-empty">This provider needs a valid season and episode.</div>}<span className="party-player-status">{embedLoaded ? serverLabel : "Loading player"}</span></div><div className="party-playback-controls"><Button onClick={togglePlayback} disabled={!playback}><span className="party-control-icon">{playback?.isPlaying ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</span>{playback?.isPlaying ? "Pause for everyone" : "Play for everyone"}</Button><div className="party-sync-status" aria-live="polite">{syncStatus}<small>{Math.floor(position / 60)}:{String(Math.floor(position % 60)).padStart(2, "0")} · revision {playback?.revision ?? 0}</small></div></div></section><section className="party-server-section"><div className="party-section-heading"><div><p className="section-label">Playback source</p><h2>Server</h2></div><Badge variant="outline">{isHost ? "Host controlled" : "Read only"}</Badge></div><div className="party-server-options">{VIDEO_SERVERS.map((option) => <button className={cn("party-server-option", room.server === option.id && "selected")} type="button" key={option.id} disabled={!isHost || room.server === option.id} onClick={() => setServer({ roomId, hostTokenHash: tokenHash, server: option.id }).catch((reason) => setError(String(reason)))}><Server size={15} /><span>{option.label}</span>{room.server === option.id && <Check size={15} />}</button>)}</div></section>{!isHost && !hostIsPresent && <Button className="party-claim-host" variant="outline" onClick={handleClaimHost}>Claim host after inactivity</Button>}<section className="party-chat"><div className="party-section-heading"><div><p className="section-label">Room chat</p><h2><MessageCircle size={17} /> Chat</h2></div><Badge variant="outline"><Users size={13} /> {roomData.members.length}</Badge></div><div className="party-message-list" aria-live="polite">{messages.length ? messages.map((message) => <article className={cn("party-message", message.userId === identity.userId && "own")} key={`${message.userId}-${message.createdAt}`}><strong>{message.username}</strong><p>{message.body}</p></article>) : <p className="party-empty-chat">Say hello when everyone is in.</p>}</div><form className="party-composer" onSubmit={handleMessage}><Input value={messageInput} onChange={(event) => setMessageInput(event.target.value)} maxLength={500} placeholder={`Message as ${identity.username}`} aria-label="Chat message" /><Button size="icon" type="submit" aria-label="Send message"><Send size={17} /></Button></form></section><p className="party-disclaimer">Room state is synced through Convex. These cross-origin providers may ignore parent-page playback commands; MovieLand reports the request without claiming the iframe changed.</p></div>
}

function MediaRail({ rail }: { rail: CatalogRail }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollRail = (direction: number) => trackRef.current?.scrollBy({ left: direction * 260, behavior: "smooth" })
  return <section className="media-rail" id={rail.key === "continue" ? "my-list" : undefined}><div className="section-header"><div><h2>{rail.label}</h2><p className="section-caption">{rail.items.length} titles</p></div><div className="section-actions"><Link className="section-link" to={rail.href ?? `/browse/${rail.key}`}>View all</Link><div className="rail-controls"><Button variant="ghost" size="icon" aria-label={`Scroll ${rail.label} left`} onClick={() => scrollRail(-1)}><ChevronLeft size={18} /></Button><Button variant="ghost" size="icon" aria-label={`Scroll ${rail.label} right`} onClick={() => scrollRail(1)}><ChevronRight size={18} /></Button></div></div></div><div className="rail-track" ref={trackRef}>{rail.items.map((item) => <PosterCard item={item} key={`${item.mediaType}-${item.tmdbId}`} />)}</div></section>
}

function GenreRailsSection({ rails }: { rails: GenreRailsResponse["rails"] }) {
  return <section className="genre-collection" aria-labelledby="genres-heading"><div className="genre-collection-heading"><p className="section-label">Browse by</p><h2 id="genres-heading">Genres</h2></div>{rails.map((rail) => <MediaRail key={rail.key} rail={rail} />)}</section>
}

function RecommendationSection({ items }: { items: MediaRecommendation[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  return <section className="detail-section recommendation-section"><SectionHeading eyebrow="Because you watched this" title="You might like" count={`${items.length}`} /><div className="rail-track" ref={trackRef}>{items.map((item) => <PosterCard item={item} key={`${item.mediaType}-${item.tmdbId}`} />)}</div></section>
}

function PosterGrid({ items }: { items: PosterItem[] }) { return <div className="poster-grid">{items.map((item) => <PosterCard item={item} key={`${item.mediaType}-${item.tmdbId}`} />)}</div> }
function PosterCard({ item }: { item: PosterItem }) { return <Link className="poster-card" aria-label={`Open ${item.title}`} to={`/${item.mediaType === "tv" ? "series" : "movie"}/${item.tmdbId}`}><Poster item={item} /><div className="poster-card-copy"><strong>{item.title}</strong><div className="poster-card-meta"><span>{formatYear(item.releaseDate)}</span><i>·</i><span>{item.mediaType === "tv" ? "Series" : "Movie"}</span><i>·</i><span className="rating"><Star size={10} fill="currentColor" /> {item.rating?.toFixed(1) ?? "—"}</span></div></div></Link> }
function Poster({ item, size = "regular" }: { item: PosterItem; size?: "regular" | "large" }) { const [failed, setFailed] = useState(false); const image = tmdbImageUrl(item.posterPath, size === "large" ? "w780" : "w500"); return <div className={cn("poster", size === "large" && "poster-large", failed && "poster-failed")} style={{ background: failed || !image ? "#252a31" : undefined }}>{image && !failed && <img src={image} alt={`${item.title} poster`} onError={() => setFailed(true)} />}{failed && <span>{item.title}</span>}</div> }
function SectionHeading({ eyebrow, title, count }: { eyebrow?: string; title: string; count?: string }) { return <div className="section-heading"><div>{eyebrow && <p className="section-label">{eyebrow}</p>}<h2>{title}</h2></div>{count && <span className="section-count">{count}</span>}</div> }
function positiveParam(value: string | null, fallback: number) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : fallback }
function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) { return <Card className="state-box error-state" role="alert"><CardHeader><CardTitle>Live catalog unavailable</CardTitle></CardHeader><CardContent><span>{message}</span><Button variant="outline" onClick={onRetry}>Try again</Button></CardContent></Card> }
function EmptyState({ title, copy, action }: { title: string; copy: string; action: ReactNode }) { return <Card className="state-box empty-state"><CardContent><Film size={24} /><strong>{title}</strong><span>{copy}</span>{action}</CardContent></Card> }
function SearchPrompt() { return <Card className="search-prompt"><CardContent><Search size={26} /><h2>Search the catalog</h2><p>Look for a movie, series, person, or genre.</p></CardContent></Card> }
function MobileDiscoverySkeleton() { return <><Skeleton className="skeleton-featured" />{[1, 2, 3, 4].map((row) => <section className="media-rail" key={row}><Skeleton className="skeleton-heading" /><div className="rail-track">{[1, 2, 3, 4].map((item) => <Skeleton className="skeleton-poster" key={item} />)}</div></section>)}</> }
function PosterGridSkeleton() { return <div className="poster-grid">{[1, 2, 3, 4, 5, 6].map((item) => <Skeleton className="skeleton-grid-poster" key={item} />)}</div> }
function DetailSkeleton() { return <div className="detail-hero"><Skeleton className="skeleton-detail-poster" /><div className="detail-copy"><Skeleton className="skeleton-line short" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /></div></div> }
function Footer() { return <footer className="mobile-footer"><span>Metadata by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a></span><span>IMDb IDs support playback</span></footer> }
function NotFound() { return <div className="mobile-page"><EmptyState title="Page not found" copy="That title or route is not available." action={<Link className={buttonVariants({ variant: "outline" })} to="/">Back to home</Link>} /></div> }

export default App
