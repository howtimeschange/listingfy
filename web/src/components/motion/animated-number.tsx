// Adapted from beUI Number Animation (MIT). See web/BEUI-LICENSE.txt.
import { animate, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"

// Render the actual value on first paint; animate only later updates, without React renders per frame.
export function AnimatedNumber({ value, format = formatCount }: { value: number; format?: (value: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!ref.current) return
    if (reduce || previous.current === value) {
      ref.current.textContent = format(value)
      previous.current = value
      return
    }
    const controls = animate(previous.current, value, {
      duration: 0.3,
      onUpdate: (next) => { previous.current = next; if (ref.current) ref.current.textContent = format(next) },
      onComplete: () => { if (ref.current) ref.current.textContent = format(value) },
    })
    return () => controls.stop()
  }, [value, format, reduce])
  return <span className="tabular-nums"><span className="sr-only">{format(value)}</span><span aria-hidden ref={ref}>{format(value)}</span></span>
}

function formatCount(value: number) { return Math.round(value).toLocaleString("zh-CN") }
