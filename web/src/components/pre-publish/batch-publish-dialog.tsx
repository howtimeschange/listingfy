import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Camera, CheckCircle2, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { ApiError, api } from "@/lib/api-client"
import { formatNumber } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface BlockingField {
  field_key: string
  field_label: string
  field_value: string | number | null
  status: string
  source: string
  note: string | null
  group: string
}

interface BatchPublishCheckItem {
  listing_id: number
  spu_code?: string
  title?: string | null
  category_name?: string | null
  ok: boolean
  errors: string[]
  fields: BlockingField[]
  quick_fixes?: {
    sku_weights: Array<{
      sku_id: number
      sku_code: string
      skc_code: string | null
      size_name: string | null
      package_weight_g: number | null
      selected_for_publish?: boolean
    }>
    image_confirmations: Array<{
      skc_id: number
      skc_code: string
      color_name: string | null
      image_url: string | null
      selected_for_publish?: boolean
      confirmed: boolean
      required: boolean
    }>
  }
}

interface BatchPublishCheckResponse {
  ok: boolean
  blocker_count: number
  items: BatchPublishCheckItem[]
}

interface BatchPublishDialogProps {
  listingIds: number[]
  triggerLabel?: string
  emptyMessage?: string
  disabled?: boolean
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary"
  className?: string
  selectionLabel?: string
  onAfterChange?: () => void | Promise<void>
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string } | null
    return body?.message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}

function batchEditKey(listingId: number, id: number | string) {
  return `${listingId}:${id}`
}

function hasQuickAdjustments(item: BatchPublishCheckItem) {
  const quickFixes = item.quick_fixes
  return Boolean(
    item.fields.length
    || quickFixes?.sku_weights.length
    || quickFixes?.image_confirmations.length,
  )
}

function uniqueListingIds(listingIds: number[]) {
  return Array.from(new Set(
    listingIds
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0),
  ))
}

