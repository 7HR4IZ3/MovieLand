import { useEffect } from "react"
import { startMovieLandAdLifecycle } from "../lib/admob"

/** Keeps app-open loading and foreground caps in one app-level lifecycle. */
export function AdMobLifecycle() {
  useEffect(() => startMovieLandAdLifecycle(), [])
  return null
}
