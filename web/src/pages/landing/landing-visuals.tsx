import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react"
import { useInView, useReducedMotion, motion } from "motion/react"
import { ArrowLeft, ArrowRight, Check, FileText, Image, Layers, ScanLine, Shirt, Sparkles, Tag } from "lucide-react"
import { TiltCard } from "@/components/motion/tilt-card"

const AmbientShader = lazy(() => import("./ambient-shader"))

class ShaderFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

export function LandingBackground() {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref)
  const reduce = useReducedMotion()
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    if (reduce) return
    const desktop = window.matchMedia("(min-width: 900px) and (hover: hover)")
    let capable = false
    try {
      const canvas = document.createElement("canvas")
      const gl = canvas.getContext("webgl2")
      capable = Boolean(gl)
      gl?.getExtension("WEBGL_lose_context")?.loseContext()
    } catch { /* Static gradient remains available. */ }
    const update = () => setEnabled(capable && desktop.matches && !document.hidden)
    update()
    desktop.addEventListener("change", update)
    document.addEventListener("visibilitychange", update)
    return () => { desktop.removeEventListener("change", update); document.removeEventListener("visibilitychange", update) }
  }, [reduce])
  return <div ref={ref} className="landing-ambient" aria-hidden>
    {enabled && visible && !reduce && <ShaderFallback><Suspense fallback={null}><AmbientShader /></Suspense></ShaderFallback>}
  </div>
}

const stages = [
  { eyebrow: "01 / CREATE", title: "资料，变成商品档案。", name: "深绘智能建档", tag: "AI / OCR", icon: ScanLine, details: ["吊牌 / 洗唛识别", "MDM 商品主数据", "类目与字段补齐"], footer: "每个字段，都能找到来源。" },
  { eyebrow: "02 / LAUNCH", title: "准备好，再去上新。", name: "SHEIN 发布草稿", tag: "SHEIN", icon: Layers, details: ["图片与尺码校验", "价格与包装规则", "发布预检与批次提交"], footer: "先看阻断项，再确认发布。" },
  { eyebrow: "03 / OPERATE", title: "上架之后，继续向前。", name: "平台商品运营", tag: "OPERATIONS", icon: Tag, details: ["平台商品同步", "供货价与销售站点", "审核状态与操作记录"], footer: "从平台回执，跟进下一步。" },
]

// A small, manual 3D deck inspired by beUI Cylinder Carousel. No autoplay or scroll capture.
export function ProductDeck() {
  const [active, setActive] = useState(0)
  const reduce = useReducedMotion()
  const current = stages[active]
  return <div className="landing-demo" role="region" aria-roledescription="轮播" aria-label="产品流程演示" onKeyDown={(event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault(); setActive((value) => (value + (event.key === "ArrowRight" ? 1 : 2)) % 3)
    }
  }}>
    <div className="landing-deck">
      {stages.map((stage, index) => {
        const offset = (index - active + 3) % 3
        return <motion.div key={stage.name} className="landing-deck-card" aria-hidden={index !== active} inert={index !== active} animate={reduce ? { x: 0, y: 0, rotateY: 0, rotateZ: 0, scale: 1, opacity: index === active ? 1 : 0 } : { x: offset * 26, y: offset * -24, rotateY: offset * -5, rotateZ: offset * 3, scale: 1 - offset * 0.035, opacity: 1 - offset * 0.18 }} transition={{ type: "spring", stiffness: 220, damping: 28, duration: reduce ? 0 : undefined }} style={{ zIndex: 3 - offset }}>
          <TiltCard max={4} glare={false} className="landing-preview">
            <div className="landing-preview-top"><span><img src="/favicon.svg" alt="" /> Listingify <b>AI</b></span><span>产品流程示意</span></div>
            <div className="landing-preview-body">
              <div className="landing-preview-heading"><div><span className="landing-overline">{stage.eyebrow}</span><h3>{stage.name}</h3></div><stage.icon size={23} /></div>
              <div className="landing-product-sample">
                <div className="landing-garment"><Shirt strokeWidth={0.8} /><span>PRODUCT</span></div>
                <div className="landing-sample-info"><span className="landing-sample-tag">{stage.tag}</span><h4>一件商品的上新旅程</h4><p>商品资料 · 图片 · 字段 · 状态</p><div className="landing-source-chips"><span><FileText size={12} />文案</span><span><Image size={12} />图片</span><span><Sparkles size={12} />AI</span></div></div>
              </div>
              <div className="landing-checklist">{stage.details.map((detail, i) => <div key={detail}><span className="landing-check-index">0{i + 1}</span><span>{detail}</span><Check size={14} /></div>)}</div>
              <div className="landing-preview-foot"><span className="landing-green-dot" />{stage.footer}<ArrowRight size={15} /></div>
            </div>
          </TiltCard>
        </motion.div>
      })}
    </div>
    <div className="landing-deck-controls">
      <button type="button" aria-label="上一个流程" onClick={() => setActive((active + 2) % 3)}><ArrowLeft size={16} /></button>
      <div className="landing-deck-dots">{stages.map((stage, i) => <button key={stage.name} type="button" aria-label={`查看${stage.name}`} aria-pressed={i === active} onClick={() => setActive(i)} />)}</div>
      <button type="button" aria-label="下一个流程" onClick={() => setActive((active + 1) % 3)}><ArrowRight size={16} /></button>
    </div>
    <p className="landing-deck-caption" aria-live="polite">{current.title}</p>
  </div>
}
