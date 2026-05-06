import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { DB_DSN_SAFE, getDb } from "../db"

const metadata = new Hono()

const PROJECT_ROOT =
  path.basename(process.cwd()) === "web"
    ? path.resolve(process.cwd(), "..")
    : process.cwd()

const METADATA_SYNC_STAGES = ["sync", "import"] as const

type MetadataSyncStage = "queued" | "sync" | "import" | "completed" | "failed"

type MetadataSyncJob = {
  id: string
  status: "queued" | "running" | "completed" | "failed"
  stage: MetadataSyncStage
  options: MetadataSyncOptions
  total_count: number
  completed_count: number
  failed_count: number
  source_dir: string | null
  manifest: unknown | null
  import_summary: unknown | null
  logs: string[]
  error: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

type MetadataSyncOptions = {
  roots: string[]
  limitLeaves: number | null
  standardConcurrency: number
  attributeConcurrency: number
  skipStandards: boolean
  skipAttributes: boolean
  skipAttributeValues: boolean
}

type PictureConfigRow = {
  field_key: string
  is_true: number
}

type PictureRequirement = {
  key: string
  name: string
  level: string
  show: number | null
  required: number | null
  single: number | null
  image_type: string
  count_rule: string
  dimension_rule: string
  format_rule: string
  size_rule: string
  field_keys: Array<{
    field_key: string
    is_true: number | null
  }>
  note: string | null
}

const metadataSyncJobs = new Map<string, MetadataSyncJob>()
const metadataSyncPending: MetadataSyncJob[] = []
let metadataSyncRunning = false
let metadataSyncScheduled = false

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function snapshotJob(job: MetadataSyncJob) {
  return {
    ...job,
    options: {
      ...job.options,
      roots: [...job.options.roots],
    },
    logs: [...job.logs],
  }
}

function readPositiveInteger(
  value: unknown,
  fallback: number,
  { min = 1, max = 1000 } = {},
) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.floor(number)))
}

function readLimitLeaves(value: unknown) {
  if (value === undefined || value === null || value === "") return null
  return readPositiveInteger(value, 1, { min: 1, max: 100000 })
}

function readRoots(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : String(value ?? "").split(/[\n,，;；]+/)

  const seen = new Set<string>()
  const roots: string[] = []
  for (const item of values) {
    const root = String(item ?? "").trim()
    if (!root || seen.has(root)) continue
    seen.add(root)
    roots.push(root)
  }
  return roots
}

function readMetadataSyncOptions(body: Record<string, unknown>): MetadataSyncOptions {
  return {
    roots: readRoots(body.roots),
    limitLeaves: readLimitLeaves(body.limitLeaves),
    standardConcurrency: readPositiveInteger(body.standardConcurrency, 12, { max: 32 }),
    attributeConcurrency: readPositiveInteger(body.attributeConcurrency, 8, { max: 32 }),
    skipStandards: Boolean(body.skipStandards),
    skipAttributes: Boolean(body.skipAttributes),
    skipAttributeValues: Boolean(body.skipAttributeValues),
  }
}

function appendJobLog(job: MetadataSyncJob, stage: string, chunk: Buffer | string) {
  const text = chunk.toString()
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    job.logs.push(`[${stage}] ${line}`)
  }

  if (job.logs.length > 120) {
    job.logs.splice(0, job.logs.length - 120)
  }
}

function parseJsonOutput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function nodeOptionsEnv() {
  return [process.env.NODE_OPTIONS, "--no-warnings=ExperimentalWarning"]
    .filter(Boolean)
    .join(" ")
}

function runNodeScript(
  job: MetadataSyncJob,
  stage: (typeof METADATA_SYNC_STAGES)[number],
  args: string[],
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        NODE_OPTIONS: nodeOptionsEnv(),
      },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
      appendJobLog(job, stage, chunk)
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout)
        return
      }
      reject(new Error(stderr.trim() || `${args[0]} exited with code ${code}`))
    })
  })
}

function relativeSourceDir(sourceDir: string) {
  return path.relative(PROJECT_ROOT, sourceDir)
}

