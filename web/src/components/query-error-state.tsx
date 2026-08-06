import { Button } from "@/components/ui/button"

export function QueryErrorState({
  message = "加载失败，请稍后重试。",
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="grid gap-2 rounded-md border border-[#f1cccc] bg-[#fff8f8] p-4 text-sm text-[#a33a3a]">
      <span>{message}</span>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onRetry}>
          重试
        </Button>
      ) : null}
    </div>
  )
}
