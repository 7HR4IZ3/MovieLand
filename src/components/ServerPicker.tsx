import { useEffect, useRef, type CSSProperties } from "react"
import { Link } from "react-router-dom"
import { CheckIcon, HardDrivesIcon } from "@phosphor-icons/react"
import { Spinner } from "./states"
import { cn } from "../lib/utils"
import { setPreferredServer, VIDEO_SERVERS, type VideoServer } from "../lib/video"

type ServerPickerProps = {
  value: VideoServer
  /** Navigate with a link; used on the watch page so the choice is a shareable URL. */
  hrefFor?: (server: VideoServer) => string
  /** Run an action instead of navigating; used for host-controlled rooms. */
  onSelect?: (server: VideoServer) => void
  disabled?: boolean
  busy?: VideoServer | null
  className?: string
}

/**
 * Compact server menu built on a native <details> so it also opens without
 * client scripts. Each server has its own swatch colour and the last choice is
 * remembered as the default for new playback.
 */
export function ServerPicker({ value, hrefFor, onSelect, disabled = false, busy = null, className }: ServerPickerProps) {
  const ref = useRef<HTMLDetailsElement>(null)
  const active = VIDEO_SERVERS.find((server) => server.id === value) ?? VIDEO_SERVERS[0]

  useEffect(() => {
    const close = () => { if (ref.current) ref.current.open = false }
    const onPointer = (event: PointerEvent) => { if (ref.current?.open && !ref.current.contains(event.target as Node)) close() }
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close() }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey) }
  }, [])

  function pick(server: VideoServer) {
    if (ref.current) ref.current.open = false
    setPreferredServer(server)
    onSelect?.(server)
  }

  return <details className={cn("picker", className)} ref={ref}>
    <summary className="btn btn-soft btn-icon picker-button" aria-label={`Server: ${active.label}`} title={`Server · ${active.label}`}>
      <HardDrivesIcon />
      <span className="picker-dot" style={{ background: active.hue }} aria-hidden="true" />
    </summary>
    <ul className="picker-menu" aria-label="Servers">
      {VIDEO_SERVERS.map((server) => {
        const selected = server.id === value
        const content = <>
          <span className="swatch" style={{ "--hue": server.hue } as CSSProperties} aria-hidden="true">{server.label[0]}</span>
          <span className="picker-name">{server.label}</span>
          {busy === server.id ? <Spinner label={`Loading ${server.label}`} className="spinner-sm" /> : selected ? <CheckIcon size={16} weight="bold" aria-label="Selected" /> : null}
        </>
        return <li key={server.id}>
          {hrefFor && !disabled
            ? <Link className={cn("picker-option", selected && "selected")} to={hrefFor(server.id)} replace onClick={() => pick(server.id)} aria-current={selected ? "true" : undefined}>{content}</Link>
            : <button className={cn("picker-option", selected && "selected")} type="button" disabled={disabled || selected || Boolean(busy)} onClick={() => pick(server.id)} aria-pressed={selected}>{content}</button>}
        </li>
      })}
    </ul>
  </details>
}
