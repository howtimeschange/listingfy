import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  GitBranch,
  ImageOff,
  Layers3,
  Search,
  Sparkles,
  Split,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { EmptyState } from "@/components/empty-state"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface MappingRule {
  id: number
  mdm_middle_category_name: string
  mdm_small_category_name: string
  gender_name: string | null
  age_group_name: string | null
  match_mode: string
  match_key: string
  shein_category_id: number
  shein_product_type_id: number
  priority: number
  status: string
  source: string
  note: string | null
  updated_at: string | null
}

interface UnmappedGroup {
  match_key: string
  mdm_middle_category_code: string | null
  mdm_middle_category_name: string
  mdm_small_category_code: string | null
  mdm_small_category_name: string
  gender_code: string | null
  gender_name: string | null
  age_group_code: string | null
  age_group_name: string | null
  spec_range: string | null
  fabric_type_name: string | null
  model_name: string | null
  length_name: string | null
  deepdraw_category_name: string | null
  deepdraw_title: string | null
  trade_path: string | null
  spus: string[]
  spu_count: number
  skc_examples: SkcExample[]
}

interface SkcExample {
  spu_code: string
  skc_code: string
  color_code: string | null
  color_name: string | null
  mdm_image_url: string | null
  tmall_model_image_url: string | null
}

interface SheinCategoryCandidate {
  category_id: number
  product_type_id: number
  category_name: string
  path: string
  attr_count?: number
  required_count?: number
}

interface AiSuggestion {
  match_key: string
  status: "READY" | "AMBIGUOUS" | "NO_MATCH"
  confidence: number
  primary: SheinCategoryCandidate | null
  split_by_skc: boolean
  skc_suggestions: SkcSuggestion[]
  alternatives: SheinCategoryCandidate[]
  reasons: string[]
  risks: string[]
  group: UnmappedGroup | null
}

interface SkcSuggestion {
  spu_code: string
  skc_code: string
  color_name: string
  model_gender: string
  confidence: number
  primary: SheinCategoryCandidate | null
  alternatives: SheinCategoryCandidate[]
  reasons: string[]
}

interface RulesResponse {
  rules: MappingRule[]
}

interface UnmappedGroupsResponse {
  groups: UnmappedGroup[]
}

interface AiSuggestionsResponse {
  groups: UnmappedGroup[]
  candidates: SheinCategoryCandidate[]
  suggestions: AiSuggestion[]
  provider?: {
    baseUrl: string
    model: string
  }
}

function useCategoryRules(search: string) {
  return useQuery<RulesResponse>({
    queryKey: ["category-mapping", "rules", search],
    queryFn: () => api.get(`/category-mapping/rules?q=${encodeURIComponent(search)}`),
  })
}

function useUnmappedGroups() {
  return useQuery<UnmappedGroupsResponse>({
    queryKey: ["category-mapping", "unmapped-groups"],
    queryFn: () => api.get("/category-mapping/unmapped-groups?limit=80"),
  })
}

function useCategoryMatchSuggestions() {
  return useMutation<AiSuggestionsResponse>({
    mutationFn: () => api.post("/category-mapping/ai-suggestions", { limit: 30 }),
  })
}

function confidencePercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 0
  return Math.round(Math.max(0, Math.min(1, value)) * 100)
}

function confidenceTone(value: number) {
  if (value >= 0.8) return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (value >= 0.6) return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-rose-200 bg-rose-50 text-rose-700"
}

function statusLabel(status: AiSuggestion["status"]) {
  if (status === "READY") return "可确认"
  if (status === "AMBIGUOUS") return "有歧义"
  return "无匹配"
}

function categoryLabel(category: SheinCategoryCandidate | null | undefined) {
  if (!category) return "未推荐"
  return `${category.category_name} #${category.category_id}`
}

function groupLabel(group: UnmappedGroup | null | undefined) {
  if (!group) return "未知组合"
  return [
    group.mdm_middle_category_name,
    group.mdm_small_category_name,
    group.gender_name,
    group.age_group_name,
  ].filter(Boolean).join(" / ")
}

function FieldPill({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="rounded-xl border bg-background px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value ?? "—"}</div>
    </div>
  )
}

