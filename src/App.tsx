import { useEffect, useRef, useState } from "react"
import { Link, Route, Routes, useLocation } from "react-router-dom"
import { DownloadSimpleIcon, HeartIcon, HouseIcon, IconContext, InfoIcon, MagnifyingGlassIcon, UsersThreeIcon } from "@phosphor-icons/react"
import { AdMobLifecycle } from "./components/AdMobLifecycle"
import { NotFound } from "./components/states"
import { CatalogDataContext, EnhancedContext } from "./lib/app-context"
import type { ServerCatalogData } from "./lib/catalog-data"
import { maybeShowMovieLandInterstitial } from "./lib/admob"
import { cn } from "./lib/utils"
import { BrowsePage, DiscoverPage } from "./pages/discover"
import { DetailPage } from "./pages/detail"
import { DownloadsPage, MyListPage } from "./pages/library"
import { WatchPartyPage, WatchPartyRoomPage } from "./pages/party"
import { PrivacyPolicyPage } from "./pages/privacy"
import { SearchPage } from "./pages/search"
import { WatchPage } from "./pages/watch"

const NO_DATA: ServerCatalogData = {}

export function AppWithCatalogData({ data }: { data: ServerCatalogData }) {
  const location = useLocation()
  const route = location.pathname + location.search
  const initialRoute = useRef(route)
  const departed = useRef(false)
  const [enhanced, setEnhanced] = useState(false)
  useEffect(() => setEnhanced(true), [])
  // Server-rendered data describes the first route only; once the user leaves it, it is stale.
  if (route !== initialRoute.current) departed.current = true
  return <EnhancedContext.Provider value={enhanced}>
    <CatalogDataContext.Provider value={departed.current ? NO_DATA : data}>
      <IconContext.Provider value={{ weight: "regular", size: 22, "aria-hidden": true }}><App /></IconContext.Provider>
    </CatalogDataContext.Provider>
  </EnhancedContext.Provider>
}

function App() {
  const location = useLocation()
  const previousPath = useRef<string | null>(null)

  useEffect(() => {
    const previous = previousPath.current
    previousPath.current = location.pathname
    if (previous === null || previous === location.pathname) return
    window.scrollTo({ top: 0 })
    if (!/^\/(movie|series)\//.test(location.pathname)) return
    const timer = window.setTimeout(() => { void maybeShowMovieLandInterstitial() }, 700)
    return () => window.clearTimeout(timer)
  }, [location.pathname])

  const immersive = location.pathname.startsWith("/watch/") || /^\/watchparty\/.+/.test(location.pathname)
  const routes = <Routes key={location.pathname}>
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

  return <>
    <AdMobLifecycle />
    <div className={cn("shell", immersive && "immersive")}>
      {!immersive && <Dock />}
      <main className="main">{routes}{!immersive && <Footer />}</main>
    </div>
  </>
}

const TABS = [
  { to: "/", label: "Home", icon: HouseIcon, match: (path: string) => path === "/" },
  { to: "/search", label: "Search", icon: MagnifyingGlassIcon, match: (path: string) => path.startsWith("/search") || path.startsWith("/browse/") },
  { to: "/my-list", label: "My list", icon: HeartIcon, match: (path: string) => path.startsWith("/my-list") },
  { to: "/downloads", label: "Downloads", icon: DownloadSimpleIcon, match: (path: string) => path.startsWith("/downloads") },
  { to: "/watchparty", label: "Watchparty", icon: UsersThreeIcon, match: (path: string) => path.startsWith("/watchparty") },
]

function Dock() {
  const { pathname } = useLocation()
  return <nav className="dock" aria-label="Primary">
    {TABS.map(({ to, label, icon: Icon, match }) => {
      const active = match(pathname)
      return <Link key={to} className={cn("dock-link", active && "active")} to={to} aria-label={label} title={label} aria-current={active ? "page" : undefined}><Icon weight={active ? "fill" : "regular"} /></Link>
    })}
  </nav>
}

function Footer() {
  return <footer className="footer">
    <span>Metadata by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a></span>
    <Link to="/privacy" aria-label="Privacy policy" title="Privacy policy"><InfoIcon size={18} /></Link>
  </footer>
}

export default App
