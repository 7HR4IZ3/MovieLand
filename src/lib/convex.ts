import { ConvexHttpClient } from "convex/browser"
import { ConvexReactClient } from "convex/react"
import { makeFunctionReference, type FunctionReference } from "convex/server"

const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim()

export const isConvexConfigured = Boolean(convexUrl)
export const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null
export const convexReactClient = convexUrl ? new ConvexReactClient(convexUrl) : null

export async function callConvexAction<T>(name: string, args: Record<string, unknown> = {}) {
  if (!convexClient) throw new Error("Convex is not configured")
  return convexClient.action(makeFunctionReference(name) as FunctionReference<"action">, args) as Promise<T>
}
