import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Database,
  ChevronRight,
  Search,
  FolderTree,
  FileText,
  ImageIcon,
  Tags,
  ListChecks,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatNumber, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { StatCard } from "@/components/stat-card"
import { EmptyState } from "@/components/empty-state"
import { JsonViewer } from "@/components/json-viewer"

// --- Types ---

interface SyncBatch {
  id: number
  batch_no: string
  status: string
  started_at: string
  finished_at: string
  source_dir: string
  total_count: number
  success_count: number
  failed_count: number
}

interface RootSummary {
  root_category_name: string
  root_category_id?: number
  leaf_count: number
}

interface MetadataSummary {
  latest_batch: SyncBatch | null
  counts: Record<string, number>
  roots: RootSummary[]
}

interface MetadataSyncJob {
  id: string
  status: "queued" | "running" | "completed" | "failed"
  stage: "queued" | "sync" | "import" | "completed" | "failed"
  options: {
    roots: string[]
    limitLeaves: number | null
    standardConcurrency: number
    attributeConcurrency: number
    skipStandards: boolean
    skipAttributes: boolean
    skipAttributeValues: boolean
  }
  total_count: number
  completed_count: number
  failed_count: number
  source_dir: string | null
  logs: string[]
  error: string | null
}

interface CategoryNode {
  category_id: number
  product_type_id: number
  parent_category_id: number | null
  category_name: string
  root_category_id: number
  root_category_name: string
  level: number
  path: string
  last_category: number
}

interface CategoryDetail {
  category: CategoryNode
  publish_standard: {
    default_language: string
    currency: string
    support_sale_attribute_sort: number
    trace_id: string
  } | null
  required_fields: Array<{
    module: string
    field_key: string
    required: number
    show: number
  }>
  visible_fields: Array<{
    module: string
    field_key: string
    required: number
    show: number
  }>
  picture_config: Array<{
    field_key: string
    is_true: number
  }>
  picture_requirements?: PictureRequirement[]
  sale_attributes: AttributeRow[]
  required_attributes: AttributeRow[]
}

