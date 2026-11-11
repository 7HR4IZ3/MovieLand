import { useContext, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { CheckCircleIcon, DownloadSimpleIcon, HeartIcon, PauseIcon, PlayIcon, TrashIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { PosterGrid } from "../components/media"
import { EmptyState, HomeLink, InlineError, PosterGridSkeleton, ScriptRequired } from "../components/states"
import { Button, buttonVariants } from "../components/ui/button"
import { EnhancedContext } from "../lib/app-context"
import { getTitle } from "../lib/catalog"
import { isConvexConfigured } from "../lib/convex"
import { clearProviderDownloads, openProviderDownload, removeProviderDownload } from "../lib/download-service"
import { useDownloads, useMyList, type DownloadItem } from "../lib/local-state"
import { pauseNativeDownload, removeNativeDownload, resumeNativeDownload, startNativeDownload } from "../lib/native-download"
import type { MediaTitle } from "../lib/types"
import { cn, downloadFileName, formatBytes } from "../lib/utils"

export function MyListPage() {
  const enhanced = useContext(EnhancedContext)
  const { entries, loaded } = useMyList()
  const [items, setItems] = useState<MediaTitle[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!loaded) return
    let live = true
    setFailed(false)
    Promise.all(entries.map((entry) => getTitle(entry.mediaType, entry.tmdbId).catch(() => undefined)))
      .then((results) => { if (live) setItems(results.filter((item): item is MediaTitle => Boolean(item))) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [entries, loaded, attempt])

  if (!enhanced) return <ScriptRequired title="My list" copy="Enable JavaScript to access titles saved on this device." />
  return <div className="page">
    {failed ? <InlineError onRetry={() => setAttempt((value) => value + 1)} />
      : items === null ? <PosterGridSkeleton />
      : items.length ? <PosterGrid items={items} />
      : <EmptyState icon={<HeartIcon size={44} weight="thin" />} label="Your list is empty" action={<HomeLink />} />}
  </div>
}

function statusIcon(item: DownloadItem) {
  if (item.status === "failed") return <WarningCircleIcon className="dl-status bad" size={18} aria-label="Unavailable" />
  if (["completed", "opened", "ready"].includes(item.status)) return <CheckCircleIcon className="dl-status good" size={18} weight="fill" aria-label="Ready" />
  if (item.status === "paused") return <PauseIcon className="dl-status" size={18} aria-label="Paused" />
  return <DownloadSimpleIcon className="dl-status" size={18} aria-label="In progress" />
}

export function DownloadsPage() {
  const enhanced = useContext(EnhancedContext)
  const { items, syncError, clearDownloads, removeDownload, updateDownload } = useDownloads()
  const [notice, setNotice] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  async function controlDownload(item: DownloadItem) {
    if (busyId) return
    setNotice("")
    if (item.engine === "browser" && item.remoteId) {
      // Reserve a tab during the click so the async link refresh is not blocked.
      const tab = window.open("about:blank", "_blank")
      if (!tab) { setNotice("Allow a new tab to open the download."); return }
      tab.opener = null
      setBusyId(item.id)
      try {
        const file = await openProviderDownload(item.remoteId)
        tab.location.replace(file.url)
        updateDownload(item.id, { status: "opened", error: undefined })
      } catch (error) {
        tab.close()
        setNotice(error instanceof Error ? error.message : "Download unavailable")
      } finally { setBusyId(null) }
      return
    }
    if (item.engine !== "native" || item.sourceType !== "direct") { setNotice("Download unavailable."); return }
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
  return <div className="page narrow">
    {(notice || syncError) && <p className="watch-notice error" role="status">{notice || syncError}</p>}
    {!items.length ? <EmptyState icon={<DownloadSimpleIcon size={44} weight="thin" />} label="No downloads yet" action={<Link className={buttonVariants({ variant: "soft", size: "icon" })} to="/" aria-label="Browse titles" title="Browse"><PlayIcon /></Link>} /> : <>
      <div className="dl-toolbar"><Button variant="ghost" size="icon" aria-label="Clear all downloads" title="Clear all" disabled={Boolean(busyId)} onClick={clearAll}><TrashIcon /></Button></div>
      <ul className="dl-list" aria-label="Downloads">
        {items.map((item) => {
          const native = item.engine === "native"
          const progress = item.totalBytes > 0 ? Math.min(100, Math.round(item.bytesDownloaded / item.totalBytes * 100)) : 0
          const episode = item.mediaType === "tv" ? `S${String(item.seasonNumber ?? 1).padStart(2, "0")}E${String(item.episodeNumber ?? 1).padStart(2, "0")}` : null
          const canControl = item.engine === "browser" || (native && ["downloading", "paused", "failed"].includes(item.status))
          return <li className="dl" key={item.id}>
            {statusIcon(item)}
            <div className="dl-main">
              <strong>{item.title}{episode && <span> · {episode}</span>}</strong>
              {native && item.status !== "completed" && <div className="progress" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}
              {(item.error || (native && item.status === "downloading" && item.totalBytes > 0)) && <small className={cn(item.error && "bad")}>{item.error ?? `${formatBytes(item.bytesDownloaded)} / ${formatBytes(item.totalBytes)}`}</small>}
            </div>
            {canControl && <Button variant="soft" size="icon" disabled={Boolean(busyId)} onClick={() => controlDownload(item)} aria-label={item.engine === "browser" ? "Open download" : item.status === "downloading" ? "Pause" : item.status === "paused" ? "Resume" : "Retry"} title={item.engine === "browser" ? "Open" : item.status === "downloading" ? "Pause" : "Resume"}>{item.engine === "browser" ? <DownloadSimpleIcon /> : item.status === "downloading" ? <PauseIcon /> : <PlayIcon />}</Button>}
            <Button variant="ghost" size="icon" disabled={Boolean(busyId)} aria-label={`Remove ${item.title}`} title="Remove" onClick={() => deleteDownload(item)}><TrashIcon size={18} /></Button>
          </li>
        })}
      </ul>
    </>}
  </div>
}

