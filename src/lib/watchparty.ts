import type { VideoServer } from "./video"

const IDENTITY_KEY = "movieland:watchparty:identity"
const SESSION_KEY = "movieland:watchparty:session"
const TOKEN_PREFIX = "movieland:watchparty:host:"

export type PartyIdentity = {
  userId: string
  username: string
}

export type PartyRoom = {
  roomId: string
  tmdbId: number
  imdbId?: string
  mediaType: "movie" | "tv"
  seasonNumber?: number
  episodeNumber?: number
  server: VideoServer
  hostUserId: string
  hostSessionId: string
  createdAt: number
  expiresAt: number
}

export type PartyPlayback = {
  isPlaying: boolean
  positionSeconds: number
  positionUpdatedAt: number
  revision: number
  pendingRequest?: {
    requestId: string
    userId: string
    username: string
    isPlaying: boolean
    positionSeconds: number
    createdAt: number
  }
  updatedAt: number
}

export type PartyMember = { userId: string; username: string; lastSeenAt: number }
export type PartyMessage = { userId: string; username: string; body: string; createdAt: number }

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function readStorage<T>(storage: Storage, key: string): T | null {
  try {
    const value = storage.getItem(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

function writeStorage(storage: Storage, key: string, value: unknown) {
  try { storage.setItem(key, JSON.stringify(value)) } catch { /* Storage can be unavailable in private contexts. */ }
}

export function getPartyIdentity(): PartyIdentity {
  if (typeof window === "undefined") return { userId: "server-user", username: "Guest" }
  const stored = readStorage<PartyIdentity>(window.localStorage, IDENTITY_KEY)
  if (stored?.userId && stored.username) return stored
  const identity = { userId: randomId(), username: "Guest" }
  writeStorage(window.localStorage, IDENTITY_KEY, identity)
  return identity
}

export function savePartyIdentity(identity: PartyIdentity) {
  if (typeof window !== "undefined") writeStorage(window.localStorage, IDENTITY_KEY, { userId: identity.userId, username: identity.username.trim().slice(0, 32) || "Guest" })
}

export function getPartySessionId() {
  if (typeof window === "undefined") return "server-session"
  const stored = window.sessionStorage.getItem(SESSION_KEY)
  if (stored) return stored
  const sessionId = randomId()
  try { window.sessionStorage.setItem(SESSION_KEY, sessionId) } catch { /* Session storage is optional. */ }
  return sessionId
}

export function getRoomHostToken(roomId: string) {
  if (typeof window === "undefined") return `server-${roomId}`
  const key = `${TOKEN_PREFIX}${roomId}`
  const stored = window.localStorage.getItem(key)
  if (stored) return stored
  const token = randomId()
  try { window.localStorage.setItem(key, token) } catch { /* Storage is optional. */ }
  return token
}

export function createPartyHostToken() {
  return randomId()
}

export function saveRoomHostToken(roomId: string, token: string) {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(`${TOKEN_PREFIX}${roomId}`, token) } catch { /* Storage is optional. */ }
  }
}

export async function hashPartyToken(token: string) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
    return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("")
  }
  let hash = 2166136261
  for (const character of token) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return `fallback-${(hash >>> 0).toString(16)}`
}

export function makePartyRequestId() {
  return randomId()
}

export function roomPath(roomId: string) {
  return `/watchparty/${roomId}`
}
