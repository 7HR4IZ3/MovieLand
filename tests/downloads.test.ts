import { describe, expect, test } from "bun:test"
import { convexTest } from "convex-test"
import { api, internal } from "../convex/_generated/api"
import schema from "../convex/schema"
import type { Id } from "../convex/_generated/dataModel"
import { downloadKey, downloadOwnerHash, downloadFileName, validateDirectFileUrl } from "../convex/lib/downloads"
import { buildVideoEmbedUrl, isVideoServer, VIDEO_SERVERS } from "../src/lib/video"

const modules = {
  "../convex/_generated/server.js": () => import("../convex/_generated/server.js"),
  "../convex/downloads.ts": () => import("../convex/downloads"),
}
const ownerToken = "a".repeat(64)
const otherToken = "b".repeat(64)
const selection = { tmdbId: 27205, mediaType: "movie" as const }
const source = { ...selection, title: "Inception", fileName: "Inception.mp4", contentType: "video/mp4" as const, fileUrl: "https://downloads.example.com/inception.mp4", enabled: true }
const backend = () => convexTest(schema, modules)

async function prepare(t: ReturnType<typeof backend>, token = ownerToken) {
  await t.mutation(internal.downloads.registerSource, source)
  const result = await t.mutation(api.downloads.request, { ...selection, ownerToken: token })
  if (!result.available) throw new Error("Expected available file")
  return result.item
}

