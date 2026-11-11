import { useContext, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CopyIcon, CrownSimpleIcon, MagnifyingGlassIcon, PaperPlaneTiltIcon, PauseIcon, PlayIcon, ShareNetworkIcon, UserIcon, UsersIcon, UsersThreeIcon } from "@phosphor-icons/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { EmptyState, HomeLink, ScriptRequired, Spinner } from "../components/states"
import { Poster } from "../components/media"
import { ServerPicker } from "../components/ServerPicker"
import { Button, buttonVariants } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { EnhancedContext } from "../lib/app-context"
import { getSeason, getTitle, searchCatalog } from "../lib/catalog"
import { isConvexConfigured } from "../lib/convex"
import type { MediaTitle, Season } from "../lib/types"
import { buildVideoEmbedUrl, DEFAULT_VIDEO_SERVER, getPreferredServer, requestProviderPlayback, serverLabel, type VideoServer } from "../lib/video"
import { cn, formatYear } from "../lib/utils"
import { createPartyHostToken, getPartyIdentity, getPartySessionId, getRoomHostToken, hashPartyToken, makePartyRequestId, roomPath, savePartyIdentity, saveRoomHostToken, type PartyIdentity } from "../lib/watchparty"

function Notice({ children, onClose }: { children: string; onClose?: () => void }) {
  return <p className="watch-notice error" role="alert">{children}{onClose && <button type="button" className="notice-close" onClick={onClose} aria-label="Dismiss">×</button>}</p>
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`

export function WatchPartyPage() {
  const enhanced = useContext(EnhancedContext)
  if (!enhanced) return <ScriptRequired title="Watchparty" copy="Enable JavaScript to join a room, chat, and synchronize playback." />
  if (!isConvexConfigured) return <PartyUnavailable />
  return <PartyLobby />
}

function PartyUnavailable() {
  return <div className="page"><EmptyState icon={<UsersThreeIcon size={44} weight="thin" />} label="Watchparty is unavailable right now" action={<HomeLink />} /></div>
}

function PartyLobby() {
  const navigate = useNavigate()
  const createRoom = useMutation(api.watchParty.createRoom)
  const [identity, setIdentity] = useState<PartyIdentity>(() => getPartyIdentity())
  const [name, setName] = useState(identity.username)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<MediaTitle[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<MediaTitle | null>(null)
  const [season, setSeason] = useState<Season | null>(null)
  const [seasonLoading, setSeasonLoading] = useState(false)
  const [seasonNumber, setSeasonNumber] = useState(1)
  const [episodeNumber, setEpisodeNumber] = useState(1)
  const [server, setServer] = useState<VideoServer>(DEFAULT_VIDEO_SERVER)
  const [join, setJoin] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => setServer(getPreferredServer()), [])

  useEffect(() => {
    if (selected?.mediaType === "tv") setSeasonNumber(selected.seasons?.[0]?.seasonNumber ?? 1)
    else { setSeason(null); setSeasonNumber(1); setEpisodeNumber(1) }
  }, [selected])

  useEffect(() => {
    if (selected?.mediaType !== "tv") return
    let live = true
    setSeason(null)
    setSeasonLoading(true)
    getSeason(selected.tmdbId, seasonNumber)
      .then((result) => { if (!live) return; setSeason(result ?? null); setEpisodeNumber(result?.episodes[0]?.episodeNumber ?? 1) })
      .catch(() => { if (live) setSeason(null) })
      .finally(() => { if (live) setSeasonLoading(false) })
    return () => { live = false }
  }, [selected, seasonNumber])

  function saveName() {
    const next = { userId: identity.userId, username: name.trim().slice(0, 32) || "Guest" }
    savePartyIdentity(next)
    setIdentity(next)
    setName(next.username)
    return next
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault()
    const query = search.trim()
    if (!query) return
    setSearching(true)
    setError("")
    try { setResults((await searchCatalog(query)).items.slice(0, 9)) }
    catch { setError("Search failed. Try again.") }
    finally { setSearching(false) }
  }

  async function create() {
    if (!selected) { setError("Pick a title first."); return }
    const me = saveName()
    const hostToken = createPartyHostToken()
    setCreating(true)
    setError("")
    try {
      const room = await createRoom({
        tmdbId: selected.tmdbId,
        imdbId: selected.imdbId,
        mediaType: selected.mediaType,
        seasonNumber: selected.mediaType === "tv" ? seasonNumber : undefined,
        episodeNumber: selected.mediaType === "tv" ? episodeNumber : undefined,
        server,
        userId: me.userId,
        username: me.username,
        sessionId: getPartySessionId(),
        hostTokenHash: await hashPartyToken(hostToken),
      })
      saveRoomHostToken(room.roomId, hostToken)
      navigate(roomPath(room.roomId))
    } catch { setError("Couldn't create the room. Try again.") }
    finally { setCreating(false) }
  }

  function handleJoin(event: FormEvent) {
    event.preventDefault()
    const value = join.trim().replace(/\/$/, "").split("/").pop()
    if (value) navigate(roomPath(value))
  }

  return <div className="page narrow party">
    {error && <Notice onClose={() => setError("")}>{error}</Notice>}

    <label className="field"><UserIcon aria-hidden="true" /><Input value={name} onChange={(event) => setName(event.target.value)} onBlur={saveName} maxLength={32} placeholder="Name" aria-label="Your name" autoComplete="nickname" /></label>

    <form className="field" onSubmit={submitSearch} role="search">
      <MagnifyingGlassIcon aria-hidden="true" />
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pick a title" aria-label="Search titles" />
      <Button type="submit" variant="ghost" size="icon" aria-label="Search" title="Search" disabled={searching}>{searching ? <Spinner label="Searching" className="spinner-sm" /> : <ArrowRightIcon />}</Button>
    </form>

    {results.length > 0 && <div className="picks">{results.map((item) => {
      const active = selected?.tmdbId === item.tmdbId && selected.mediaType === item.mediaType
      return <button className={cn("pick", active && "selected")} type="button" key={`${item.mediaType}-${item.tmdbId}`} onClick={() => setSelected(item)} aria-pressed={active} aria-label={`${item.title} (${formatYear(item.releaseDate)})`} title={item.title}>
        <Poster item={item} />{active && <span className="pick-check"><CheckIcon size={14} weight="bold" /></span>}
      </button>
    })}</div>}

    {selected?.mediaType === "tv" && <div className="pair">
      <label className="select"><span className="sr-only">Season</span><select value={seasonNumber} onChange={(event) => setSeasonNumber(Number(event.target.value))} disabled={seasonLoading}>{selected.seasons?.map((item) => <option value={item.seasonNumber} key={item.seasonNumber}>{item.name}</option>)}</select></label>
      <label className="select"><span className="sr-only">Episode</span><select value={episodeNumber} onChange={(event) => setEpisodeNumber(Number(event.target.value))} disabled={seasonLoading || !season}>{season?.episodes.map((item) => <option value={item.episodeNumber} key={item.episodeNumber}>{String(item.episodeNumber).padStart(2, "0")} · {item.name}</option>)}</select></label>
    </div>}

    <div className="party-create">
      <ServerPicker value={server} onSelect={setServer} />
      <Button variant="solid" size="lg" onClick={create} disabled={!selected || creating || seasonLoading} aria-label="Create room" title="Create room">{creating ? <Spinner label="Creating room" className="spinner-sm" /> : <UsersThreeIcon size={24} />}</Button>
    </div>

    <form className="field join" onSubmit={handleJoin}>
      <UsersIcon aria-hidden="true" />
      <Input value={join} onChange={(event) => setJoin(event.target.value)} placeholder="Room link" aria-label="Room link or id" autoComplete="off" />
      <Button type="submit" variant="ghost" size="icon" aria-label="Join room" title="Join"><ArrowRightIcon /></Button>
    </form>
  </div>
}

export function WatchPartyRoomPage() {
  const { roomId } = useParams()
  const enhanced = useContext(EnhancedContext)
  if (!enhanced) return <ScriptRequired title="Watchparty" copy="Enable JavaScript to join this room and synchronize playback." />
  if (!isConvexConfigured) return <PartyUnavailable />
  if (!roomId) return <div className="page"><EmptyState label="Room link is incomplete" action={<Link className={buttonVariants({ variant: "soft", size: "icon" })} to="/watchparty" aria-label="Watchparty"><UsersThreeIcon /></Link>} /></div>
  return <PartyRoom roomId={roomId as Id<"watchPartyRooms">} />
}

function PartyRoom({ roomId }: { roomId: Id<"watchPartyRooms"> }) {
  const identity = useMemo(() => getPartyIdentity(), [])
  const sessionId = useMemo(() => getPartySessionId(), [])
  const hostToken = useMemo(() => getRoomHostToken(String(roomId)), [roomId])
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
  const [draft, setDraft] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const [loaded, setLoaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [switching, setSwitching] = useState<VideoServer | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const appliedRequest = useRef("")
  const position = useRef(0)

  useEffect(() => { hashPartyToken(hostToken).then(setTokenHash) }, [hostToken])
  useEffect(() => {
    let live = true
    joinRoom({ roomId, userId: identity.userId, username: identity.username, sessionId }).catch(() => { if (live) setError("Couldn't join this room.") })
    return () => { live = false }
  }, [identity.userId, identity.username, joinRoom, roomId, sessionId])
  useEffect(() => {
    const beat = () => heartbeat({ roomId, userId: identity.userId, username: identity.username, sessionId }).catch(() => undefined)
    beat()
    const timer = window.setInterval(beat, 15_000)
    return () => window.clearInterval(timer)
  }, [heartbeat, identity.userId, identity.username, roomId, sessionId])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const room = roomData?.room
  useEffect(() => {
    if (!room) return
    let live = true
    getTitle(room.mediaType, room.tmdbId).then((result) => { if (live) setTitle(result ?? null) }).catch(() => undefined)
    return () => { live = false }
  }, [room?.mediaType, room?.tmdbId])
  useEffect(() => { setLoaded(false); setSwitching(null) }, [room?.server, room?.tmdbId, room?.seasonNumber, room?.episodeNumber])
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }) }, [messages.length])
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  const isHost = Boolean(room && tokenHash && room.hostUserId === identity.userId && room.hostSessionId === sessionId)
  const playback = roomData?.playback
  const pendingRequest = playback?.pendingRequest
  useEffect(() => {
    if (!isHost || !pendingRequest || !tokenHash || appliedRequest.current === pendingRequest.requestId) return
    appliedRequest.current = pendingRequest.requestId
    applyPlaybackRequest({ roomId, hostTokenHash: tokenHash, requestId: pendingRequest.requestId }).catch(() => { appliedRequest.current = ""; setError("Couldn't apply the sync request.") })
  }, [applyPlaybackRequest, isHost, pendingRequest, roomId, tokenHash])

  const seconds = playback ? Math.max(0, playback.positionSeconds + (playback.isPlaying ? (now - playback.positionUpdatedAt) / 1000 : 0)) : 0
  position.current = seconds
  useEffect(() => {
    if (!isHost || !playback?.isPlaying || !tokenHash) return
    const snapshot = () => syncPlayback({ roomId, hostTokenHash: tokenHash, isPlaying: true, positionSeconds: position.current, revision: playback.revision }).catch(() => undefined)
    const timer = window.setInterval(snapshot, 5_000)
    return () => window.clearInterval(timer)
  }, [isHost, roomId, playback?.isPlaying, playback?.revision, syncPlayback, tokenHash])

  if (roomData === undefined) return <div className="page"><div className="state"><Spinner label="Loading room" /></div></div>
  if (roomData === null || !room) return <div className="page"><EmptyState icon={<UsersThreeIcon size={44} weight="thin" />} label="This room has expired or the link is invalid" action={<Link className={buttonVariants({ variant: "soft", size: "icon" })} to="/watchparty" aria-label="Watchparty"><UsersThreeIcon /></Link>} /></div>

  const label = serverLabel(room.server)
  const heading = title?.title ?? (room.mediaType === "tv" ? `Series ${room.tmdbId}` : `Movie ${room.tmdbId}`)
  const episode = room.mediaType === "tv" ? ` · S${String(room.seasonNumber ?? 1).padStart(2, "0")}E${String(room.episodeNumber ?? 1).padStart(2, "0")}` : ""
  const embedUrl = buildVideoEmbedUrl({ server: room.server, title: { tmdbId: room.tmdbId, imdbId: room.imdbId }, mediaType: room.mediaType, seasonNumber: room.seasonNumber, episodeNumber: room.episodeNumber })
  const hostPresent = roomData.members.some((member) => member.userId === room.hostUserId)
  const link = `${window.location.origin}${roomPath(String(roomId))}`

  async function togglePlayback() {
    if (!playback) return
    const next = !playback.isPlaying
    requestProviderPlayback(iframeRef.current, room!.server, { action: next ? "play" : "pause", positionSeconds: seconds, revision: playback.revision })
    try { await requestPlayback({ roomId, userId: identity.userId, username: identity.username, requestId: makePartyRequestId(), isPlaying: next, positionSeconds: seconds }) }
    catch { setError("Couldn't sync playback.") }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopied(true) } catch { window.prompt("Room link", link) }
  }

  async function share() {
    if (navigator.share) await navigator.share({ title: `Join ${heading} on MovieLand`, url: link }).catch(() => undefined)
    else await copyLink()
  }

  async function claim() {
    const token = createPartyHostToken()
    try {
      await claimHost({ roomId, userId: identity.userId, username: identity.username, sessionId, hostTokenHash: await hashPartyToken(token) })
      saveRoomHostToken(String(roomId), token)
      setTokenHash(await hashPartyToken(token))
    } catch { setError("Couldn't take over as host.") }
  }

  async function changeServer(next: VideoServer) {
    if (!isHost || next === room!.server || switching) return
    setSwitching(next)
    try { await setServer({ roomId, hostTokenHash: tokenHash, server: next }) }
    catch { setSwitching(null); setError("Couldn't switch servers.") }
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body) return
    setDraft("")
    try { await sendMessage({ roomId, userId: identity.userId, username: identity.username, body }) }
    catch { setDraft(body); setError("Message not sent.") }
  }

  return <div className="watch party-room">
    <div className="party-main">
      <div className="stage" aria-busy={!loaded}>
        {embedUrl
          ? <iframe ref={iframeRef} key={embedUrl} title={`${label} player for ${heading}`} src={embedUrl} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoaded(true)} />
          : <p className="stage-note">Episode unavailable.</p>}
        {!loaded && embedUrl && <div className="player-loading-overlay"><Spinner label={`Loading ${label}`} /></div>}
      </div>
      <div className="watch-bar">
        <Link className={buttonVariants({ variant: "soft", size: "icon" })} to="/watchparty" aria-label="Leave room" title="Leave"><ArrowLeftIcon /></Link>
        <h1 className="watch-title">{heading}{episode}</h1>
        <div className="watch-tools">
          {isHost && <span className="host-mark" title="You are the host" role="img" aria-label="Host"><CrownSimpleIcon size={18} weight="fill" /></span>}
          <ServerPicker value={room.server} onSelect={changeServer} disabled={!isHost} busy={switching} />
          <Button variant="soft" size="icon" aria-label="Copy room link" title="Copy link" onClick={copyLink}>{copied ? <CheckIcon /> : <CopyIcon />}</Button>
          <Button variant="soft" size="icon" aria-label="Share room" title="Share" onClick={share}><ShareNetworkIcon /></Button>
        </div>
      </div>
      <div className="sync-bar">
        <Button variant="solid" size="icon" onClick={togglePlayback} disabled={!playback || !loaded} aria-label={playback?.isPlaying ? "Pause for everyone" : "Play for everyone"} title={playback?.isPlaying ? "Pause for everyone" : "Play for everyone"}>{playback?.isPlaying ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}</Button>
        <span className="clock" aria-label="Room position">{clock(seconds)}</span>
        <span className="members" title="In the room" role="img" aria-label={`${roomData.members.length} in the room`}><UsersIcon size={16} aria-hidden="true" />{roomData.members.length}</span>
        {!isHost && !hostPresent && <Button variant="soft" size="icon" onClick={claim} aria-label="Take over as host" title="Take over as host"><CrownSimpleIcon /></Button>}
      </div>
      {error && <Notice onClose={() => setError("")}>{error}</Notice>}
    </div>

    <section className="chat" aria-label="Chat">
      <div className="chat-list" ref={listRef} aria-live="polite">
        {messages.map((message, index) => <div className={cn("msg", message.userId === identity.userId && "own")} key={`${message.userId}-${message.createdAt}-${index}`}><b>{message.username}</b><p>{message.body}</p></div>)}
      </div>
      <form className="composer" onSubmit={submitMessage}>
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} placeholder="Message" aria-label="Message" autoComplete="off" />
        <Button type="submit" variant="solid" size="icon" aria-label="Send" title="Send" disabled={!draft.trim()}><PaperPlaneTiltIcon /></Button>
      </form>
    </section>
  </div>
}
