import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"

export interface SheinPriceConfig {
  defaultDiscount: number
  usdExchangeRate: number
  note: string | null
  updatedAt: string | null
}

export const FALLBACK_SHEIN_PRICE_CONFIG: SheinPriceConfig = {
  defaultDiscount: 0.4,
  usdExchangeRate: 7.3,
  note: null,
  updatedAt: null,
}

function asPositiveNumber(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export function getSheinPriceConfig(db: SyncPostgresDatabase): SheinPriceConfig {
  const row = db.prepare(`
    select default_discount, usd_exchange_rate, note, updated_at
    from shein_price_config
    where id = 1
  `).get() as {
    default_discount: number
    usd_exchange_rate: number
    note: string | null
    updated_at: string | null
  } | undefined

  if (!row) return FALLBACK_SHEIN_PRICE_CONFIG
  return {
    defaultDiscount: asPositiveNumber(row.default_discount, FALLBACK_SHEIN_PRICE_CONFIG.defaultDiscount),
    usdExchangeRate: asPositiveNumber(row.usd_exchange_rate, FALLBACK_SHEIN_PRICE_CONFIG.usdExchangeRate),
    note: row.note ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

export function updateSheinPriceConfig(
  db: SyncPostgresDatabase,
  input: { defaultDiscount: number; usdExchangeRate: number; note?: string | null },
) {
  if (!Number.isFinite(input.defaultDiscount) || input.defaultDiscount <= 0) {
    throw new Error("default_discount must be greater than 0")
  }
  if (!Number.isFinite(input.usdExchangeRate) || input.usdExchangeRate <= 0) {
    throw new Error("usd_exchange_rate must be greater than 0")
  }

  db.prepare(`
    insert into shein_price_config (
      id,
      default_discount,
      usd_exchange_rate,
      note,
      updated_at
    )
    values (1, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(id) do update set
      default_discount = excluded.default_discount,
      usd_exchange_rate = excluded.usd_exchange_rate,
      note = excluded.note,
      updated_at = excluded.updated_at
  `).run(input.defaultDiscount, input.usdExchangeRate, input.note ?? null)

  return getSheinPriceConfig(db)
}