function CandidateCard({
  candidate,
  active,
  onSelect,
  disabled,
  actionLabel = "选择备选",
}: {
  candidate: SheinCategoryCandidate
  active?: boolean
  onSelect: () => void
  disabled?: boolean
  actionLabel?: string
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{candidate.category_name}</div>
          <div className="mt-1 break-words text-sm text-muted-foreground">
            {candidate.path}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline">category {candidate.category_id}</Badge>
            <Badge variant="outline">type {candidate.product_type_id}</Badge>
            {candidate.required_count != null ? (
              <Badge variant="outline">必填 {candidate.required_count}</Badge>
            ) : null}
          </div>
        </div>
        <Button
          size="sm"
          variant={active ? "default" : "outline"}
          onClick={onSelect}
          disabled={disabled}
          className="shrink-0"
        >
          {active ? "确认首选" : actionLabel}
        </Button>
      </div>
    </div>
  )
}

function SkcImageStrip({
  examples,
  suggestions = [],
  max = 6,
}: {
  examples: SkcExample[]
  suggestions?: SkcSuggestion[]
  max?: number
}) {
  const visible = examples.slice(0, max)
  if (visible.length === 0) {
    return <div className="text-sm text-muted-foreground">暂无 SKC 款色图</div>
  }

  return (
    <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
      {visible.map((example) => {
        const skcSuggestion = suggestions.find((item) => item.skc_code === example.skc_code)
        return (
          <div
            key={example.skc_code}
            className="w-[96px] shrink-0 overflow-hidden rounded-lg border bg-background"
          >
            <div className="relative h-[112px] w-full bg-muted">
              {example.tmall_model_image_url ? (
                <img
                  src={example.tmall_model_image_url}
                  alt={`${example.skc_code} TMALL 款色图`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageOff className="size-5" />
                </div>
              )}
              <Badge
                variant="outline"
                className="absolute left-1 top-1 max-w-[88px] truncate bg-background/90 px-1.5 py-0 text-[10px]"
              >
                {example.tmall_model_image_url ? "TMALL 模特图" : "缺模特图"}
              </Badge>
            </div>
            <div className="space-y-1 p-2">
              <div className="truncate text-xs font-medium">{example.skc_code}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {example.color_name ?? example.color_code ?? "未识别颜色"}
              </div>
              {skcSuggestion ? (
                <div className="flex items-center justify-between gap-1">
                  <Badge variant="outline" className="max-w-[52px] truncate px-1.5 py-0 text-[10px]">
                    {skcSuggestion.model_gender}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {confidencePercent(skcSuggestion.confidence)}%
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
      {examples.length > max ? (
        <div className="flex h-[112px] w-[72px] shrink-0 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
          +{examples.length - max}
        </div>
      ) : null}
    </div>
  )
}

function SkcSuggestionPanel({
  examples,
  suggestions,
}: {
  examples: SkcExample[]
  suggestions: SkcSuggestion[]
}) {
  if (examples.length === 0 && suggestions.length === 0) return null

  const exampleBySkc = new Map(examples.map((item) => [item.skc_code, item]))
  const rows = suggestions.length
    ? suggestions.map((suggestion) => ({
      suggestion,
      example: exampleBySkc.get(suggestion.skc_code) ?? null,
    }))
    : examples.map((example) => ({
      example,
      suggestion: null,
    }))

  return (
    <div className="mt-5 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Split className="size-4" />
            SKC 款色判断
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            同款不同色时，以 TMALL 款色图中的模特性别和颜色辅助判断男女类目。
          </div>
        </div>
        <Badge variant="outline">同款不同色</Badge>
      </div>

      <div className="mt-3">
        <SkcImageStrip examples={examples} suggestions={suggestions} max={8} />
      </div>

      {suggestions.length ? (
        <div className="mt-4 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKC</TableHead>
                <TableHead>模特/颜色</TableHead>
                <TableHead>SKC 建议类目</TableHead>
                <TableHead className="w-[92px]">置信度</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ suggestion, example }) => (
                <TableRow key={suggestion?.skc_code ?? example?.skc_code}>
                  <TableCell>
                    <div className="font-medium">{suggestion?.skc_code ?? example?.skc_code}</div>
                    <div className="text-xs text-muted-foreground">
                      {suggestion?.spu_code ?? example?.spu_code}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{suggestion?.model_gender ?? "未知"}</div>
                    <div className="text-xs text-muted-foreground">
                      {suggestion?.color_name || example?.color_name || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{categoryLabel(suggestion?.primary)}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {suggestion?.reasons.join("；") || "AI 未返回 SKC 级理由"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={confidenceTone(suggestion?.confidence ?? 0)}
                    >
                      {confidencePercent(suggestion?.confidence)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}

export default function CategoryMappingPage() {
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState("")
  const [selectedSuggestion, setSelectedSuggestion] = useState<AiSuggestion | null>(null)
  const debouncedSearch = useDebounce(searchText, 300)
  const rulesQuery = useCategoryRules(debouncedSearch)
  const groupsQuery = useUnmappedGroups()
  const aiMutation = useCategoryMatchSuggestions()

  const confirmMutation = useMutation({
    mutationFn: ({
      suggestion,
      selected,
    }: {
      suggestion: AiSuggestion
      selected: SheinCategoryCandidate
    }) => api.post("/category-mapping/ai-suggestions/confirm", {
      group: suggestion.group,
      selected,
      suggestion,
      source: "AI_SUGGESTED",
    }),
    onSuccess: () => {
      toast.success("类目映射已确认")
      void queryClient.invalidateQueries({ queryKey: ["category-mapping"] })
      setSelectedSuggestion(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "确认失败")
    },
  })

  const rules = rulesQuery.data?.rules ?? []
  const groups = groupsQuery.data?.groups ?? []
  const suggestions = aiMutation.data?.suggestions ?? []
  const highConfidenceCount = suggestions.filter((item) => item.confidence >= 0.8 && item.status === "READY").length
  const ambiguousCount = suggestions.filter((item) => item.status === "AMBIGUOUS" || item.confidence < 0.8).length

  const handleRunAi = () => {
    aiMutation.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(`AI 已生成 ${result.suggestions.length} 条类目建议`)
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "AI 匹配失败")
      },
    })
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="类目映射规则"
        description="管理 MDM 类目到 SHEIN 叶子类目的映射。AI 先给候选，运营确认后沉淀为正式规则。"
      >
        <Button onClick={handleRunAi} disabled={aiMutation.isPending}>
          <Sparkles className="size-4" />
          {aiMutation.isPending ? "AI 匹配中" : "AI 匹配未映射商品"}
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="已配置规则" value={formatNumber(rules.length)} icon={GitBranch} />
        <StatCard title="未映射组合" value={formatNumber(groups.length)} icon={Layers3} />
        <StatCard title="高置信建议" value={formatNumber(highConfidenceCount)} icon={CheckCircle2} />
        <StatCard title="需复核" value={formatNumber(ambiguousCount)} icon={CircleAlert} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>AI 匹配审核</CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                按 MDM 中类、小类、性别、年龄段聚合，确认后写入映射规则。
              </div>
            </div>
            <Button variant="outline" onClick={handleRunAi} disabled={aiMutation.isPending}>
              <Bot className="size-4" />
              重新生成建议
            </Button>
          </CardHeader>
          <CardContent>
            {aiMutation.isPending ? (
              <div className="space-y-4 rounded-2xl border bg-muted/30 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span>正在整理 MDM/深绘字段并请求 AI 服务</span>
                  <span>gemini-3-flash-preview</span>
                </div>
                <Progress value={58} />
                <div className="grid gap-3 md:grid-cols-3">
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </div>
              </div>
            ) : suggestions.length ? (
              <div className="overflow-hidden rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MDM 组合</TableHead>
                      <TableHead>代表款</TableHead>
                      <TableHead>AI 首选类目</TableHead>
                      <TableHead>置信度</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="w-[108px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestions.map((suggestion) => (
                      <TableRow key={suggestion.match_key}>
                        <TableCell>
                          <div className="font-medium">{groupLabel(suggestion.group)}</div>
                          <div className="mt-1 max-w-[420px] truncate text-sm text-muted-foreground">
                            深绘：{suggestion.group?.deepdraw_category_name ?? "—"} · {suggestion.group?.trade_path ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{suggestion.group?.spu_count ?? 0} 款</div>
                          <div className="text-muted-foreground">
                            {suggestion.group?.spus.slice(0, 2).join(", ") || "—"}
                          </div>
                          <div className="mt-2 max-w-[320px]">
                            <SkcImageStrip
                              examples={suggestion.group?.skc_examples ?? []}
                              suggestions={suggestion.skc_suggestions}
                              max={3}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{categoryLabel(suggestion.primary)}</div>
                          <div className="mt-1 max-w-[360px] truncate text-sm text-muted-foreground">
                            {suggestion.primary?.path ?? "AI 未给出可用类目"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={confidenceTone(suggestion.confidence)}>
                            {confidencePercent(suggestion.confidence)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{statusLabel(suggestion.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedSuggestion(suggestion)}
                          >
                            审核
                            <ArrowRight className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : groups.length ? (
              <div className="space-y-3">
                {groups.slice(0, 8).map((group) => (
                  <div key={group.match_key} className="rounded-2xl border bg-card p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium">{groupLabel(group)}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {group.spu_count} 款 · 尺码 {group.spec_range ?? "—"} · 深绘 {group.deepdraw_category_name ?? "—"}
                        </div>
                        <div className="mt-3">
                          <SkcImageStrip examples={group.skc_examples} max={4} />
                        </div>
                      </div>
                      <Badge variant="outline">待 AI 推荐</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="当前没有未映射的 MDM 类目组合" icon={CheckCircle2} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>已生效规则</CardTitle>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索 MDM 小类或 match key"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {rulesQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </div>
            ) : rules.length ? (
              <div className="space-y-3">
                {rules.slice(0, 12).map((rule) => (
                  <div key={rule.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {rule.mdm_middle_category_name} / {rule.mdm_small_category_name}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {[rule.gender_name, rule.age_group_name].filter(Boolean).join(" / ") || "通用"}
                        </div>
                      </div>
                      <Badge variant="outline">{rule.source}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <FieldPill label="SHEIN 类目" value={rule.shein_category_id} />
                      <FieldPill label="Product Type" value={rule.shein_product_type_id} />
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      更新：{formatDateTime(rule.updated_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="暂无类目映射规则" icon={GitBranch} />
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selectedSuggestion} onOpenChange={(open) => !open && setSelectedSuggestion(null)}>
        <SheetContent className="w-[min(820px,calc(100vw-2rem))] gap-0 p-0 sm:max-w-none">
          {selectedSuggestion ? (
            <>
              <SheetHeader className="border-b p-5">
                <SheetTitle>AI 类目建议审核</SheetTitle>
                <SheetDescription>
                  确认后会把当前 MDM 组合写入类目映射规则，后续草稿生成将直接复用。
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldPill label="MDM 组合" value={groupLabel(selectedSuggestion.group)} />
                  <FieldPill label="代表款号" value={selectedSuggestion.group?.spus.join(", ")} />
                  <FieldPill label="尺码范围" value={selectedSuggestion.group?.spec_range} />
                  <FieldPill label="深绘类目" value={selectedSuggestion.group?.deepdraw_category_name} />
                  <FieldPill label="面料/版型" value={[selectedSuggestion.group?.fabric_type_name, selectedSuggestion.group?.model_name].filter(Boolean).join(" / ")} />
                  <FieldPill label="AI 状态" value={`${statusLabel(selectedSuggestion.status)} · ${confidencePercent(selectedSuggestion.confidence)}%`} />
                </div>

                <SkcSuggestionPanel
                  examples={selectedSuggestion.group?.skc_examples ?? []}
                  suggestions={selectedSuggestion.skc_suggestions}
                />

                <div className="mt-5 space-y-3">
                  <div>
                    <div className="text-sm font-medium">首选类目</div>
                    <div className="mt-2">
                      {selectedSuggestion.primary ? (
                        <CandidateCard
                          candidate={selectedSuggestion.primary}
                          active
                          disabled={confirmMutation.isPending}
                          onSelect={() => confirmMutation.mutate({
                            suggestion: selectedSuggestion,
                            selected: selectedSuggestion.primary!,
                          })}
                        />
                      ) : (
                        <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
                          AI 没有给出可确认的首选类目。
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedSuggestion.alternatives.length ? (
                    <div>
                      <div className="text-sm font-medium">备选类目</div>
                      <div className="mt-2 space-y-2">
                        {selectedSuggestion.alternatives.map((candidate) => (
                          <CandidateCard
                            key={`${candidate.category_id}-${candidate.product_type_id}`}
                            candidate={candidate}
                            disabled={confirmMutation.isPending}
                            onSelect={() => confirmMutation.mutate({
                              suggestion: selectedSuggestion,
                              selected: candidate,
                            })}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">判断理由</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedSuggestion.reasons.length ? selectedSuggestion.reasons.map((reason) => (
                        <div key={reason} className="rounded-xl bg-muted px-3 py-2 text-sm">
                          {reason}
                        </div>
                      )) : (
                        <div className="text-sm text-muted-foreground">AI 未返回理由。</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">风险点</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedSuggestion.risks.length ? selectedSuggestion.risks.map((risk) => (
                        <div key={risk} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          {risk}
                        </div>
                      )) : (
                        <div className="text-sm text-muted-foreground">没有明显风险点。</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </PageContainer>
  )
}
