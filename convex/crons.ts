import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval("watchparty room cleanup", { hours: 1 }, internal.watchParty.cleanupExpired, {})

export default crons
