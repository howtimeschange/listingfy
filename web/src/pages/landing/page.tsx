import { useState } from "react"
import { Link } from "react-router"
import { ArrowDown, ArrowRight, Check, CheckCheck, FileCheck2, FileText, Globe2, Layers, Menu, ScanLine, ShieldCheck, Sparkles, X } from "lucide-react"
import { Magnetic } from "@/components/motion/magnetic"
import { TiltCard } from "@/components/motion/tilt-card"
import { LandingBackground, ProductDeck } from "./landing-visuals"
import "./landing.css"

const navigation = [{ href: "#capabilities", label: "产品能力" }, { href: "#workflow", label: "工作方式" }, { href: "#operations", label: "平台运营" }]
const steps = [
  { title: "汇集商品资料", description: "导入标准文案与上市计划，关联 MDM、图片、吊牌与洗唛。", icon: FileText, label: "资料归集" },
  { title: "AI 辅助建档", description: "识别资料，补齐类目和字段。保留来源，让每一次修改有据可查。", icon: Sparkles, label: "深绘建档" },
  { title: "检查后提交", description: "核对图片、尺码、价格和包装，处理阻断项后按批次发布。", icon: FileCheck2, label: "SHEIN 上新" },
  { title: "跟进平台结果", description: "回读平台商品与审核状态，继续维护供货价、站点与运营记录。", icon: Globe2, label: "平台运营" },
]

