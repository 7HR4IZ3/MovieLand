import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core"

export type NativeDownloadStatus = "queued" | "downloading" | "paused" | "finished" | "failed"

export type NativeDownloadProgress = {
  id: string
  status: NativeDownloadStatus
  bytesDownloaded: number
  totalBytes: number
  speedBytesPerSecond: number
  localPath?: string
  error?: string
}

type NativeDownloadOptions = {
  id: string
  url: string
  fileName: string
}

type MovieLandDownloadPlugin = {
  start(options: NativeDownloadOptions): Promise<NativeDownloadProgress>
  pause(options: { id: string }): Promise<NativeDownloadProgress>
  resume(options: { id: string }): Promise<NativeDownloadProgress>
  remove(options: { id: string }): Promise<void>
  list(): Promise<{ items: NativeDownloadProgress[] }>
  addListener(eventName: "downloadProgress", listener: (progress: NativeDownloadProgress) => void): Promise<PluginListenerHandle>
}

const plugin = registerPlugin<MovieLandDownloadPlugin>("MovieLandDownload")

export const isNativeDownloadAvailable = Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("MovieLandDownload")

export async function startNativeDownload(options: NativeDownloadOptions) {
  if (!isNativeDownloadAvailable) throw new Error("Native downloads are available in the iOS app")
  return plugin.start(options)
}

export async function pauseNativeDownload(id: string) {
  if (!isNativeDownloadAvailable) throw new Error("Native downloads are available in the iOS app")
  return plugin.pause({ id })
}

export async function resumeNativeDownload(id: string) {
  if (!isNativeDownloadAvailable) throw new Error("Native downloads are available in the iOS app")
  return plugin.resume({ id })
}

export async function removeNativeDownload(id: string) {
  if (!isNativeDownloadAvailable) return
  await plugin.remove({ id })
}

export async function listNativeDownloads(): Promise<NativeDownloadProgress[]> {
  if (!isNativeDownloadAvailable) return []
  try {
    return (await plugin.list()).items ?? []
  } catch {
    return []
  }
}

export async function subscribeNativeDownloadProgress(listener: (progress: NativeDownloadProgress) => void) {
  if (!isNativeDownloadAvailable) return () => undefined
  try {
    const handle = await plugin.addListener("downloadProgress", listener)
    return () => { void handle.remove() }
  } catch {
    return () => undefined
  }
}
