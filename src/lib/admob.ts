import { Capacitor } from "@capacitor/core"
import { App } from "@capacitor/app"
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
} from "@capacitor-community/admob"

// Android's production IDs are from the MovieLand AdMob app. iOS remains on
// Google's test ID until a separate iOS app is created in AdMob.
const platform = Capacitor.getPlatform()
const TEST_BANNER_IDS = {
  android: "ca-app-pub-3940256099942544/6300978111",
  ios: "ca-app-pub-3940256099942544/2934735716",
} as const
const TEST_APP_OPEN_IDS = {
  android: "ca-app-pub-3940256099942544/9257395921",
  ios: "ca-app-pub-3940256099942544/5575463023",
} as const
const TEST_INTERSTITIAL_IDS = {
  android: "ca-app-pub-3940256099942544/1033173712",
  ios: "ca-app-pub-3940256099942544/4411468910",
} as const
const PRODUCTION_ANDROID_BANNER_ID = "ca-app-pub-1363043081820862/4350056507"

const testMode = import.meta.env.DEV || import.meta.env.VITE_ADMOB_TEST_MODE === "true"
const bannerUsesTestAds = testMode || platform !== "android"
const fullscreenUsesTestAds = testMode || platform !== "android"
const bannerAdId = bannerUsesTestAds
  ? TEST_BANNER_IDS[platform === "ios" ? "ios" : "android"]
  : import.meta.env.VITE_ADMOB_BANNER_ID || PRODUCTION_ANDROID_BANNER_ID
const appOpenAdId = fullscreenUsesTestAds
  ? TEST_APP_OPEN_IDS[platform === "ios" ? "ios" : "android"]
  : import.meta.env.VITE_ADMOB_APP_OPEN_ID || ""
const interstitialAdId = fullscreenUsesTestAds
  ? TEST_INTERSTITIAL_IDS[platform === "ios" ? "ios" : "android"]
  : import.meta.env.VITE_ADMOB_INTERSTITIAL_ID || ""

let initialization: Promise<void> | null = null
let consentAllowsAds = false
let appOpenLoad: Promise<void> | null = null
let interstitialLoad: Promise<void> | null = null

export const isAdMobAvailable = Capacitor.isNativePlatform()

const APP_OPEN_COOLDOWN_MS = 4 * 60 * 60 * 1000
const INTERSTITIAL_COOLDOWN_MS = 30 * 60 * 1000
const INTERSTITIAL_DAILY_LIMIT = 2
const APP_OPEN_LAST_SHOWN_KEY = "movieland.admob.app-open.last-shown"
const INTERSTITIAL_STATE_KEY = "movieland.admob.interstitial.state"

function readNumber(key: string) {
  if (typeof window === "undefined") return 0
  const value = Number(window.localStorage.getItem(key))
  return Number.isFinite(value) ? value : 0
}

