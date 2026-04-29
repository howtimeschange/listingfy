import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface CategoryOption {
  categoryId: number
  productTypeId: number
  categoryName: string
  path: string
}

interface CategorySelectorProps {
  options: CategoryOption[]
  value?: number
  onSelect: (category: CategoryOption | null) => void
  placeholder?: string
  className?: string
}

export function CategorySelector({
  options,
  value,
  onSelect,
  placeholder = "选择类目…",
  className,
}: CategorySelectorProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.categoryId === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          {selected
            ? `${selected.categoryName} (${selected.categoryId})`
            : placeholder}
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索类目名称或路径…" />
          <CommandList>
            <CommandEmpty>未找到类目</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.categoryId}
                  value={`${option.categoryName} ${option.path}`}
                  onSelect={() => {
                    onSelect(option.categoryId === value ? null : option)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-3.5",
                      value === option.categoryId
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{option.categoryName}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[320px]">
                      {option.path}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