async function runMetadataSyncJob(job: MetadataSyncJob) {
  const outputDir = path.join(
    PROJECT_ROOT,
    "data",
    "shein-metadata",
    `web-${timestampForPath()}-${job.id.slice(0, 8)}`,
  )
  job.source_dir = relativeSourceDir(outputDir)

  const syncArgs = [
    "scripts/shein_metadata_sync.mjs",
    "--out",
    outputDir,
    "--standard-concurrency",
    String(job.options.standardConcurrency),
    "--attribute-concurrency",
    String(job.options.attributeConcurrency),
  ]
  if (job.options.roots.length) {
    syncArgs.push("--roots", job.options.roots.join(","))
  }
  if (job.options.limitLeaves !== null) {
    syncArgs.push("--limit-leaves", String(job.options.limitLeaves))
  }
  if (job.options.skipStandards) {
    syncArgs.push("--skip-standards")
  }
  if (job.options.skipAttributes) {
    syncArgs.push("--skip-attributes")
  }

  job.stage = "sync"
  appendJobLog(job, "sync", `Writing metadata to ${job.source_dir}`)
  const syncOutput = await runNodeScript(job, "sync", syncArgs)
  job.manifest = parseJsonOutput(syncOutput)
  job.completed_count += 1

	  const importArgs = [
	    "scripts/shein_metadata_import.mjs",
	    "--source",
	    outputDir,
	  ]
  if (job.options.skipAttributeValues) {
    importArgs.push("--skip-attribute-values")
  }

	  job.stage = "import"
	  appendJobLog(job, "import", `Importing metadata into ${DB_DSN_SAFE}`)
  const importOutput = await runNodeScript(job, "import", importArgs)
  job.import_summary = parseJsonOutput(importOutput)
  job.completed_count += 1
}

async function processMetadataSyncQueue() {
  metadataSyncScheduled = false
  if (metadataSyncRunning) return
  metadataSyncRunning = true

  while (metadataSyncPending.length > 0) {
    const job = metadataSyncPending.shift()
    if (!job) continue

    job.status = "running"
    job.started_at = new Date().toISOString()

    try {
      await runMetadataSyncJob(job)
      job.status = "completed"
      job.stage = "completed"
    } catch (error) {
      job.status = "failed"
      job.stage = "failed"
      job.failed_count = 1
      job.error = error instanceof Error ? error.message : String(error)
      appendJobLog(job, "error", job.error)
    } finally {
      job.finished_at = new Date().toISOString()
    }
  }

  metadataSyncRunning = false
}

function enqueueMetadataSyncJob(options: MetadataSyncOptions) {
  const job: MetadataSyncJob = {
    id: randomUUID(),
    status: "queued",
    stage: "queued",
    options,
    total_count: METADATA_SYNC_STAGES.length,
    completed_count: 0,
    failed_count: 0,
    source_dir: null,
    manifest: null,
    import_summary: null,
    logs: [],
    error: null,
    created_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
  }

  metadataSyncJobs.set(job.id, job)
  metadataSyncPending.push(job)

  if (!metadataSyncScheduled) {
    metadataSyncScheduled = true
    queueMicrotask(() => {
      void processMetadataSyncQueue()
    })
  }

  return snapshotJob(job)
}

const MAIN_DETAIL_IMAGE_RULE = {
  dimension_rule: "1340 x 1785 px；或 1:1，900-2200 px",
  format_rule: "JPG / JPEG / PNG",
  size_rule: "≤ 3MB",
}

const SQUARE_IMAGE_RULE = {
  dimension_rule: "1:1，900 x 900 - 2200 x 2200 px",
  format_rule: "JPG / JPEG / PNG",
  size_rule: "≤ 3MB",
}

const COLOR_IMAGE_RULE = {
  dimension_rule: "1:1，80 x 80 px",
  format_rule: "JPG / JPEG / PNG",
  size_rule: "≤ 3MB",
}

