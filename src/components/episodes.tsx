import { Link } from "react-router-dom"
import { CheckIcon, PlayIcon } from "@phosphor-icons/react"
import { SafeImage } from "./media"
import { EpisodeListSkeleton } from "./states"
import { episodeKey } from "../lib/local-state"
import type { MediaTitle, Season } from "../lib/types"
import { cn, formatRuntime, tmdbImageUrl } from "../lib/utils"
import type { VideoServer } from "../lib/video"

type EpisodeBrowserProps = {
  title: MediaTitle
  season: Season | null
  loading?: boolean
  seasonNumber: number
  /** Episode currently playing; omit on the details page. */
  episodeNumber?: number
  /** Set when the URL names a server explicitly, so links keep it. */
  server?: VideoServer
  /** Episodes already opened on this device. */
  seen?: Set<string>
  watchMode?: boolean
}

export function watchEpisodePath(tmdbId: number, seasonNumber: number, episodeNumber: number, server?: VideoServer) {
  return `/watch/series/${tmdbId}?season=${seasonNumber}&episode=${episodeNumber}${server ? `&server=${server}` : ""}`
}

/**
 * Season chips and episode rows. Everything is a plain link, so switching
 * season or episode works without client scripts.
 */
export function EpisodeBrowser({ title, season, loading = false, seasonNumber, episodeNumber, server, seen, watchMode = false }: EpisodeBrowserProps) {
  const seasons = title.seasons ?? []
  const seasonLink = (next: number) => watchMode ? watchEpisodePath(title.tmdbId, next, 1, server) : `?season=${next}`

  return <section className={cn("episodes", watchMode && "episodes-watch")} aria-busy={loading} aria-label="Episodes">
    {seasons.length > 1 && <nav className="seasons" aria-label="Seasons">
      {seasons.map((item) => {
        const active = item.seasonNumber === seasonNumber
        return <Link key={item.seasonNumber} className={cn("season-chip", active && "active")} to={seasonLink(item.seasonNumber)} replace={!watchMode} aria-label={item.name} title={item.name} aria-current={active ? "true" : undefined}>{item.seasonNumber === 0 ? "SP" : item.seasonNumber}</Link>
      })}
    </nav>}
    {loading ? <EpisodeListSkeleton /> : !season ? <p className="muted-note">Episodes are unavailable right now.</p> :
      <div className="episode-list">
        {season.episodes.map((item) => {
          const current = watchMode && episodeNumber === item.episodeNumber
          const watched = !current && seen?.has(episodeKey(seasonNumber, item.episodeNumber))
          return <Link className={cn("episode", current && "selected", watched && "seen")} key={item.id} to={watchEpisodePath(title.tmdbId, seasonNumber, item.episodeNumber, server)} aria-current={current ? "true" : undefined}>
            <span className="episode-thumb">
              <PlayIcon size={16} weight="fill" aria-hidden="true" />
              <SafeImage loading="lazy" src={tmdbImageUrl(item.stillPath, "w342")} />
              <b>{item.episodeNumber}</b>
              {current && <span className="eq" aria-label="Playing"><i /><i /><i /></span>}
            </span>
            <span className="episode-name">{item.name}{item.runtime ? <small>{formatRuntime(item.runtime)}</small> : null}</span>
            {watched && <CheckIcon className="episode-seen" size={16} aria-label="Watched" />}
          </Link>
        })}
      </div>}
  </section>
}