interface PictureRequirement {
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

interface AttributeRow {
  attribute_id: number
  attribute_name: string
  attribute_name_en: string | null
  attribute_type: number
  attribute_mode: number
  attribute_status: number
  values_count: number
  attribute_input_num?: number
  is_required?: number
  is_sale_attribute?: number
  is_size_attribute?: number
}

interface ProductTypeDetail {
  template: {
    product_type_id: number
    attr_count: number
    required_count: number
    sale_attributes_json: unknown
  }
  attributes: AttributeRow[]
}

interface AttributeValue {
  attribute_value_id: number
  attribute_value: string
  attribute_value_en: string | null
  is_custom_attribute_value: number
  is_show: number
  is_black: number
  color: string | null
}

const badgeTone = {
  required: "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]",
  info: "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]",
  success: "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]",
}

// --- API hooks ---

function useSummary() {
  return useQuery<MetadataSummary>({
    queryKey: ["metadata", "summary"],
    queryFn: () => api.get("/metadata/summary"),
  })
}

function useCategoryTree(root: string | null) {
  return useQuery<{ categories: CategoryNode[] }>({
    queryKey: ["metadata", "categories", "tree", root],
    queryFn: () => api.get(`/metadata/categories/tree?root=${encodeURIComponent(root!)}`),
    enabled: !!root,
  })
}

function useCategorySearch(q: string) {
  return useQuery<{ categories: CategoryNode[] }>({
    queryKey: ["metadata", "categories", "search", q],
    queryFn: () => api.get(`/metadata/categories/search?q=${encodeURIComponent(q)}&limit=50`),
    enabled: q.length >= 2,
  })
}

function useCategoryDetail(id: number | null) {
  return useQuery<CategoryDetail>({
    queryKey: ["metadata", "categories", id],
    queryFn: () => api.get(`/metadata/categories/${id}`),
    enabled: id !== null,
  })
}

function useProductType(id: number | null) {
  return useQuery<ProductTypeDetail>({
    queryKey: ["metadata", "product-types", id],
    queryFn: () => api.get(`/metadata/product-types/${id}?limit=200`),
    enabled: id !== null,
  })
}

function useAttributeValues(productTypeId: number | null, attributeId: number | null) {
  return useQuery<{ values: AttributeValue[] }>({
    queryKey: ["metadata", "product-types", productTypeId, "attributes", attributeId, "values"],
    queryFn: () =>
      api.get(`/metadata/product-types/${productTypeId}/attributes/${attributeId}/values?limit=500`),
    enabled: productTypeId !== null && attributeId !== null,
  })
}

// --- Main Page ---

export default function SheinMetadataPage() {
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [selectedAttribute, setSelectedAttribute] = useState<AttributeRow | null>(null)
  const [searchText, setSearchText] = useState("")
  const [syncRoots, setSyncRoots] = useState("")
  const [limitLeaves, setLimitLeaves] = useState("")
  const [standardConcurrency, setStandardConcurrency] = useState("12")
  const [attributeConcurrency, setAttributeConcurrency] = useState("8")
  const [skipStandards, setSkipStandards] = useState(false)
  const [skipAttributes, setSkipAttributes] = useState(false)
  const [skipAttributeValues, setSkipAttributeValues] = useState(false)
  const [syncJobId, setSyncJobId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(searchText, 300)
  const queryClient = useQueryClient()

  const { data: summary, isLoading: summaryLoading } = useSummary()
  const { data: syncJob } = useQuery<MetadataSyncJob>({
    queryKey: ["metadata", "sync-jobs", syncJobId],
    queryFn: () => api.get(`/metadata/sync-jobs/${syncJobId}`),
    enabled: Boolean(syncJobId),
    refetchInterval: (query) => {
      const job = query.state.data
      return job && ["queued", "running"].includes(job.status) ? 1500 : false
    },
    refetchOnWindowFocus: false,
  })

  const syncMutation = useMutation({
    mutationFn: () =>
      api.post<MetadataSyncJob>("/metadata/sync-jobs", {
        roots: syncRoots,
        limitLeaves: limitLeaves.trim() ? Number(limitLeaves) : null,
        standardConcurrency: Number(standardConcurrency),
        attributeConcurrency: Number(attributeConcurrency),
        skipStandards,
        skipAttributes,
        skipAttributeValues,
      }),
    onSuccess: (result) => {
      setSyncJobId(result.id)
      toast.success("SHEIN 元数据同步已启动")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "同步启动失败")
    },
  })

  useEffect(() => {
    if (syncJob?.status === "completed") {
      void queryClient.invalidateQueries({ queryKey: ["metadata"] })
    }
  }, [queryClient, syncJob?.status])

  const syncProgress = syncJob
    ? Math.round((syncJob.completed_count / Math.max(syncJob.total_count, 1)) * 100)
    : 0
  const syncInFlight = syncJob
    ? ["queued", "running"].includes(syncJob.status)
    : false
  const syncStageText = syncJob
    ? ({
        queued: "排队中",
        sync: "同步中",
        import: "导入中",
        completed: "已完成",
        failed: "失败",
      }[syncJob.stage])
    : null

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="SHEIN 元数据"
        description="浏览 SHEIN 类目树、发布字段、图片规则和属性模板，作为刊登草稿与发布校验的规则来源。"
      >
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              <RefreshCw className="size-4" />
              同步元数据
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>同步元数据</DialogTitle>
              <DialogDescription>
                触发 SHEIN 类目树、发布标准和属性模板同步，同步完成后会自动导入当前数据库。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="metadata-sync-roots">根类目筛选</Label>
                <Input
                  id="metadata-sync-roots"
                  value={syncRoots}
                  onChange={(event) => setSyncRoots(event.target.value)}
                  placeholder="留空同步全部；可填 儿童,婴儿 或类目 ID"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="metadata-limit-leaves">叶子类目上限</Label>
                  <Input
                    id="metadata-limit-leaves"
                    value={limitLeaves}
                    onChange={(event) => setLimitLeaves(event.target.value)}
                    inputMode="numeric"
                    placeholder="不限"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metadata-standard-concurrency">发布标准并发</Label>
                  <Input
                    id="metadata-standard-concurrency"
                    value={standardConcurrency}
                    onChange={(event) => setStandardConcurrency(event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metadata-attribute-concurrency">属性模板并发</Label>
                  <Input
                    id="metadata-attribute-concurrency"
                    value={attributeConcurrency}
                    onChange={(event) => setAttributeConcurrency(event.target.value)}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <Label className="rounded-xl border p-3 font-normal">
                  <Checkbox
                    checked={skipStandards}
                    onCheckedChange={(checked) => setSkipStandards(checked === true)}
                  />
                  跳过发布标准
                </Label>
                <Label className="rounded-xl border p-3 font-normal">
                  <Checkbox
                    checked={skipAttributes}
                    onCheckedChange={(checked) => setSkipAttributes(checked === true)}
                  />
                  跳过属性模板
                </Label>
                <Label className="rounded-xl border p-3 font-normal">
                  <Checkbox
                    checked={skipAttributeValues}
                    onCheckedChange={(checked) => setSkipAttributeValues(checked === true)}
                  />
                  不导入枚举值
                </Label>
              </div>
              <Button
                type="button"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || syncInFlight}
                className="w-full sm:w-auto"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                启动同步
              </Button>
              {syncJob ? (
                <div className="space-y-3 rounded-2xl border bg-muted/40 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">任务状态：{syncStageText}</span>
                    <span className="text-muted-foreground">
                      {syncJob.completed_count}/{syncJob.total_count}
                    </span>
                  </div>
                  <Progress value={syncProgress} />
                  <div className="text-xs text-muted-foreground">
                    {syncJob.source_dir ? `输出目录：${syncJob.source_dir}` : "等待开始"}
                    {syncJob.error ? `；错误：${syncJob.error}` : ""}
                  </div>
                  {syncJob.logs.length ? (
                    <div className="max-h-32 overflow-auto rounded-xl bg-background p-3 font-mono text-xs text-muted-foreground">
                      {syncJob.logs.slice(-8).map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>
      {/* Summary header */}
      <SummaryHeader summary={summary} loading={summaryLoading} />

      {/* Main content: left tree + right detail */}
      <div className="flex min-h-0 flex-col gap-4 xl:flex-row">
        {/* Left: category tree */}
        <div className="flex shrink-0 flex-col gap-3 xl:w-[340px]">
          <SearchBox value={searchText} onChange={setSearchText} />
          {debouncedSearch.length >= 2 ? (
            <SearchResults
              query={debouncedSearch}
              onSelect={(id) => {
                setSelectedCategoryId(id)
                setSelectedAttribute(null)
              }}
              selectedId={selectedCategoryId}
            />
          ) : (
            <CategoryTree
              roots={summary?.roots ?? []}
              selectedRoot={selectedRoot}
              onSelectRoot={setSelectedRoot}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={(id) => {
                setSelectedCategoryId(id)
                setSelectedAttribute(null)
              }}
            />
          )}
        </div>

        {/* Right: detail */}
        <div className="min-w-0 flex-1">
          {selectedCategoryId ? (
            <CategoryDetailPanel
              categoryId={selectedCategoryId}
              selectedAttribute={selectedAttribute}
              onSelectAttribute={setSelectedAttribute}
            />
          ) : (
            <Card className="flex min-h-[460px] items-center justify-center">
              <EmptyState message="从左侧选择一个叶子类目查看详情" />
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

// --- Sub-components ---

function SummaryHeader({
  summary,
  loading,
}: {
  summary: MetadataSummary | undefined
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    )
  }
  if (!summary) return null

  const totalLeaves = summary.roots.reduce((s, r) => s + r.leaf_count, 0)

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
      <StatCard
        title="叶子类目"
        value={formatNumber(totalLeaves)}
        icon={FolderTree}
        description={`${summary.roots.length} 个根类目`}
      />
      <StatCard
        title="属性模板"
        value={formatNumber(summary.counts.channel_attribute_template)}
        icon={Tags}
      />
      <StatCard
        title="属性枚举值"
        value={formatNumber(summary.counts.channel_attribute_value)}
        icon={Database}
      />
      <StatCard
        title="最后同步"
        value={summary.latest_batch ? formatDateTime(summary.latest_batch.finished_at) : "—"}
        icon={Database}
        description={summary.latest_batch ? `批次 ${summary.latest_batch.batch_no}` : undefined}
      />
    </div>
  )
}

function SearchBox({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索类目名称或路径…"
        className="h-10 pl-9"
      />
    </div>
  )
}

function SearchResults({
  query,
  onSelect,
  selectedId,
}: {
  query: string
  onSelect: (id: number) => void
  selectedId: number | null
}) {
  const { data, isLoading } = useCategorySearch(query)

  return (
    <Card className="min-h-0 flex-1">
      <CardHeader className="px-4 py-3">
        <CardTitle className="font-mono text-xs uppercase tracking-[0.6px] text-muted-foreground">
          搜索结果
        </CardTitle>
      </CardHeader>
      <ScrollArea className="h-[420px] xl:h-[calc(100vh-390px)]">
        <div className="px-2 pb-3">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !data?.categories.length ? (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">
              未找到匹配类目
            </p>
          ) : (
            data.categories.map((cat) => (
              <button
                key={cat.category_id}
                onClick={() => onSelect(cat.category_id)}
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60",
                  selectedId === cat.category_id && "bg-accent font-medium",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{cat.category_name}</span>
                  {cat.last_category === 1 && (
                    <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px]">
                      叶子
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{cat.path}</p>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  )
}

function CategoryTree({
  roots,
  selectedRoot,
  onSelectRoot,
  selectedCategoryId,
  onSelectCategory,
}: {
  roots: RootSummary[]
  selectedRoot: string | null
  onSelectRoot: (root: string | null) => void
  selectedCategoryId: number | null
  onSelectCategory: (id: number) => void
}) {
  return (
    <Card className="min-h-0 flex-1">
      <CardHeader className="px-4 py-3">
        <CardTitle className="font-mono text-xs uppercase tracking-[0.6px] text-muted-foreground">
          类目树
        </CardTitle>
      </CardHeader>
      <ScrollArea className="h-[420px] xl:h-[calc(100vh-390px)]">
        <div className="px-2 pb-3">
          {roots.map((root) => (
            <RootGroup
              key={root.root_category_name}
              root={root}
              isOpen={selectedRoot === root.root_category_name}
              onToggle={() =>
                onSelectRoot(
                  selectedRoot === root.root_category_name
                    ? null
                    : root.root_category_name,
                )
              }
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={onSelectCategory}
            />
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
}

function RootGroup({
  root,
  isOpen,
  onToggle,
  selectedCategoryId,
  onSelectCategory,
}: {
  root: RootSummary
  isOpen: boolean
  onToggle: () => void
  selectedCategoryId: number | null
  onSelectCategory: (id: number) => void
}) {
  const { data, isLoading } = useCategoryTree(
    isOpen ? root.root_category_name : null,
  )

  const leafCategories = data?.categories.filter((c) => c.last_category === 1) ?? []

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent/60">
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            isOpen && "rotate-90",
          )}
        />
        <FolderTree className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{root.root_category_name}</span>
        <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px]">
          {root.leaf_count}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 border-l pl-2">
          {isLoading ? (
            <div className="space-y-1 py-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            leafCategories.map((cat) => (
              <button
                key={cat.category_id}
                onClick={() => onSelectCategory(cat.category_id)}
                className={cn(
                  "flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent/60",
                  selectedCategoryId === cat.category_id &&
                    "bg-accent font-medium",
                )}
              >
                <span className="truncate">{cat.category_name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {cat.category_id}
                </span>
              </button>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function CategoryDetailPanel({
  categoryId,
  selectedAttribute,
  onSelectAttribute,
}: {
  categoryId: number
  selectedAttribute: AttributeRow | null
  onSelectAttribute: (attribute: AttributeRow | null) => void
}) {
  const { data, isLoading } = useCategoryDetail(categoryId)
  const productTypeId = data?.category.product_type_id ?? null
  const { data: ptData } = useProductType(productTypeId)
  const selectedAttributeId = selectedAttribute?.attribute_id ?? null

  if (isLoading) {
    return (
      <Card className="space-y-3 p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </Card>
    )
  }

  if (!data) {
    return <EmptyState message="未找到类目数据" />
  }

  const { category, publish_standard } = data

  return (
    <div className="flex flex-col gap-4">
      {/* Category info header */}
      <Card>
        <CardContent className="px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold leading-[1.2] tracking-[-0.24px]">
                {category.category_name}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{category.path}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">ID: {category.category_id}</Badge>
              <Badge variant="outline">
                商品类型: {category.product_type_id}
              </Badge>
              {publish_standard && (
                <>
                  <Badge variant="secondary">
                    {publish_standard.default_language}
                  </Badge>
                  <Badge variant="secondary">{publish_standard.currency}</Badge>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed detail panels */}
      <Tabs defaultValue="fields" className="flex-1">
        <TabsList>
          <TabsTrigger value="fields" className="gap-1">
            <FileText className="size-3.5" />
            发布字段
          </TabsTrigger>
          <TabsTrigger value="pictures" className="gap-1">
            <ImageIcon className="size-3.5" />
            图片规则
          </TabsTrigger>
          <TabsTrigger value="attributes" className="gap-1">
            <Tags className="size-3.5" />
            属性模板
          </TabsTrigger>
          <TabsTrigger value="required" className="gap-1">
            <ListChecks className="size-3.5" />
            必填属性
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="mt-3">
          <FieldsPanel data={data} />
        </TabsContent>

        <TabsContent value="pictures" className="mt-3">
          <PictureConfigPanel data={data} />
        </TabsContent>

        <TabsContent value="attributes" className="mt-3">
          <AttributeTemplatePanel
            ptData={ptData}
            selectedAttributeId={selectedAttributeId}
            onSelectAttribute={onSelectAttribute}
          />
        </TabsContent>

        <TabsContent value="required" className="mt-3">
          <RequiredAttributesPanel
            data={data}
            productTypeId={productTypeId}
            selectedAttributeId={selectedAttributeId}
            onSelectAttribute={onSelectAttribute}
          />
        </TabsContent>
      </Tabs>

      <AttributeValuesSheet
        productTypeId={productTypeId}
        attribute={selectedAttribute}
        onOpenChange={(open) => {
          if (!open) onSelectAttribute(null)
        }}
      />
    </div>
  )
}

function FieldsPanel({ data }: { data: CategoryDetail }) {
  const { visible_fields, required_fields } = data

  // Group by module
  const modules = new Map<string, typeof visible_fields>()
  for (const f of visible_fields) {
    const arr = modules.get(f.module) ?? []
    arr.push(f)
    modules.set(f.module, arr)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 font-mono text-xs uppercase tracking-[0.6px] text-muted-foreground">
        <span>可见字段: {visible_fields.length}</span>
        <span>|</span>
        <span>必填字段: {required_fields.length}</span>
      </div>

      {Array.from(modules.entries()).map(([module, fields]) => (
        <Card key={module}>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base">{module}</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">字段</TableHead>
                  <TableHead className="h-8 text-xs w-20">必填</TableHead>
                  <TableHead className="h-8 text-xs w-20">可见</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((f) => (
                  <TableRow key={`${f.module}-${f.field_key}`}>
                    <TableCell className="py-1.5 text-xs font-mono">
                      {f.field_key}
                    </TableCell>
                    <TableCell className="py-1.5">
                      {f.required === 1 ? (
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", badgeTone.required)}
                        >
                          必填
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5">
                      {f.show === 1 ? (
                        <span className="text-xs text-[#0fa76e]">可见</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">隐藏</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PictureConfigPanel({ data }: { data: CategoryDetail }) {
  const { picture_config, picture_requirements } = data
  const requirements = picture_requirements?.length
    ? picture_requirements
    : buildPictureRequirementsFromConfig(picture_config)
  const requiredCount = requirements.filter((p) => p.required === 1).length
  const hiddenCount = requirements.filter((p) => p.show === 0).length
  const pictureMode =
    picture_config.length === 1 &&
    picture_config[0]?.field_key === "switch_spu_picture"
      ? "旧方案"
      : "新方案"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 font-mono text-xs uppercase tracking-[0.6px] text-muted-foreground">
        <span>图片方案: {pictureMode}</span>
        <span>图片字段: {picture_config.length}</span>
        <span>必填图片组: {requiredCount}</span>
        <span>不展示图片组: {hiddenCount}</span>
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 w-40 text-xs">图片类型</TableHead>
                <TableHead className="h-8 w-24 text-xs">当前要求</TableHead>
                <TableHead className="h-8 text-xs">张数 / 入参</TableHead>
                <TableHead className="h-8 text-xs">尺寸要求</TableHead>
                <TableHead className="h-8 w-28 text-xs">格式</TableHead>
                <TableHead className="h-8 w-24 text-xs">大小</TableHead>
                <TableHead className="h-8 text-xs">依据字段</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requirements.map((item) => (
                <TableRow key={item.key}>
                  <TableCell className="py-2 text-xs">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.level} / {item.image_type}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <PictureRequirementBadge requirement={item} />
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <div>{item.count_rule}</div>
                    {item.note && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {item.note}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    {item.dimension_rule}
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    {item.format_rule}
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    {item.size_rule}
                  </TableCell>
                  <TableCell className="py-2">
                    <PictureFieldEvidence fields={item.field_keys} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
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

function buildPictureRequirementsFromConfig(
  config: CategoryDetail["picture_config"],
): PictureRequirement[] {
  const configMap = new Map(config.map((item) => [item.field_key, item.is_true]))
  const value = (fieldKey: string) => configMap.get(fieldKey) ?? null
  const field = (fieldKey: string) => ({
    field_key: fieldKey,
    is_true: value(fieldKey),
  })
  const singleType = (single: number | null) =>
    single === 1 ? "1-主图" : "1-主图；2-细节图"
  const detailCount = (single: number | null) =>
    single === 1 ? "最多 1 张主图" : "主图最多 1 张；细节图最多 10 张"

  const requirements: PictureRequirement[] = [
    {
      key: "spu-detail",
      name: "SPU 轮播图",
      level: "SPU",
      show: value("spu_image_detail_show"),
      required: value("spu_image_detail_required"),
      single: value("spu_image_detail_single"),
      image_type: singleType(value("spu_image_detail_single")),
      count_rule: detailCount(value("spu_image_detail_single")),
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
      show: value("spu_image_square_show"),
      required: value("spu_image_square_required"),
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
      show: value("skc_image_detail_show"),
      required: value("skc_image_detail_required"),
      single: value("skc_image_detail_single"),
      image_type: singleType(value("skc_image_detail_single")),
      count_rule: detailCount(value("skc_image_detail_single")),
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
      show: value("skc_image_square_show"),
      required: value("skc_image_square_required"),
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

function PictureRequirementBadge({
  requirement,
}: {
  requirement: PictureRequirement
}) {
  if (requirement.show === 0) {
    return <span className="text-xs text-muted-foreground">不展示</span>
  }

  if (requirement.required === 1) {
    return (
      <Badge
        variant="outline"
        className={cn("text-[10px]", badgeTone.required)}
      >
        必填
      </Badge>
    )
  }

  if (requirement.required === 0) {
    return <span className="text-xs text-muted-foreground">可选</span>
  }

  return (
    <Badge variant="secondary" className="text-[10px]">
      条件必填
    </Badge>
  )
}

function PictureFieldEvidence({
  fields,
}: {
  fields: PictureRequirement["field_keys"]
}) {
  if (fields.length === 0) {
    return <span className="text-xs text-muted-foreground">规则固定</span>
  }

  return (
    <div className="space-y-0.5">
      {fields.map((field) => (
        <div
          key={field.field_key}
          className="flex items-center gap-1 text-[10px] text-muted-foreground"
        >
          <span className="font-mono">{field.field_key}</span>
          <span>
            {field.is_true === null ? "—" : field.is_true === 1 ? "true" : "false"}
          </span>
        </div>
      ))}
    </div>
  )
}

function AttributeTemplatePanel({
  ptData,
  selectedAttributeId,
  onSelectAttribute,
}: {
  ptData: ProductTypeDetail | undefined
  selectedAttributeId: number | null
  onSelectAttribute: (attribute: AttributeRow) => void
}) {
  if (!ptData) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 font-mono text-xs uppercase tracking-[0.6px] text-muted-foreground">
        <span>商品类型 ID: {ptData.template.product_type_id}</span>
        <span>属性总数: {ptData.template.attr_count}</span>
        <span>必填: {ptData.template.required_count}</span>
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 text-xs w-14">ID</TableHead>
                <TableHead className="h-8 text-xs">属性名称</TableHead>
                <TableHead className="h-8 text-xs w-16">类型</TableHead>
                <TableHead className="h-8 text-xs w-14">必填</TableHead>
                <TableHead className="h-8 text-xs w-14">销售</TableHead>
                <TableHead className="h-8 text-xs w-14">尺码</TableHead>
                <TableHead className="h-8 text-xs w-24">枚举值</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ptData.attributes.map((attr) => (
                <TableRow
                  key={attr.attribute_id}
                  className={cn(
                    selectedAttributeId === attr.attribute_id && "bg-accent/70",
                  )}
                >
                  <TableCell className="py-1.5 text-xs tabular-nums">
                    {attr.attribute_id}
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">
                    <div>{attr.attribute_name}</div>
                    {attr.attribute_name_en && (
                      <div className="text-[10px] text-muted-foreground">
                        {attr.attribute_name_en}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5 text-xs tabular-nums">
                    {attr.attribute_type}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {attr.is_required === 1 ? (
                      <Badge
                        variant="outline"
                        className={cn("px-1 text-[10px]", badgeTone.required)}
                      >
                        是
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {attr.is_sale_attribute === 1 ? (
                      <Badge
                        variant="outline"
                        className={cn("px-1 text-[10px]", badgeTone.info)}
                      >
                        是
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {attr.is_size_attribute === 1 ? (
                      <Badge
                        variant="outline"
                        className={cn("px-1 text-[10px]", badgeTone.success)}
                      >
                        是
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <AttributeValueAction
                      attribute={attr}
                      selected={selectedAttributeId === attr.attribute_id}
                      onSelectAttribute={onSelectAttribute}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {ptData.template.sale_attributes_json != null && (
        <JsonViewer
          data={ptData.template.sale_attributes_json}
          label="sale_attributes_json (原始)"
        />
      )}
    </div>
  )
}

function AttributeValueAction({
  attribute,
  selected,
  onSelectAttribute,
}: {
  attribute: AttributeRow
  selected: boolean
  onSelectAttribute: (attribute: AttributeRow) => void
}) {
  if (attribute.values_count <= 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <Button
      type="button"
      variant={selected ? "secondary" : "ghost"}
      size="xs"
      className="h-6 px-2 font-normal tabular-nums"
      onClick={() => onSelectAttribute(attribute)}
      aria-label={`查看 ${attribute.attribute_name} 的 ${attribute.values_count} 个枚举值`}
    >
      查看
    </Button>
  )
}

function AttributeValuesSheet({
  productTypeId,
  attribute,
  onOpenChange,
}: {
  productTypeId: number | null
  attribute: AttributeRow | null
  onOpenChange: (open: boolean) => void
}) {
  const open = attribute !== null
  const { data, isLoading } = useAttributeValues(
    productTypeId,
    attribute?.attribute_id ?? null,
  )
  const values = data?.values ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(760px,calc(100vw-2rem))] gap-0 p-0 sm:max-w-none">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="pr-8">
            {attribute ? `${attribute.attribute_name} 枚举值` : "属性枚举值"}
          </SheetTitle>
          <SheetDescription>
            {attribute
              ? `属性 ID: ${attribute.attribute_id}，共 ${attribute.values_count} 个`
              : "查看属性可用值"}
          </SheetDescription>
        </SheetHeader>

        {attribute?.attribute_name_en && (
          <div className="border-b px-5 py-2 text-xs text-muted-foreground">
            {attribute.attribute_name_en}
          </div>
        )}

        <div className="min-h-0 flex-1">
          {isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : values.length === 0 ? (
            <div className="flex h-full items-center justify-center p-5">
              <EmptyState message="该属性没有枚举值" />
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="px-5 py-4">
                <div className="overflow-hidden rounded-2xl border">
                  <AttributeValuesTable values={values} />
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function AttributeValuesTable({ values }: { values: AttributeValue[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-8 w-24 text-xs">ID</TableHead>
          <TableHead className="h-8 text-xs">值</TableHead>
          <TableHead className="h-8 text-xs">英文值</TableHead>
          <TableHead className="h-8 w-16 text-xs">可见</TableHead>
          <TableHead className="h-8 w-16 text-xs">禁用</TableHead>
          <TableHead className="h-8 w-24 text-xs">颜色</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {values.map((v) => (
          <TableRow key={v.attribute_value_id}>
            <TableCell className="py-1.5 text-xs tabular-nums">
              {v.attribute_value_id}
            </TableCell>
            <TableCell className="py-1.5 text-xs">
              {v.attribute_value}
            </TableCell>
            <TableCell className="py-1.5 text-xs text-muted-foreground">
              {v.attribute_value_en || "—"}
            </TableCell>
            <TableCell className="py-1.5 text-xs">
              {v.is_show === 1 ? "可见" : "隐藏"}
            </TableCell>
            <TableCell className="py-1.5 text-xs">
              {v.is_black === 1 ? (
                <span className="text-[#d45656]">禁用</span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="py-1.5">
              {v.color ? (
                <div className="flex items-center gap-1">
                  <div
                    className="size-3 rounded border"
                    style={{ backgroundColor: v.color }}
                  />
                  <span className="text-[10px]">{v.color}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RequiredAttributesPanel({
  data,
  productTypeId,
  selectedAttributeId,
  onSelectAttribute,
}: {
  data: CategoryDetail
  productTypeId: number | null
  selectedAttributeId: number | null
  onSelectAttribute: (attribute: AttributeRow) => void
}) {
  const { required_attributes, sale_attributes } = data

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 font-mono text-xs uppercase tracking-[0.6px] text-muted-foreground">
        <span>必填属性: {required_attributes.length}</span>
        <span>|</span>
        <span>销售属性: {sale_attributes.length}</span>
        {productTypeId !== null && (
          <>
            <span>|</span>
            <span>商品类型 ID: {productTypeId}</span>
          </>
        )}
      </div>

      {required_attributes.length > 0 && (
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base">必填属性</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs w-14">ID</TableHead>
                  <TableHead className="h-8 text-xs">名称</TableHead>
                  <TableHead className="h-8 text-xs w-16">类型</TableHead>
                  <TableHead className="h-8 text-xs w-16">状态</TableHead>
                  <TableHead className="h-8 text-xs w-24">枚举值</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {required_attributes.map((attr) => (
                  <TableRow
                    key={attr.attribute_id}
                    className={cn(
                      selectedAttributeId === attr.attribute_id && "bg-accent/70",
                    )}
                  >
                    <TableCell className="py-1.5 text-xs tabular-nums">
                      {attr.attribute_id}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">
                      <div>{attr.attribute_name}</div>
                      {attr.attribute_name_en && (
                        <div className="text-[10px] text-muted-foreground">
                          {attr.attribute_name_en}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs tabular-nums">
                      {attr.attribute_type}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">
                      {attr.attribute_status === 3 ? (
                        <Badge
                          variant="outline"
                          className={cn("px-1 text-[10px]", badgeTone.required)}
                        >
                          强制
                        </Badge>
                      ) : (
                        <span className="tabular-nums">{attr.attribute_status}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <AttributeValueAction
                        attribute={attr}
                        selected={selectedAttributeId === attr.attribute_id}
                        onSelectAttribute={onSelectAttribute}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {sale_attributes.length > 0 && (
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base">销售属性</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs w-14">ID</TableHead>
                  <TableHead className="h-8 text-xs">名称</TableHead>
                  <TableHead className="h-8 text-xs w-16">类型</TableHead>
                  <TableHead className="h-8 text-xs w-24">枚举值</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale_attributes.map((attr) => (
                  <TableRow
                    key={attr.attribute_id}
                    className={cn(
                      selectedAttributeId === attr.attribute_id && "bg-accent/70",
                    )}
                  >
                    <TableCell className="py-1.5 text-xs tabular-nums">
                      {attr.attribute_id}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">
                      <div>{attr.attribute_name}</div>
                      {attr.attribute_name_en && (
                        <div className="text-[10px] text-muted-foreground">
                          {attr.attribute_name_en}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs tabular-nums">
                      {attr.attribute_type}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <AttributeValueAction
                        attribute={attr}
                        selected={selectedAttributeId === attr.attribute_id}
                        onSelectAttribute={onSelectAttribute}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