function buildPictureRequirements(config: PictureConfigRow[]): PictureRequirement[] {
  const configMap = new Map(config.map((item) => [item.field_key, item.is_true]))

  const field = (fieldKey: string) => ({
    field_key: fieldKey,
    is_true: configMap.get(fieldKey) ?? null,
  })

  const boolValue = (fieldKey: string) => {
    const value = configMap.get(fieldKey)
    return value == null ? null : value
  }

  const detailCountRule = (single: number | null) => {
    if (single === 1) return "最多 1 张主图"
    return "主图最多 1 张；细节图最多 10 张"
  }

  const detailImageType = (single: number | null) => {
    if (single === 1) return "1-主图"
    return "1-主图；2-细节图"
  }

  const requirements: PictureRequirement[] = [
    {
      key: "spu-detail",
      name: "SPU 轮播图",
      level: "SPU",
      show: boolValue("spu_image_detail_show"),
      required: boolValue("spu_image_detail_required"),
      single: boolValue("spu_image_detail_single"),
      image_type: detailImageType(boolValue("spu_image_detail_single")),
      count_rule: detailCountRule(boolValue("spu_image_detail_single")),
      ...MAIN_DETAIL_IMAGE_RULE,
      field_keys: [
        field("spu_image_detail_show"),
        field("spu_image_detail_required"),
        field("spu_image_detail_single"),
      ],
      note: "单张时只传主图；多张时主图必传，细节图按顺序上传。",
    },
    {
      key: "spu-square",
      name: "SPU 方形图",
      level: "SPU",
      show: boolValue("spu_image_square_show"),
      required: boolValue("spu_image_square_required"),
      single: null,
      image_type: "5-方块图",
      count_rule: "1 张",
      ...SQUARE_IMAGE_RULE,
      field_keys: [
        field("spu_image_square_show"),
        field("spu_image_square_required"),
      ],
      note: null,
    },
    {
      key: "skc-detail",
      name: "SKC 主图/细节图",
      level: "SKC",
      show: boolValue("skc_image_detail_show"),
      required: boolValue("skc_image_detail_required"),
      single: boolValue("skc_image_detail_single"),
      image_type: detailImageType(boolValue("skc_image_detail_single")),
      count_rule: detailCountRule(boolValue("skc_image_detail_single")),
      ...MAIN_DETAIL_IMAGE_RULE,
      field_keys: [
        field("skc_image_detail_show"),
        field("skc_image_detail_required"),
        field("skc_image_detail_single"),
      ],
      note: "主图会展示在商品列表和详情细节图首图。",
    },
    {
      key: "skc-square",
      name: "SKC 方形图",
      level: "SKC",
      show: boolValue("skc_image_square_show"),
      required: boolValue("skc_image_square_required"),
      single: null,
      image_type: "5-方块图",
      count_rule: "1 张",
      ...SQUARE_IMAGE_RULE,
      field_keys: [
        field("skc_image_square_show"),
        field("skc_image_square_required"),
      ],
      note: null,
    },
    {
      key: "skc-color",
      name: "SKC 色块图",
      level: "SKC",
      show: 1,
      required: null,
      single: 1,
      image_type: "6-色块图",
      count_rule: "每个 SKC 1 张；多 SKC 必填，单 SKC 非必填",
      ...COLOR_IMAGE_RULE,
      field_keys: [],
      note: "是否必填取决于商品是否有多个 SKC。",
    },
  ]

  if (config.length === 1 && config[0]?.field_key === "switch_spu_picture") {
    return requirements.filter((item) => item.key.startsWith("skc-"))
  }

  return requirements
}

