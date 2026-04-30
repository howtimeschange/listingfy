import { sheinAdapter } from "./shein"
import type { PlatformAdapter } from "./types"

const adapters = new Map<string, PlatformAdapter>([
  [sheinAdapter.platform, sheinAdapter],
])

export function platformAdapterFor(platform: string): PlatformAdapter {
  const key = platform.trim().toUpperCase()
  const adapter = adapters.get(key)
  if (!adapter) throw new Error(`Unsupported platform adapter: ${platform}`)
  return adapter
}

export { sheinAdapter }
export type { PlatformAdapter }
