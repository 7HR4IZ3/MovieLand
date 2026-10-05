import { useEffect } from "react"
import { hideMovieLandBanner, isAdMobAvailable, showMovieLandBanner } from "../lib/admob"
import { isNativeAdvancedAvailable } from "../lib/native-ads"

export function AdMobBanner() {
  useEffect(() => {
    if (!isAdMobAvailable || isNativeAdvancedAvailable) return
    let active = true
    void showMovieLandBanner(() => active).catch(() => undefined)
    return () => {
      active = false
      void hideMovieLandBanner()
    }
  }, [])

  return null
}