function readInterstitialState() {
  if (typeof window === "undefined") return { day: "", count: 0, lastShown: 0 }
  try {
    const value = JSON.parse(window.localStorage.getItem(INTERSTITIAL_STATE_KEY) ?? "null") as Partial<{
      day: string
      count: number
      lastShown: number
    }> | null
    return {
      day: value?.day ?? "",
      count: Number.isFinite(value?.count) ? Number(value?.count) : 0,
      lastShown: Number.isFinite(value?.lastShown) ? Number(value?.lastShown) : 0,
    }
  } catch {
    return { day: "", count: 0, lastShown: 0 }
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

async function initializeAdMob() {
  if (!isAdMobAvailable) return
  if (!initialization) {
    initialization = (async () => {
      await AdMob.initialize({
        initializeForTesting: bannerUsesTestAds,
        maxAdContentRating: MaxAdContentRating.MatureAudience,
      })

      try {
        const tracking = await AdMob.trackingAuthorizationStatus()
        if (Capacitor.getPlatform() === "ios" && tracking.status === "notDetermined") {
          await AdMob.requestTrackingAuthorization()
        }
      } catch {
        // Tracking authorization is unavailable on Android and older iOS builds.
      }

      try {
        let consent = await AdMob.requestConsentInfo()
        if (!consent.canRequestAds && consent.status === AdmobConsentStatus.REQUIRED && consent.isConsentFormAvailable) {
          consent = await AdMob.showConsentForm()
        }
        consentAllowsAds = consent.canRequestAds
      } catch {
        consentAllowsAds = false
      }
    })().catch((error) => {
      initialization = null
      throw error
    })
  }
  await initialization
}

export async function canRequestMovieLandAds() {
  if (!isAdMobAvailable) return false
  try { await initializeAdMob() } catch { return false }
  return consentAllowsAds
}

export async function showMovieLandBanner(shouldShow = () => true) {
  if (!isAdMobAvailable) return
  if (!await canRequestMovieLandAds()) return
  if (!shouldShow()) return
  await AdMob.showBanner({
    adId: bannerAdId,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    isTesting: bannerUsesTestAds,
    npa: true,
  })
  if (!shouldShow()) await hideMovieLandBanner()
}

export async function hideMovieLandBanner() {
  if (!isAdMobAvailable) return
  try {
    await AdMob.hideBanner()
  } catch {
    // The banner may not have finished initializing when a page unmounts.
  }
}

/**
 * Preloads an app-open ad. Showing is intentionally separate so lifecycle
 * events can enforce the four-hour cap before an ad is presented.
 */
export async function loadMovieLandAppOpen() {
  if (!isAdMobAvailable || !appOpenAdId) return
  if (!appOpenLoad) {
    appOpenLoad = (async () => {
      if (!await canRequestMovieLandAds()) return
      await AdMob.loadAppOpen({ adId: appOpenAdId })
    })().catch(() => undefined).finally(() => {
      appOpenLoad = null
    })
  }
  await appOpenLoad
}

export async function showMovieLandAppOpenIfEligible() {
  if (!isAdMobAvailable || !appOpenAdId || document.visibilityState !== "visible") return false
  if (!await canRequestMovieLandAds()) return false
  const lastShown = readNumber(APP_OPEN_LAST_SHOWN_KEY)
  if (Date.now() - lastShown < APP_OPEN_COOLDOWN_MS) return false

  await loadMovieLandAppOpen()
  try {
    const loaded = await AdMob.isAppOpenLoaded({ adId: appOpenAdId })
    if (!loaded.value) return false
    await AdMob.showAppOpen({ adId: appOpenAdId })
    window.localStorage.setItem(APP_OPEN_LAST_SHOWN_KEY, String(Date.now()))
    void loadMovieLandAppOpen()
    return true
  } catch {
    return false
  }
}

/**
 * Shows an interstitial only after an intentional title-detail navigation.
 * The daily limit and cooldown are local safeguards in addition to AdMob's
 * policy controls.
 */
export async function maybeShowMovieLandInterstitial() {
  if (!isAdMobAvailable || !interstitialAdId || document.visibilityState !== "visible") return false
  if (!await canRequestMovieLandAds()) return false
  const now = Date.now()
  const state = readInterstitialState()
  const currentDay = todayKey()
  const count = state.day === currentDay ? state.count : 0
  const lastShown = state.day === currentDay ? state.lastShown : 0
  if (count >= INTERSTITIAL_DAILY_LIMIT || now - lastShown < INTERSTITIAL_COOLDOWN_MS) return false

  if (!interstitialLoad) {
    interstitialLoad = (async () => {
      await initializeAdMob()
      await AdMob.prepareInterstitial({ adId: interstitialAdId, isTesting: fullscreenUsesTestAds, npa: true })
    })().catch(() => undefined).finally(() => {
      interstitialLoad = null
    })
  }
  await interstitialLoad

  try {
    await AdMob.showInterstitial({ adId: interstitialAdId })
    window.localStorage.setItem(INTERSTITIAL_STATE_KEY, JSON.stringify({
      day: currentDay,
      count: count + 1,
      lastShown: now,
    }))
    return true
  } catch {
    return false
  }
}

/**
 * Connects app foreground/background events to app-open preloading. A cold
 * launch only preloads; the first ad can appear after a later background return.
 */
export function startMovieLandAdLifecycle() {
  if (!isAdMobAvailable) return () => undefined

  let active = true
  let wasBackgrounded = false
  void loadMovieLandAppOpen()

  const onStateChange = ({ isActive }: { isActive: boolean }) => {
    if (!active) return
    if (!isActive) {
      wasBackgrounded = true
      return
    }
    if (wasBackgrounded) {
      wasBackgrounded = false
      void showMovieLandAppOpenIfEligible()
    }
  }

  const listener = App.addListener("appStateChange", onStateChange)
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      wasBackgrounded = true
      return
    }
    if (wasBackgrounded) {
      wasBackgrounded = false
      void showMovieLandAppOpenIfEligible()
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange)

  return () => {
    active = false
    document.removeEventListener("visibilitychange", onVisibilityChange)
    void listener.then((handle) => handle.remove()).catch(() => undefined)
  }
}