describe("Convex direct downloads", () => {
  test("unavailable streams create no history", async () => {
    const t = backend()
    expect((await t.mutation(api.downloads.request, { ...selection, ownerToken })).available).toBe(false)
    expect(await t.query(api.downloads.list, { ownerToken })).toEqual([])
  })

  test("ready files have private history and accurately labeled handoffs", async () => {
    const t = backend()
    const item = await prepare(t)
    expect(item.status).toBe("ready")
    expect(await t.query(api.downloads.list, { ownerToken: otherToken })).toEqual([])
    expect(JSON.stringify(item)).not.toContain(ownerToken)
    expect(JSON.stringify(item)).not.toContain("fileUrl")
    expect(JSON.stringify(item)).not.toContain("ownerHash")
    expect(await t.mutation(api.downloads.open, { id: item.id, ownerToken })).toEqual({ available: true, url: source.fileUrl, fileName: source.fileName })
    expect((await t.query(api.downloads.list, { ownerToken }))[0].status).toBe("opened")
  })

  test("other devices cannot open or remove history", async () => {
    const t = backend()
    const item = await prepare(t)
    await expect(t.mutation(api.downloads.open, { id: item.id, ownerToken: otherToken })).rejects.toThrow("Download not found")
    await expect(t.mutation(api.downloads.remove, { id: item.id, ownerToken: otherToken })).rejects.toThrow("Download not found")
    expect(await t.query(api.downloads.list, { ownerToken })).toHaveLength(1)
  })

  test("repeat requests are deduplicated", async () => {
    const t = backend()
    const first = await prepare(t)
    const second = await t.mutation(api.downloads.request, { ...selection, ownerToken })
    expect(second.available && second.item.id).toBe(first.id)
    expect(await t.query(api.downloads.list, { ownerToken })).toHaveLength(1)
  })

  test("fresh URLs, revocation and expiry are checked at open time", async () => {
    const t = backend()
    const item = await prepare(t)
    const sourceId = await t.mutation(internal.downloads.registerSource, { ...source, fileUrl: "https://downloads.example.com/refreshed.mp4" })
    const link = await t.mutation(api.downloads.open, { id: item.id, ownerToken })
    expect(link.available && link.url).toBe("https://downloads.example.com/refreshed.mp4")
    await t.mutation(internal.downloads.registerSource, { ...source, enabled: false })
    expect((await t.mutation(api.downloads.open, { id: item.id, ownerToken })).available).toBe(false)
    await t.run(ctx => ctx.db.patch(sourceId, { enabled: true, expiresAt: Date.now() - 1000 }))
    expect((await t.mutation(api.downloads.request, { ...selection, ownerToken })).available).toBe(false)
    expect((await t.mutation(api.downloads.open, { id: item.id, ownerToken })).available).toBe(false)
  })

  test("Convex Storage works and deleted files become unavailable", async () => {
    const t = backend()
    const storageId = await t.run(ctx => ctx.storage.store(new Blob(["fixture"], { type: "video/mp4" })))
    // convex-test 0.0.60 omits contentType when storing a Blob. Add the
    // metadata real Convex uploads provide. This cast is fixture-only.
    await t.run(ctx => ctx.db.patch(storageId as unknown as Id<"downloadSources">, { contentType: "video/mp4" }))
    const { fileUrl: _, ...metadata } = source
    await t.mutation(internal.downloads.registerSource, { ...metadata, storageId })
    const result = await t.mutation(api.downloads.request, { ...selection, ownerToken })
    if (!result.available) throw new Error("Expected storage file")
    expect((await t.mutation(api.downloads.open, { id: result.item.id, ownerToken })).available).toBe(true)
    await t.run(ctx => ctx.storage.delete(storageId))
    expect((await t.mutation(api.downloads.open, { id: result.item.id, ownerToken })).available).toBe(false)
  })

  test("operator uploads are internal and unregistering invalidates history", async () => {
    const t = backend()
    expect(await t.mutation(internal.downloads.createUploadUrl, {})).toBeString()
    const item = await prepare(t)
    await t.mutation(internal.downloads.unregisterSource, selection)
    expect((await t.mutation(api.downloads.open, { id: item.id, ownerToken })).available).toBe(false)
  })

  test("unregister cannot delete a storage file shared by another source", async () => {
    const t = backend()
    const storageId = await t.run(ctx => ctx.storage.store(new Blob(["fixture"], { type: "video/mp4" })))
    await t.run(ctx => ctx.db.patch(storageId as unknown as Id<"downloadSources">, { contentType: "video/mp4" }))
    const { fileUrl: _, ...metadata } = source
    await t.mutation(internal.downloads.registerSource, { ...metadata, storageId })
    await t.mutation(internal.downloads.registerSource, { ...metadata, tmdbId: 1, storageId })
    await expect(t.mutation(internal.downloads.unregisterSource, { ...selection, deleteStoredFile: true })).rejects.toThrow("shared")
    await t.mutation(internal.downloads.unregisterSource, { tmdbId: 1, mediaType: "movie" })
    await t.mutation(internal.downloads.unregisterSource, { ...selection, deleteStoredFile: true })
    expect(await t.run(ctx => ctx.storage.get(storageId))).toBeNull()
  })

  test("HTML storage, multiple sources and playlists are rejected", async () => {
    const t = backend()
    const storageId = await t.run(ctx => ctx.storage.store(new Blob(["<html/>"], { type: "text/html" })))
    const { fileUrl: _, ...metadata } = source
    await expect(t.mutation(internal.downloads.registerSource, { ...metadata, storageId })).rejects.toThrow("matching content type")
    await expect(t.mutation(internal.downloads.registerSource, { ...source, storageId })).rejects.toThrow("Choose one")
    await expect(t.mutation(internal.downloads.registerSource, { ...source, fileUrl: "https://downloads.example.com/movie.m3u8" })).rejects.toThrow("playlist")
  })

  test("episode selection is exact and validates positive integers", async () => {
    const t = backend()
    const episode = { tmdbId: 1399, mediaType: "tv" as const, seasonNumber: 1, episodeNumber: 2 }
    await t.mutation(internal.downloads.registerSource, { ...source, ...episode })
    expect((await t.mutation(api.downloads.request, { ...episode, ownerToken })).available).toBe(true)
    expect((await t.mutation(api.downloads.request, { ...episode, episodeNumber: 3, ownerToken })).available).toBe(false)
    await expect(t.mutation(api.downloads.request, { ...episode, episodeNumber: 0, ownerToken })).rejects.toThrow("Select a season")
    await expect(t.mutation(api.downloads.request, { ...selection, tmdbId: -1, ownerToken })).rejects.toThrow("Invalid title")
  })

  test("remove is idempotent and clear affects only its owner", async () => {
    const t = backend()
    const item = await prepare(t)
    await t.mutation(api.downloads.request, { ...selection, ownerToken: otherToken })
    await t.mutation(api.downloads.remove, { id: item.id, ownerToken })
    await t.mutation(api.downloads.remove, { id: item.id, ownerToken })
    expect(await t.query(api.downloads.list, { ownerToken })).toEqual([])
    await t.mutation(api.downloads.request, { ...selection, ownerToken })
    await t.mutation(api.downloads.clear, { ownerToken })
    expect(await t.query(api.downloads.list, { ownerToken })).toEqual([])
    expect(await t.query(api.downloads.list, { ownerToken: otherToken })).toHaveLength(1)
  })

  test("expired history cannot open and cleanup removes it", async () => {
    const t = backend()
    const item = await prepare(t)
    await t.run(ctx => ctx.db.patch(item.id, { expiresAt: Date.now() - 1 }))
    expect((await t.mutation(api.downloads.open, { id: item.id, ownerToken })).available).toBe(false)
    await t.mutation(internal.downloads.cleanupExpired, {})
    expect(await t.query(api.downloads.list, { ownerToken })).toEqual([])
  })

  test("history is bounded to 100 entries per device", async () => {
    const t = backend()
    for (let tmdbId = 1; tmdbId <= 102; tmdbId++) {
      await t.mutation(internal.downloads.registerSource, { ...source, tmdbId })
      await t.mutation(api.downloads.request, { tmdbId, mediaType: "movie", ownerToken })
    }
    const history = await t.query(api.downloads.list, { ownerToken })
    expect(history).toHaveLength(100)
    expect(history.some(row => row.tmdbId === 1)).toBe(false)
    expect(history.some(row => row.tmdbId === 102)).toBe(true)
  })
})