// GET /api/metadata/summary
metadata.get("/summary", (c) => {
  const db = getDb()
  const platform = "SHEIN"

  const latestBatch = db.prepare(`
    SELECT id, batch_no, status, started_at, finished_at, source_dir,
      total_count, success_count, failed_count
    FROM sync_batch
    WHERE source_system = ?
      AND source_object = 'metadata'
    ORDER BY id DESC
    LIMIT 1
  `).get(platform) ?? null

  const tables = [
    "channel_category",
    "channel_publish_standard",
    "channel_publish_field",
    "channel_picture_config",
    "channel_attribute_template",
    "channel_attribute",
    "channel_attribute_value",
    "channel_required_attribute",
  ]

  const counts: Record<string, number> = {}
  for (const table of tables) {
    const row = db.prepare(`SELECT count(*) as count FROM ${table} WHERE platform = ?`).get(platform) as { count: number }
    counts[table] = row.count
  }

  const roots = db.prepare(`
    SELECT root_category_name, count(*) as leaf_count
    FROM channel_category
    WHERE platform = ?
      AND last_category = 1
    GROUP BY root_category_name
    ORDER BY leaf_count DESC, root_category_name
  `).all(platform) as Array<{ root_category_name: string; leaf_count: number }>

  return c.json({ latest_batch: latestBatch, counts, roots })
})

// GET /api/metadata/sync-jobs/:jobId
metadata.get("/sync-jobs/:jobId", (c) => {
  const job = metadataSyncJobs.get(c.req.param("jobId"))
  if (!job) {
    throw new HTTPException(404, { message: "Metadata sync job not found" })
  }
  return c.json(snapshotJob(job))
})

// POST /api/metadata/sync-jobs
metadata.post("/sync-jobs", async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const job = enqueueMetadataSyncJob(readMetadataSyncOptions(body))
  return c.json(job, 202)
})

// GET /api/metadata/categories/search?q=keyword&limit=20
metadata.get("/categories/search", (c) => {
  const db = getDb()
  const platform = "SHEIN"
  const q = c.req.query("q") ?? ""
  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 200)

  if (!q.trim()) {
    return c.json({ categories: [] })
  }

  const like = `%${q}%`
  const categories = db.prepare(`
    SELECT category_id, product_type_id, category_name, root_category_name,
      level, path, last_category
    FROM channel_category
    WHERE platform = ?
      AND (category_name LIKE ? OR path LIKE ?)
    ORDER BY last_category DESC, path
    LIMIT ?
  `).all(platform, like, like, limit)

  return c.json({ categories })
})

// GET /api/metadata/categories/roots - all root categories with leaf counts
metadata.get("/categories/roots", (c) => {
  const db = getDb()
  const platform = "SHEIN"

  const roots = db.prepare(`
    SELECT root_category_name, root_category_id, count(*) as leaf_count
    FROM channel_category
    WHERE platform = ?
      AND last_category = 1
    GROUP BY root_category_name, root_category_id
    ORDER BY leaf_count DESC, root_category_name
  `).all(platform)

  return c.json({ roots })
})

// GET /api/metadata/categories/tree?root=name - leaf categories under a root
metadata.get("/categories/tree", (c) => {
  const db = getDb()
  const platform = "SHEIN"
  const root = c.req.query("root")

  if (!root) {
    return c.json({ error: "root parameter required" }, 400)
  }

  const categories = db.prepare(`
    SELECT category_id, product_type_id, parent_category_id, category_name,
      root_category_id, root_category_name, level, path, last_category
    FROM channel_category
    WHERE platform = ?
      AND root_category_name = ?
    ORDER BY path
  `).all(platform, root)

  return c.json({ categories })
})

