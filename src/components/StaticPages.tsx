import { useEffect, useState } from 'react';
import { CheckIcon } from './Icons';

function PageShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <main>
      <section className="hero">
        <h1 className="gradient-text">{title}</h1>
        {sub && <p className="vic-desc">{sub}</p>}
      </section>
      <div className="container" style={{ paddingBottom: 72 }}>
        {children}
      </div>
    </main>
  );
}

/* ---------------- Pricing ---------------- */

const PLANS = [
  {
    name: '免费版',
    price: '¥0',
    period: '永久',
    desc: '全部 10 个工具，无次数限制',
    features: ['视频 / 图片 / PDF 压缩', '剪切、裁剪、音频剪辑', '视频转 MP3', 'AI 转录与翻译（本地模型）', '无水印、无需注册'],
    cta: '直接使用',
    path: '/',
    highlight: false,
  },
  {
    name: '本地增强',
    price: '¥0',
    period: '永久',
    desc: '可选：下载桌面运行时获得更快速度',
    features: ['与网页版完全一致的功能', '模型与引擎本地缓存', '断网可用（模型已缓存时）', '适合频繁处理大文件的用户', '即将推出'],
    cta: '敬请期待',
    path: '/desktop',
    highlight: true,
  },
  {
    name: '团队私有化',
    price: '自定义',
    period: '',
    desc: '把整套工具部署到你的内网',
    features: ['纯静态构建，任意内网托管', '零外发流量，满足合规要求', '可自定义品牌与默认参数', '适合媒体、法务、医疗团队'],
    cta: '联系我们',
    path: '/blog',
    highlight: false,
  },
];

export function PricingPage() {
  useEffect(() => {
    document.title = '价格 - VideoCompress';
  }, []);
  return (
    <PageShell title="简单透明的价格" sub="计算发生在你自己的设备上——没有服务器成本，所以全部功能永久免费。">
      <div className="pricing-grid">
        {PLANS.map((p) => (
          <div className={`price-card${p.highlight ? ' highlight' : ''}`} key={p.name}>
            {p.highlight && <span className="price-badge">推荐</span>}
            <h3>{p.name}</h3>
            <div className="price-num">
              {p.price} <span>{p.period}</span>
            </div>
            <p className="price-desc">{p.desc}</p>
            <ul>
              {p.features.map((f) => (
                <li key={f}>
                  <CheckIcon size={14} /> {f}
                </li>
              ))}
            </ul>
            <a className={p.highlight ? 'btn btn-primary' : 'btn btn-ghost'} href={`#${p.path}`}>
              {p.cta}
            </a>
          </div>
        ))}
      </div>
      <p className="crf-caption" style={{ textAlign: 'center', marginTop: 28 }}>
        引擎（约 31MB）与 AI 模型（40–160MB）在首次使用时从公共 CDN 下载并缓存到本地，之后不再产生下载。
      </p>
    </PageShell>
  );
}

/* ---------------- Blog ---------------- */

const POSTS = [
  {
    title: '为什么本地压缩比云端更安全',
    date: '2026-08-30',
    tag: '隐私',
    body: '云端压缩工具需要把完整文件上传到服务器，即使承诺"24 小时后删除"，传输与存储环节仍存在泄露面。本地方案用 WebAssembly 把 FFmpeg 跑在浏览器沙箱里，文件从头到尾不离开设备，敏感视频（合同演示、内部培训、私人影像）尤其适合。',
  },
  {
    title: 'CRF 怎么选：23 不是万能答案',
    date: '2026-08-18',
    tag: '教程',
    body: 'CRF 衡量"恒定质量"：数值越小画质越高、体积越大。快速运动画面（体育、游戏录屏）建议 CRF 21–23；说话头部、课件类视频 26–28 也很难看出差别。先截取 20 秒样本试压，比整段重压省大量时间。',
  },
  {
    title: 'H.264 还是 H.265？一次说清',
    date: '2026-08-02',
    tag: '编码',
    body: 'H.265 同画质比 H.264 再省 20–40% 体积，但浏览器内编码耗时约为数倍。经验法则：发微信/邮件用 H.264 快速档；归档 4K 素材且不赶时间，再用 H.265。注意部分老设备播放 H.265 需要解码器支持。',
  },
  {
    title: '给视频减重的五个习惯',
    date: '2026-07-21',
    tag: '效率',
    body: '① 录屏前直接选 1080p 而非 4K；② 帧率 30fps 足够展示操作；③ 先剪掉废话再压缩；④ 音频 128k 与 192k 在语音场景几乎无感；⑤ 归档统一用一种预设，避免反复转码累积损伤。',
  },
  {
    title: 'AI 转录在浏览器里已经够用了',
    date: '2026-07-05',
    tag: 'AI',
    body: 'Whisper 的 tiny/base 模型量化后只有 40–80MB，现代笔记本跑实时率普遍超过 1 倍速。会议纪要、字幕初稿这类场景，本地转录的隐私优势明显强于把音轨交给第三方 API。',
  },
  {
    title: '压缩后的 PDF 为什么还是大',
    date: '2026-06-14',
    tag: 'PDF',
    body: '纯文字 PDF 的体积来自字体与矢量结构，重渲染收效有限；真正的大头通常是内嵌图片与扫描页。对扫描版选择"强力压缩"档（96 DPI + 50% 质量）往往能减掉 70% 以上体积。',
  },
];

