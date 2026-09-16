// Adapted from beUI Command Palette (MIT). Keep Radix/cmdk focus and keyboard semantics.
import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { Search } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useAuth } from "@/lib/auth-context"
import { NAV_GROUPS } from "@/components/layout/app-sidebar"

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false)
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        // Leave another dialog's focus and keyboard ownership intact.
        if (!open && document.querySelector('[role="dialog"], [role="alertdialog"]')) return
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [open])
  return <>
    <Button variant="outline" size="sm" aria-label="快捷导航" onClick={() => setOpen(true)} className="gap-2">
      <Search className="size-3.5" /><span className="hidden sm:inline">快捷导航</span><kbd className="hidden text-[10px] text-muted-foreground lg:inline">⌘ / Ctrl K</kbd>
    </Button>
    <CommandDialog open={open} onOpenChange={setOpen} title="快捷导航" description="搜索你有权限访问的页面，使用方向键选择，回车进入。">
      <CommandInput placeholder="搜索页面，如：草稿、图片、发布…" />
      <CommandList><CommandEmpty>没有可访问的匹配页面</CommandEmpty>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.disabled && (!item.permission || hasPermission(item.permission)))
          return items.length > 0 && <CommandGroup key={group.label} heading={group.label}>{items.map((item) => <CommandItem key={item.to} value={`${group.label} ${item.label} ${item.to}`} onSelect={() => { setOpen(false); navigate(item.to) }} className="rounded-lg data-[selected=true]:bg-[var(--brand-light)]">
            <motion.span initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className="flex items-center gap-2"><item.icon className="size-4" />{item.label}</motion.span>
          </CommandItem>)}</CommandGroup>
        })}
      </CommandList>
    </CommandDialog>
  </>
}
