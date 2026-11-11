import { useContext, useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeftIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon, CheckIcon } from "@phosphor-icons/react"
import { AdMobBanner } from "../components/AdMobBanner"
import { AdMobNativeAdvanced } from "../components/AdMobNativeAdvanced"
import { Hero, PosterGrid, Rail } from "../components/media"
import { HeroSkeleton, InlineError, PosterGridSkeleton, RailSkeleton } from "../components/states"
import { buttonVariants, Button } from "../components/ui/button"
import { CatalogDataContext, EnhancedContext } from "../lib/app-context"
import { getBrowse, getDiscover, getGenreRails } from "../lib/catalog"
import type { BrowseResponse, CatalogRail, GenreRailsResponse, MediaTitle } from "../lib/types"
import { positiveParam } from "../lib/utils"

export function DiscoverPage() {
  const serverData = useContext(CatalogDataContext)
  const [state, setState] = useState<{ rails: CatalogRail[] } | null>(serverData.discover ?? null)
  const [genres, setGenres] = useState<GenreRailsResponse | null>(serverData.genres ?? null)
  const [genresLoading, setGenresLoading] = useState(Boolean(serverData.discover && !serverData.genres))
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (serverData.discover && attempt === 0) return
    let live = true
    setFailed(false)
    getDiscover().then((result) => { if (live) setState(result) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [serverData.discover, attempt])

  // Genre rails are secondary, so they load after the primary rails and never block them.
  useEffect(() => {
    if (!state || genres) return
    let live = true
    setGenresLoading(true)
    getGenreRails().then((result) => { if (live) setGenres(result) }).catch(() => undefined).finally(() => { if (live) setGenresLoading(false) })
    return () => { live = false }
  }, [state, genres])

  const featured = state?.rails[0]?.items[0]
  if (failed && !state) return <div className="page"><InlineError onRetry={() => setAttempt((value) => value + 1)} /></div>
  if (!state) return <div className="page-flush"><HeroSkeleton /><RailSkeleton /></div>
  return <div className="page-flush">
    {featured && <Hero item={featured} />}
    <AdMobBanner />
    <AdMobNativeAdvanced />
    <div className="rails">
      {state.rails.map((rail) => <Rail key={rail.key} rail={rail} />)}
      {genres?.rails.map((rail) => <Rail key={rail.key} rail={rail} />)}
      {genresLoading && <RailSkeleton rows={2} />}
    </div>
  </div>
}

export function BrowsePage() {
  const serverData = useContext(CatalogDataContext)
  const enhanced = useContext(EnhancedContext)
  const { category = "", genreSlug } = useParams()
  const [params, setParams] = useSearchParams()
  const browseCategory = genreSlug ? `genre-${genreSlug}` : category
  const thisYear = new Date().getFullYear()
  const year = positiveParam(params.get("year"), thisYear)
  const page = positiveParam(params.get("page"), 1)
  const [state, setState] = useState<BrowseResponse | null>(serverData.browse ?? null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (serverData.browse && attempt === 0) return
    let live = true
    setState(null)
    setFailed(false)
    getBrowse(browseCategory, { page, year: browseCategory === "top-250-movies" ? year : undefined, genreSlug }).then((result) => { if (live) setState(result) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [browseCategory, genreSlug, year, page, serverData.browse, attempt])

  const pageLink = (target: number) => { const next = new URLSearchParams(params); next.set("page", String(target)); return `?${next}` }
  function changeYear(value: string) {
    const next = new URLSearchParams(params)
    next.set("year", value)
    next.delete("page")
    setParams(next)
  }
  const years = Array.from({ length: Math.max(1, thisYear - 1949) }, (_, index) => thisYear - index)

  return <div className="page" aria-busy={!state && !failed}>
    <div className="page-top">
      <Link className={buttonVariants({ variant: "soft", size: "icon" })} to="/" aria-label="Back" title="Back"><ArrowLeftIcon /></Link>
      {state && <h1 className="page-title">{state.label}</h1>}
      {browseCategory === "top-250-movies" && <form method="get" className="season-form push">
        <label className="select"><span className="sr-only">Year</span>
          <select name="year" value={year} onChange={(event) => changeYear(event.target.value)}>{years.map((value) => <option value={value} key={value}>{value}</option>)}</select>
          <CaretDownIcon size={14} aria-hidden="true" />
        </label>
        {!enhanced && <Button type="submit" size="icon" aria-label="Apply year" title="Apply"><CheckIcon /></Button>}
      </form>}
    </div>
    {failed ? <InlineError onRetry={() => setAttempt((value) => value + 1)} /> : !state ? <PosterGridSkeleton /> : <>
      <PosterGrid items={state.items as MediaTitle[]} />
      <nav className="pager" aria-label="Pages">
        {page > 1 && <Link className={buttonVariants({ variant: "soft", size: "icon" })} to={pageLink(page - 1)} aria-label="Previous page" title="Previous"><CaretLeftIcon /></Link>}
        {state.page < state.totalPages && <Link className={buttonVariants({ variant: "soft", size: "icon" })} to={pageLink(state.page + 1)} aria-label="Next page" title="Next"><CaretRightIcon /></Link>}
      </nav>
    </>}
  </div>
}