describe("validation and VidLove playback", () => {
  test("only VidLove is selectable and legacy links use VidLove", () => {
    expect(VIDEO_SERVERS.map(row => row.id)).toEqual(["vidlove"])
    expect(isVideoServer("vidapi")).toBe(false)
    for (const server of ["vidlove", "vidapi", "cdnm", "nontongo", "111movies", "videasy"] as const) {
      const url = new URL(buildVideoEmbedUrl({ server, title: { tmdbId: 27205 }, mediaType: "movie" })!)
      expect(url.hostname).toBe("player.vidlove.cc")
      expect(url.searchParams.get("download")).toBe("true")
    }
  })

  test("invalid TV selections produce no iframe", () => {
    expect(buildVideoEmbedUrl({ server: "vidlove", title: { tmdbId: 1 }, mediaType: "tv", seasonNumber: 0, episodeNumber: 1 })).toBeUndefined()
    expect(downloadKey({ ...selection, seasonNumber: 8 })).toBe("movie:27205:0:0:vidlove")
  })

  test("capabilities are hashed and weak tokens rejected", async () => {
    expect(await downloadOwnerHash(ownerToken)).toHaveLength(64)
    expect(await downloadOwnerHash(ownerToken)).not.toBe(ownerToken)
    await expect(downloadOwnerHash("user-123")).rejects.toThrow("Invalid download session")
  })

  test("unsafe URLs and file names are rejected", () => {
    for (const url of ["http://example.com/a.mp4", "https://user:pass@example.com/a.mp4", "https://127.0.0.1/a.mp4", "https://localhost/a.mp4", "https://foo.internal/a.mp4", "https://example.com/player.html", "https://example.com/a.mpd"]) expect(() => validateDirectFileUrl(url)).toThrow()
    expect(downloadFileName("path/Title.mp4", "video/mp4")).toBe("path_Title.mp4")
    expect(() => downloadFileName("movie.html", "video/mp4")).toThrow()
  })
})
