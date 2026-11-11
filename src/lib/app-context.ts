import { createContext } from "react"
import type { ServerCatalogData } from "./catalog-data"

/** Catalog data rendered on the server for the first route, if any. */
export const CatalogDataContext = createContext<ServerCatalogData>({})
/** False during server rendering and hydration, true once client scripts run. */
export const EnhancedContext = createContext(false)