export function BlogPage() {
  const [open, setOpen] = useState(-1);
  useEffect(() => {
    document.title = '博客 - VideoCompress';
  }, []);
  return (
    <PageShell title="博客" sub="关于视频处理、本地优先与浏览器 AI 的实践笔记。">
      <div className="blog-list">
        {POSTS.map((p, i) => (
          <article className="blog-card" key={p.title} onClick={() => setOpen(open === i ? -1 : i)}>
            <div className="blog-meta">
              <span className="blog-tag">{p.tag}</span>
              <span>{p.date}</span>
            </div>
            <h3>{p.title}</h3>
            <p className={`blog-body${open === i ? ' open' : ''}`}>{p.body}</p>
          </article>
        ))}
      </div>
    </PageShell>
  );
}

/* ---------------- Legal ---------------- */

const LEGAL: Record<string, { title: string; sections: Array<[string, string]> }> = {
  privacy: {
    title: '隐私说明',
    sections: [
      ['我们处理什么', '本站所有媒体处理（压缩、剪切、转换、AI 识别与翻译）均在你的浏览器本地完成。你的视频、图片、音频与文档不会被上传到本站或任何第三方服务器。'],
      ['外部资源加载', '首次使用时会从公共 CDN（unpkg.com / jsdelivr.net / huggingface.co）下载处理引擎与 AI 模型文件，该请求仅获取通用资源，不包含你的任何文件内容。'],
      ['本地数据', '我们不使用 Cookie 做用户跟踪，也不收集个人身份信息。处理结果仅存在于浏览器内存中，关闭页面即被释放。'],
      ['第三方模型服务', 'AI 功能使用的模型文件经 CDN 分发后在本机运行；推理过程不产生任何网络请求。'],
    ],
  },
  terms: {
    title: '使用条款',
    sections: [
      ['服务性质', '本站提供基于浏览器本地计算的多媒体处理工具，按"现状"提供，不构成任何明示或暗示的担保。'],
      ['使用限制', '请仅处理你拥有合法权利的文件，不得将本工具用于任何违反法律法规或侵犯他人权益的目的。'],
      ['责任限制', '本地处理受设备内存与性能限制，超大数据可能失败；请自行保留源文件备份，因使用本工具造成的任何数据损失本站不承担责任。'],
      ['条款变更', '我们可能不定期更新本条款，更新后在页面上公示即生效。'],
    ],
  },
  subscription: {
    title: '订阅政策',
    sections: [
      ['全部功能免费', '因为计算发生在用户自己的设备上，本站没有服务器成本，所有工具（含 AI 功能）永久免费，不设积分、次数或订阅。'],
      ['无自动续费', '本站不提供任何付费订阅，因此不存在自动扣费或续费项目。'],
      ['未来变化', '若未来推出可选增值服务，将在明显位置提前公告，且不影响现有免费功能。'],
    ],
  },
};

export function LegalPage({ kind }: { kind: keyof typeof LEGAL }) {
  const doc = LEGAL[kind];
  useEffect(() => {
    document.title = `${doc.title} - VideoCompress`;
  }, [doc.title]);
  return (
    <PageShell title={doc.title}>
      <div className="legal-body">
        {doc.sections.map(([h, body]) => (
          <section key={h}>
            <h3>{h}</h3>
            <p>{body}</p>
          </section>
        ))}
        <p className="crf-caption">最后更新：2026 年 9 月</p>
      </div>
    </PageShell>
  );
}

/* ---------------- Desktop ---------------- */

export function DesktopPage() {
  useEffect(() => {
    document.title = '下载桌面版 - VideoCompress';
  }, []);
  return (
    <PageShell title="桌面版 VideoCompress" sub="同样的本地处理体验，更快的引擎与离线能力。">
      <div className="desktop-grid">
        <div className="price-card highlight">
          <h3>Windows</h3>
          <div className="price-num">准备中</div>
          <p className="price-desc">打包多线程引擎，大文件压缩速度预计提升 3–5 倍</p>
          <a className="btn btn-ghost" href="#/">
            先用网页版
          </a>
        </div>
        <div className="price-card highlight">
          <h3>macOS</h3>
          <div className="price-num">准备中</div>
          <p className="price-desc">Apple Silicon 原生加速，视频编码直接调用媒体引擎</p>
          <a className="btn btn-ghost" href="#/">
            先用网页版
          </a>
        </div>
      </div>
      <p className="crf-caption" style={{ textAlign: 'center', marginTop: 24 }}>
        桌面版发布前，网页版已提供全部功能，欢迎先体验。
      </p>
    </PageShell>
  );
}