function Brand() {
  return <Link to="/" className="landing-brand" aria-label="Listingify 首页"><img src="/favicon.svg" alt="" width="36" height="36" /><span>Listingify</span><b aria-label="AI 驱动">AI</b></Link>
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="landing-page">
    <a href="#main-content" className="landing-skip">跳到主要内容</a>
    <header className="landing-header">
      <div className="landing-container landing-nav"><Brand />
        <nav className="landing-desktop-nav" aria-label="首页导航">{navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
        <div className="landing-nav-actions"><Link to="/login" className="landing-login">登录</Link><Link className="landing-cta landing-cta-small" to="/dashboard">进入工作台 <ArrowRight size={15} /></Link><button className="landing-menu" type="button" aria-label={menuOpen ? "关闭导航" : "打开导航"} aria-expanded={menuOpen} aria-controls="landing-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
      </div>
      {menuOpen && <nav id="landing-mobile-nav" className="landing-mobile-nav" aria-label="移动端首页导航">{navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}<ArrowRight size={15} /></a>)}</nav>}
    </header>
    <main id="main-content">
      <section className="landing-hero">
        <LandingBackground />
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow"><span className="landing-green-dot" /> AI 驱动的商品运营平台</p>
            <h1>让好商品，<br />更进一步<span className="landing-period">。</span></h1>
            <p className="landing-lead">从一份商品资料，到一次准备充分的上新。<br className="landing-desktop-break" />把建档、发布与后续运营，放进同一个工作台。</p>
            <div className="landing-hero-actions"><Magnetic strength={0.12}><Link to="/dashboard" className="landing-cta">开始商品之旅 <ArrowRight size={18} /></Link></Magnetic><a href="#workflow" className="landing-text-link">了解工作方式 <ArrowDown size={16} /></a></div>
            <div className="landing-hero-tags"><span>AI 智能建档</span><span>SHEIN 上新</span><span>平台运营</span></div>
          </div>
          <ProductDeck />
        </div>
        <div className="landing-container landing-ecosystem"><span>连接资料与每一步运营</span><div><strong>MDM</strong><span className="landing-ecosystem-line" /><strong>深绘</strong><span className="landing-ecosystem-line" /><strong>SHEIN</strong></div><span className="landing-ecosystem-note">资料有来源 · 发布有校验 · 结果可追踪</span></div>
      </section>

      <section id="capabilities" className="landing-section landing-container">
        <div className="landing-section-intro"><div><p className="landing-overline">LESS REPEAT. MORE PROGRESS.</p><h2>少一点重复整理，<br />多一点向前推进。</h2></div><p>资料不必在表格之间反复搬运。<br />从字段来源到平台回执，<br />让每个环节都接得上。</p></div>
        <div className="landing-feature-grid">
          <TiltCard max={3} glare={false} className="landing-feature landing-feature-ai"><div className="landing-feature-heading"><span className="landing-feature-icon"><ScanLine size={22} /></span><span className="landing-overline">01 / UNDERSTAND</span></div><h3>读懂资料，<br />再补齐商品。</h3><p>吊牌/洗唛识别、文案、主数据与参考图汇集到草稿。AI/OCR 证据补齐，让字段来源清晰可见。</p><div className="landing-field-demo" aria-label="字段来源示意"><div><span>商品名称</span><strong>标准文案</strong><i>已关联</i></div><div><span>面料成分</span><strong>洗唛识别</strong><i>待核对</i></div><div><span>商品类目</span><strong>AI 推荐</strong><i>待确认</i></div></div><Link to="/product-archive-drafts" className="landing-feature-link">了解深绘建档 <ArrowRight size={17} /></Link></TiltCard>
          <div className="landing-feature-column">
            <article className="landing-feature landing-feature-launch"><div className="landing-feature-heading"><span className="landing-feature-icon"><Layers size={22} /></span><span className="landing-overline">02 / PREPARE</span></div><h3>把问题留在发布之前。</h3><p>图片、类目、尺码、价格与包装逐项检查。阻断原因直接呈现，修正后再提交。</p><div className="landing-check-chips"><span><Check size={13} />图片规则</span><span><Check size={13} />尺码映射</span><span><Check size={13} />发布预检</span></div><Link to="/pre-publish-validation" className="landing-feature-link">查看发布草稿箱 <ArrowRight size={17} /></Link></article>
            <article className="landing-feature landing-feature-track"><span className="landing-feature-icon"><CheckCheck size={22} /></span><div><h3>提交之后，仍然看得见。</h3><p>查看排队、执行、失败与平台回执。任务有记录，处理有依据。</p></div></article>
          </div>
        </div>
      </section>

      <section id="workflow" className="landing-workflow">
        <div className="landing-container"><div className="landing-section-intro"><div><p className="landing-overline">ONE CONNECTED WORKFLOW</p><h2>一件商品。<br />一条连贯的工作流。</h2></div><p>从资料进入，到平台回读。<br />每一步都有明确的下一步。</p></div><div className="landing-steps">{steps.map((step, index) => <article key={step.title}><div className="landing-step-line"><span>0{index + 1}</span><step.icon size={21} /></div><span className="landing-step-label">{step.label}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div></div>
      </section>

      <section id="operations" className="landing-section landing-container landing-operations">
        <div><p className="landing-overline">AFTER THE LAUNCH</p><h2>上新是开始。<br />运营，继续发生。</h2><p className="landing-operations-copy">平台商品同步回来，供货价、销售站点与审核状态继续跟进。让“已提交”之后的工作，也有一个清晰的入口。</p><Link to="/shein-platform-products" className="landing-text-link">进入平台商品列表 <ArrowRight size={17} /></Link><div className="landing-trust"><ShieldCheck size={18} /><span>按角色开放入口，关键操作留存记录。</span></div></div>
        <div className="landing-operations-board"><div className="landing-board-head"><span className="landing-green-dot" /><strong>AI 商品运营驾驶舱</strong><span>能力一览</span></div><div className="landing-operation-row"><Globe2 /><div><h3>销售站点</h3><p>查看站点明细，筛选与导出</p></div><ArrowRight /></div><div className="landing-operation-row"><TagIcon /><div><h3>供货价维护</h3><p>批量调整，表格导入</p></div><ArrowRight /></div><div className="landing-operation-row"><FileCheck2 /><div><h3>审核状态</h3><p>聚合追踪，定位待处理项</p></div><ArrowRight /></div><div className="landing-board-footer">AI 证据到平台回读覆盖 <span>建档 → 上新 → 运营</span></div></div>
      </section>

      <section className="landing-container landing-final"><div className="landing-final-orbit" aria-hidden /><p className="landing-overline">READY FOR THE NEXT STEP?</p><h2>下一件好商品，<br />从这里开始。</h2><Magnetic strength={0.1}><Link to="/dashboard" className="landing-cta">进入 Listingify <ArrowRight size={18} /></Link></Magnetic><p>用现有账号登录，进入你的工作台。</p></section>
    </main>
    <footer className="landing-container landing-footer"><Brand /><p>商品资料，从此有序向前。</p><span>深绘建档 · SHEIN 上新 · 平台运营</span><a href="#main-content">回到顶部 ↑</a></footer>
  </div>
}

function TagIcon() { return <span className="landing-price-icon">¥</span> }