export function BatchPublishDialog({
  listingIds,
  triggerLabel = "批量提交发布",
  emptyMessage = "请先勾选要批量发布的草稿",
  disabled,
  variant = "default",
  className,
  selectionLabel = "已勾选草稿",
  onAfterChange,
}: BatchPublishDialogProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [checkedListingIds, setCheckedListingIds] = useState<number[]>([])
  const [batchCheck, setBatchCheck] = useState<BatchPublishCheckResponse | null>(null)
  const [fieldEdits, setFieldEdits] = useState<Record<string, string>>({})
  const [skuWeightEdits, setSkuWeightEdits] = useState<Record<string, string>>({})
  const [imageConfirmEdits, setImageConfirmEdits] = useState<Record<string, boolean>>({})

  function applyBatchCheck(result: BatchPublishCheckResponse) {
    setBatchCheck(result)
    const nextEdits: Record<string, string> = {}
    const nextWeights: Record<string, string> = {}
    const nextConfirmations: Record<string, boolean> = {}
    for (const item of result.items) {
      for (const field of item.fields) {
        nextEdits[batchEditKey(item.listing_id, field.field_key)] = String(field.field_value ?? "")
      }
      for (const sku of item.quick_fixes?.sku_weights ?? []) {
        nextWeights[batchEditKey(item.listing_id, sku.sku_id)] = String(sku.package_weight_g ?? 500)
      }
      for (const skc of item.quick_fixes?.image_confirmations ?? []) {
        nextConfirmations[batchEditKey(item.listing_id, skc.skc_id)] = Boolean(skc.confirmed)
      }
    }
    setFieldEdits(nextEdits)
    setSkuWeightEdits(nextWeights)
    setImageConfirmEdits(nextConfirmations)
  }

  async function invalidatePublishViews() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pre-publish"] }),
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] }),
      queryClient.invalidateQueries({ queryKey: ["publish-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["listing-batches"] }),
    ])
    await onAfterChange?.()
  }

  const batchCheckMutation = useMutation({
    mutationFn: (ids: number[]) =>
      api.post<BatchPublishCheckResponse>("/pre-publish/drafts/batch-publish-check", {
        listing_ids: ids,
      }),
    onSuccess: (result) => {
      applyBatchCheck(result)
      setDialogOpen(true)
    },
    onError: (error) => toast.error(errorMessage(error, "批量发布预检失败")),
  })

  const saveBlockingFieldsMutation = useMutation({
    mutationFn: async (items: BatchPublishCheckItem[]) => {
      for (const item of items) {
        const fields = item.fields
          .map((field) => ({
            field_key: field.field_key,
            field_label: field.field_label,
            field_value: fieldEdits[batchEditKey(item.listing_id, field.field_key)] ?? String(field.field_value ?? ""),
            source: "MANUAL_BATCH_FIX",
          }))
          .filter((field) => field.field_value.trim())
        if (fields.length > 0) {
          await api.patch(`/pre-publish/drafts/${item.listing_id}/fields`, { fields })
        }

        const skuWeightValues = (item.quick_fixes?.sku_weights ?? [])
          .map((sku) => ({
            sku_id: sku.sku_id,
            package_weight_g: skuWeightEdits[batchEditKey(item.listing_id, sku.sku_id)] ?? "",
          }))
          .filter((sku) => sku.package_weight_g.trim())
        const imageFixes = item.quick_fixes?.image_confirmations ?? []
        const imageConfirmedSkcIds = imageFixes
          .filter((skc) => imageConfirmEdits[batchEditKey(item.listing_id, skc.skc_id)])
          .map((skc) => skc.skc_id)
        const savePayload: {
          sku_weight_values?: typeof skuWeightValues
          image_confirmed_skc_ids?: number[]
        } = {}
        if (skuWeightValues.length > 0) savePayload.sku_weight_values = skuWeightValues
        if (imageFixes.length > 0) savePayload.image_confirmed_skc_ids = imageConfirmedSkcIds
        if (Object.keys(savePayload).length > 0) {
          await api.post(`/pre-publish/drafts/${item.listing_id}/save`, savePayload)
        }
      }
      return api.post<BatchPublishCheckResponse>("/pre-publish/drafts/batch-publish-check", {
        listing_ids: checkedListingIds,
      })
    },
    onSuccess: async (result) => {
      toast.success("阻断字段已保存，已重新预检")
      applyBatchCheck(result)
      await invalidatePublishViews()
    },
    onError: (error) => toast.error(errorMessage(error, "阻断字段保存失败")),
  })

  const batchPublishMutation = useMutation({
    mutationFn: async (items: BatchPublishCheckItem[]) => {
      const publishable = items.filter((item) => item.ok)
      const results = []
      for (const item of publishable) {
        try {
          const result = await api.post<{
            ok: boolean
            task_id?: number
            status?: string
          }>(`/pre-publish/drafts/${item.listing_id}/publish`, { confirm: true })
          results.push({ ...item, ok: true, result })
        } catch (error) {
          results.push({ ...item, ok: false, errors: [errorMessage(error, "发布失败")] })
        }
      }
      return results
    },
    onSuccess: async (results) => {
      const successCount = results.filter((item) => item.ok).length
      const failedCount = results.length - successCount
      if (failedCount > 0) {
        toast.warning(`批量发布完成：成功 ${successCount} 个，失败 ${failedCount} 个`)
      } else {
        toast.success(`批量发布完成：成功 ${successCount} 个`)
        setDialogOpen(false)
      }
      await invalidatePublishViews()
    },
    onError: (error) => toast.error(errorMessage(error, "批量发布失败")),
  })

  const blockedItems = batchCheck?.items.filter((item) => !item.ok) ?? []
  const publishableItems = batchCheck?.items.filter((item) => item.ok) ?? []
  const activeCount = checkedListingIds.length

  function startBatchPublish() {
    const ids = uniqueListingIds(listingIds)
    if (ids.length === 0) {
      toast.warning(emptyMessage)
      return
    }
    setCheckedListingIds(ids)
    setBatchCheck(null)
    batchCheckMutation.mutate(ids)
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={startBatchPublish}
        disabled={disabled || batchCheckMutation.isPending}
      >
        {batchCheckMutation.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Send className="mr-2 size-4" />
        )}
        {triggerLabel}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:!max-w-6xl">
          <DialogHeader>
            <DialogTitle>批量提交草稿</DialogTitle>
            <DialogDescription>
              先对草稿做发布预检；没有阻断的草稿可直接提交，有字段阻断的草稿可在这里快速调整后重新预检。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">{selectionLabel}</p>
              <p className="mt-1 text-2xl font-semibold">{formatNumber(activeCount)}</p>
            </div>
            <div className="rounded border border-[#b9f4d8] bg-[#f2fff8] p-3">
              <p className="text-xs text-[#0fa76e]">可提交</p>
              <p className="mt-1 text-2xl font-semibold text-[#0fa76e]">{formatNumber(publishableItems.length)}</p>
            </div>
            <div className="rounded border border-[#f1cccc] bg-[#fff8f8] p-3">
              <p className="text-xs text-[#d45656]">有阻断</p>
              <p className="mt-1 text-2xl font-semibold text-[#d45656]">{formatNumber(blockedItems.length)}</p>
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">草稿</TableHead>
                  <TableHead>预检结果</TableHead>
                  <TableHead className="w-[420px]">快速调整字段</TableHead>
                  <TableHead className="w-[110px]">详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(batchCheck?.items ?? []).map((item) => (
                  <TableRow key={item.listing_id}>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <p className="font-mono text-sm">{item.spu_code ?? item.listing_id}</p>
                        <p className="max-w-[170px] truncate text-xs text-muted-foreground">
                          {item.title || item.category_name || "-"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      {item.ok ? (
                        <Badge variant="outline" className="border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]">
                          <CheckCircle2 className="mr-1 size-3" />
                          可提交
                        </Badge>
                      ) : (
                        <div className="space-y-2">
                          <Badge variant="outline" className="border-[#f1cccc] bg-[#fff1f1] text-[#d45656]">
                            <AlertTriangle className="mr-1 size-3" />
                            {formatNumber(item.errors.length)} 个阻断
                          </Badge>
                          <div className="space-y-1">
                            {item.errors.slice(0, 4).map((error) => (
                              <p key={error} className="text-xs text-muted-foreground">{error}</p>
                            ))}
                            {item.errors.length > 4 ? (
                              <p className="text-xs text-muted-foreground">还有 {formatNumber(item.errors.length - 4)} 个阻断，请进详情处理。</p>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {hasQuickAdjustments(item) ? (
                        <div className="space-y-4">
                          {item.fields.length ? (
                            <div className="space-y-3">
                              {item.fields.slice(0, 4).map((field) => {
                                const key = batchEditKey(item.listing_id, field.field_key)
                                return (
                                  <label key={key} className="grid gap-1">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {field.field_label}
                                    </span>
                                    <Input
                                      value={fieldEdits[key] ?? ""}
                                      onChange={(event) => setFieldEdits((current) => ({
                                        ...current,
                                        [key]: event.target.value,
                                      }))}
                                      placeholder="填写字段值"
                                    />
                                    {field.note ? <span className="text-xs text-muted-foreground">{field.note}</span> : null}
                                  </label>
                                )
                              })}
                              {item.fields.length > 4 ? (
                                <p className="text-xs text-muted-foreground">还有 {formatNumber(item.fields.length - 4)} 个字段，请打开详情页完整调整。</p>
                              ) : null}
                            </div>
                          ) : null}

                          {item.quick_fixes?.sku_weights.length ? (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">SKU 毛重/g</p>
                              <div className="space-y-2">
                                {item.quick_fixes.sku_weights.slice(0, 6).map((sku) => {
                                  const key = batchEditKey(item.listing_id, sku.sku_id)
                                  return (
                                    <div key={key} className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate font-mono text-xs">{sku.sku_code}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                          {sku.skc_code || "-"} / {sku.size_name || "-"}
                                        </p>
                                      </div>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={skuWeightEdits[key] ?? ""}
                                        onChange={(event) => setSkuWeightEdits((current) => ({
                                          ...current,
                                          [key]: event.target.value,
                                        }))}
                                        placeholder="500"
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                              {item.quick_fixes.sku_weights.length > 6 ? (
                                <p className="text-xs text-muted-foreground">
                                  还有 {formatNumber(item.quick_fixes.sku_weights.length - 6)} 个 SKU 毛重，请打开详情页批量处理。
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {item.quick_fixes?.image_confirmations.length ? (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">SKC 图片确认</p>
                              <div className="grid gap-2">
                                {item.quick_fixes.image_confirmations.slice(0, 4).map((skc) => {
                                  const key = batchEditKey(item.listing_id, skc.skc_id)
                                  return (
                                    <label key={key} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2 rounded border p-2">
                                      {skc.image_url ? (
                                        <img
                                          src={skc.image_url}
                                          alt={`${skc.skc_code} 款色图`}
                                          className="h-12 w-9 rounded border object-cover"
                                          loading="lazy"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <span className="flex h-12 w-9 items-center justify-center rounded border bg-muted text-muted-foreground">
                                          <Camera className="size-4" />
                                        </span>
                                      )}
                                      <span className="min-w-0">
                                        <span className="block truncate font-mono text-xs">{skc.skc_code}</span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                          {skc.color_name || "未识别颜色"}{skc.required ? " / 必须确认" : ""}
                                        </span>
                                      </span>
                                      <Checkbox
                                        checked={Boolean(imageConfirmEdits[key])}
                                        onCheckedChange={(checked) => setImageConfirmEdits((current) => ({
                                          ...current,
                                          [key]: Boolean(checked),
                                        }))}
                                        aria-label={`确认 ${skc.skc_code} 图片`}
                                      />
                                    </label>
                                  )
                                })}
                              </div>
                              {item.quick_fixes.image_confirmations.length > 4 ? (
                                <p className="text-xs text-muted-foreground">
                                  还有 {formatNumber(item.quick_fixes.image_confirmations.length - 4)} 个 SKC 图片，请打开详情页完整确认。
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {item.ok ? "无需调整" : "当前阻断需要打开详情页处理，例如类目枚举、尺码枚举或图片补齐。"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/pre-publish-validation/${item.listing_id}`}>打开详情</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => saveBlockingFieldsMutation.mutate(blockedItems)}
              disabled={saveBlockingFieldsMutation.isPending || blockedItems.every((item) => !hasQuickAdjustments(item))}
            >
              {saveBlockingFieldsMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              保存调整并重新预检
            </Button>
            <Button
              type="button"
              onClick={() => batchPublishMutation.mutate(batchCheck?.items ?? [])}
              disabled={batchPublishMutation.isPending || publishableItems.length === 0 || blockedItems.length > 0}
            >
              {batchPublishMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              确认批量发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