// GET /api/metadata/categories/:id
metadata.get("/categories/:id", (c) => {
  const db = getDb()
  const platform = "SHEIN"
  const categoryId = Number(c.req.param("id"))

  const category = db.prepare(`
    SELECT category_id, product_type_id, parent_category_id, category_name,
      root_category_id, root_category_name, level, path, last_category
    FROM channel_category
    WHERE platform = ?
      AND category_id = ?
  `).get(platform, categoryId)

  if (!category) {
    return c.json({ error: "Category not found" }, 404)
  }

  const cat = category as { product_type_id: number }

  const publishStandard = db.prepare(`
    SELECT default_language, currency, support_sale_attribute_sort, trace_id
    FROM channel_publish_standard
    WHERE platform = ?
      AND standard_scope = 'category'
      AND category_id = ?
  `).get(platform, categoryId) ?? null

  const requiredFields = db.prepare(`
    SELECT module, field_key, required, show
    FROM channel_publish_field
    WHERE platform = ?
      AND standard_scope = 'category'
      AND category_id = ?
      AND show = 1
      AND required = 1
    ORDER BY module, field_key
  `).all(platform, categoryId)

  const visibleFields = db.prepare(`
    SELECT module, field_key, required, show
    FROM channel_publish_field
    WHERE platform = ?
      AND standard_scope = 'category'
      AND category_id = ?
      AND show = 1
    ORDER BY required DESC, module, field_key
  `).all(platform, categoryId)

  const pictureConfig = db.prepare(`
    SELECT field_key, is_true
    FROM channel_picture_config
    WHERE platform = ?
      AND standard_scope = 'category'
      AND category_id = ?
    ORDER BY field_key
  `).all(platform, categoryId) as PictureConfigRow[]

  const requiredAttributes = db.prepare(`
    SELECT attribute_id, attribute_name, attribute_name_en, attribute_type,
      attribute_mode, attribute_status, values_count
    FROM channel_required_attribute
    WHERE platform = ?
      AND category_id = ?
    ORDER BY attribute_type, attribute_name
  `).all(platform, categoryId)

  const saleAttributes = db.prepare(`
    SELECT attribute_id, attribute_name, attribute_name_en, attribute_type,
      attribute_mode, attribute_status, values_count
    FROM channel_attribute
    WHERE platform = ?
      AND product_type_id = ?
      AND is_sale_attribute = 1
    ORDER BY attribute_name
  `).all(platform, cat.product_type_id)

  return c.json({
    category,
    publish_standard: publishStandard,
    required_fields: requiredFields,
    visible_fields: visibleFields,
    picture_config: pictureConfig,
    picture_requirements: buildPictureRequirements(pictureConfig),
    sale_attributes: saleAttributes,
    required_attributes: requiredAttributes,
  })
})

// GET /api/metadata/product-types/:id
metadata.get("/product-types/:id", (c) => {
  const db = getDb()
  const platform = "SHEIN"
  const productTypeId = Number(c.req.param("id"))
  const limit = Math.min(Number(c.req.query("limit") ?? "100"), 500)

  const template = db.prepare(`
    SELECT product_type_id, attr_count, required_count, sale_attributes_json
    FROM channel_attribute_template
    WHERE platform = ?
      AND product_type_id = ?
  `).get(platform, productTypeId) as { sale_attributes_json: string } | undefined

  if (!template) {
    return c.json({ error: "Product type not found" }, 404)
  }

  let saleAttributesJson = null
  try {
    saleAttributesJson = JSON.parse(template.sale_attributes_json)
  } catch { /* ignore */ }

  const attributes = db.prepare(`
    SELECT attribute_id, attribute_name, attribute_name_en, attribute_type,
      attribute_mode, attribute_status, attribute_input_num, values_count,
      is_required, is_sale_attribute, is_size_attribute
    FROM channel_attribute
    WHERE platform = ?
      AND product_type_id = ?
    ORDER BY is_required DESC, is_sale_attribute DESC, attribute_type, attribute_name
    LIMIT ?
  `).all(platform, productTypeId, limit)

  return c.json({
    template: { ...template, sale_attributes_json: saleAttributesJson },
    attributes,
  })
})

// GET /api/metadata/product-types/:id/attributes/:attrId/values
metadata.get("/product-types/:id/attributes/:attrId/values", (c) => {
  const db = getDb()
  const platform = "SHEIN"
  const productTypeId = Number(c.req.param("id"))
  const attributeId = Number(c.req.param("attrId"))
  const limit = Math.min(Number(c.req.query("limit") ?? "200"), 1000)

  const values = db.prepare(`
    SELECT attribute_value_id, attribute_value, attribute_value_en,
      is_custom_attribute_value, is_show, is_black, color
    FROM channel_attribute_value
    WHERE platform = ?
      AND product_type_id = ?
      AND attribute_id = ?
    ORDER BY attribute_value
    LIMIT ?
  `).all(platform, productTypeId, attributeId, limit)

  return c.json({ values, total: values.length })
})

export default metadata
