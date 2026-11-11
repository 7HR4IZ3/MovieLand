import { useContext } from "react"
import { Link, useNavigate } from "react-router-dom"
import { CaretDownIcon, CaretRightIcon, CheckIcon, PlayIcon } from "@phosphor-icons/react"
import { Button } from "./ui/button"
import { SafeImage } from "./media"
import { EpisodeListSkeleton } from "./states"
import { EnhancedContext } from "../lib/app-context"
import type { MediaTitle, Season } from "../lib/types"
import { cn, formatRuntime, tmdbImageUrl } from "../lib/utils"
import type { VideoServer } from "../lib/video"

type EpisodeBrowserProps = {
  title: MediaTitle
  season: Season | null
  loading?: boolean
  seasonNumber: number
  episodeNumber: number
  onSeasonChange?: (season: number) => void
  /** Set when the URL names a server explicitly, so episode links keep it. */
  server?: VideoServer
  watchMode?: boolean
}

export function EpisodeBrowser({ title, season, loading = false, seasonNumber, episodeNumber, onSeasonChange, server, watchMode = false }: EpisodeBrowserProps) {
  const navigate = useNavigate()
  const enhanced = useContext(EnhancedContext)
  const episodePath = (nextSeason: number, nextEpisode: number) => `/watch/series/${title.tmdbId}?season=${nextSeason}&episode=${nextEpisode}${server ? `&server=${server}` : ""}`
  const changeSeason = (nextSeason: number) => watchMode ? navigate(episodePath(nextSeason, 1)) : onSeasonChange?.(nextSeason)
  const seasons = title.seasons ?? []

  return <section className="episodes" aria-busy={loading} aria-label="Episodes">
    {seasons.length > 1 && <form method="get" className="season-form">
      {watchMode && <input type="hidden" name="episode" value="1" />}
      {watchMode && server && <input type="hidden" name="server" value={server} />}
      <label className="select"><span className="sr-only">Season</span>
        <select name="season" value={seasonNumber} onChange={(event) => changeSeason(Number(event.target.value))} disabled={loading}>{seasons.map((item) => <option key={item.seasonNumber} value={item.seasonNumber}>{item.name}</option>)}</select>
        <CaretDownIcon size={14} aria-hidden="true" />
      </label>
      {/* Without scripts the select cannot navigate by itself. */}
      {!enhanced && <Button type="submit" size="icon" aria-label="Apply season" title="Apply"><CheckIcon /></Button>}
    </form>}
    {loading ? <EpisodeListSkeleton /> : !season ? <p className="muted-note">Episodes are unavailable right now.</p> : <>
      <div className="episode-list">
        {season.episodes.map((item) => {
          const current = watchMode && episodeNumber === item.episodeNumber
          return <Link className={cn("episode", current && "selected")} key={item.id} to={episodePath(seasonNumber, item.episodeNumber)} aria-current={current ? "true" : undefined}>
            <span className="episode-thumb"><PlayIcon size={16} weight="fill" aria-hidden="true" /><SafeImage loading="lazy" src={tmdbImageUrl(item.stillPath, "w342")} /><b>{item.episodeNumber}</b></span>
            <span className="episode-name">{item.name}</span>
            {item.runtime ? <span className="episode-runtime">{formatRuntime(item.runtime)}</span> : null}
            <CaretRightIcon size={16} aria-hidden="true" />
          </Link>
        })}
      </div>
    </>}
  </section>
}
