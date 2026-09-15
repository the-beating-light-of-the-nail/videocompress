import { useEffect, useState, type ReactNode } from 'react';
import type { ToolMeta } from '../tools/nav';
import { TOOL_COPY } from '../tools/copy';
import { ChevronDown } from './Icons';
import { navigate } from '../lib/router';

function StepsBlock({ steps }: { steps: Array<{ title: string; desc: string }> }) {
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="gradient-text">三步完成</h2>
        </div>
        <div className="steps-grid">
          {steps.map((s, i) => (
            <div className="step-card open" key={s.title}>
              <span className="step-tag">STEP {i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqBlock({ items }: { items: Array<{ q: string; a: string }> }) {
  const [open, setOpen] = useState(0);
  return (
    <section className="section" id="faq">
      <div className="container">
        <div className="section-head">
          <h2 className="gradient-text">常见问题</h2>
        </div>
        <div className="faq-wrap">
          {items.map((f, i) => (
            <div className={`faq-item${open === i ? ' open' : ''}`} key={f.q}>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                {f.q}
                <ChevronDown size={18} />
              </button>
              <div className="faq-a" style={open === i ? { maxHeight: 320 } : undefined}>
                <div className="faq-a-inner">{f.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ToolPage({ meta, workspace }: { meta: ToolMeta; workspace: ReactNode }) {
  useEffect(() => {
    document.title = meta.docTitle;
    return () => {
      document.title = HOME_TITLE;
    };
  }, [meta.docTitle]);
  const copy = TOOL_COPY[meta.path];
  return (
    <main>
      <section className="hero">
        <h1 className="gradient-text">{meta.h1}</h1>
        <p className="vic-desc">{meta.sub}</p>
      </section>
      <div className="workspace-wrap">{workspace}</div>
      {copy?.steps && <StepsBlock steps={copy.steps} />}
      {copy?.faq && <FaqBlock items={copy.faq} />}
      <section className="section">
        <div className="container">
          <div className="cta-box">
            <h2>准备好了吗？</h2>
            <p>免费、无水印、本地处理 — 现在就试试。</p>
            <button className="cta-pill" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              回到工具开始使用
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

const HOME_TITLE = 'VideoCompress - 免费在线视频压缩工具';
export { HOME_TITLE };
export function goTool(path: string) {
  navigate(path);
}
