import { useEffect } from "react"
import { hideMovieLandNativeAdvanced, isNativeAdvancedAvailable, showMovieLandNativeAdvanced } from "../lib/native-ads"

/** Android-only Native Advanced placement; web and iOS keep their normal banner. */
export function AdMobNativeAdvanced() {
  useEffect(() => {
    if (!isNativeAdvancedAvailable) return
    let active = true
    void showMovieLandNativeAdvanced(() => active).catch(() => undefined)
    return () => {
      active = false
      void hideMovieLandNativeAdvanced()
    }
  }, [])

  return null
}
