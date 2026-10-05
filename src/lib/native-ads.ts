import { Capacitor, registerPlugin } from "@capacitor/core"
import { canRequestMovieLandAds } from "./admob"

interface MovieLandNativeAdsPlugin {
  show(options: { adId: string }): Promise<void>
  hide(): Promise<void>
}

const MovieLandNativeAds = registerPlugin<MovieLandNativeAdsPlugin>("MovieLandNativeAds")
const TEST_NATIVE_AD_ID = "ca-app-pub-3940256099942544/2247696110"
const NATIVE_ADVANCED_COOLDOWN_MS = 12 * 60 * 60 * 1000
const NATIVE_ADVANCED_LAST_SHOWN_KEY = "movieland.admob.native-advanced.last-shown"

export const isNativeAdvancedAvailable = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"

export async function showMovieLandNativeAdvanced(shouldShow = () => true) {
  if (!isNativeAdvancedAvailable) return
  if (!await canRequestMovieLandAds()) return
  if (!shouldShow()) return
  const lastShown = Number(window.localStorage.getItem(NATIVE_ADVANCED_LAST_SHOWN_KEY) ?? 0)
  if (Number.isFinite(lastShown) && Date.now() - lastShown < NATIVE_ADVANCED_COOLDOWN_MS) return
  const adId = import.meta.env.DEV || import.meta.env.VITE_ADMOB_TEST_MODE === "true"
    ? TEST_NATIVE_AD_ID
    : import.meta.env.VITE_ADMOB_NATIVE_ID || ""
  if (!adId) return
  await MovieLandNativeAds.show({ adId })
  if (!shouldShow()) {
    await hideMovieLandNativeAdvanced()
    return
  }
  window.localStorage.setItem(NATIVE_ADVANCED_LAST_SHOWN_KEY, String(Date.now()))
}

export async function hideMovieLandNativeAdvanced() {
  if (!isNativeAdvancedAvailable) return
  try {
    await MovieLandNativeAds.hide()
  } catch {
    // The native overlay may already have been removed during activity teardown.
  }
}
