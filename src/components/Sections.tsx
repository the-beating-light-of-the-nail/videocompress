import { useState } from 'react';
import {
  BadgeCheckIcon,
  ChatIcon,
  ChevronDown,
  FileVideoIcon,
  HardDriveIcon,
  MailIcon,
  MouseIcon,
  PlayIcon,
  ShieldIcon,
  SlidersIcon,
  StarIcon,
  ZapIcon,
} from './Icons';

/* ---------------- trust strip ---------------- */
const BRANDS = [
  { name: 'YouTube', color: '#ff0000' },
  { name: 'Instagram', color: '#e1306c' },
  { name: 'Google', color: '#4285f4' },
  { name: 'Netflix', color: '#e50914' },
  { name: 'Canva', color: '#00c4cc' },
  { name: 'Dropbox', color: '#0061ff' },
  { name: 'WhatsApp', color: '#25d366' },
  { name: 'Zoom', color: '#2d8cff' },
];

export function Trust() {
  return (
    <section className="trust">
      <div className="section-head">
        <h2 className="gradient-text">深受全球团队、创作者与企业信赖</h2>
        <p className="vic-desc">他们用 VideoCompress 缩小视频体积、简化分享流程，让日常视频处理更轻松。</p>
      </div>
      <div className="brand-row">
        {BRANDS.map((b) => (
          <span className="brand-chip" key={b.name}>
            <span className="bdot" style={{ background: b.color }} />
            {b.name}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ---------------- features ---------------- */
const FEATURES = [
  { Icon: SlidersIcon, title: '灵活的压缩设置', text: '一键预设快速压缩，或精细控制输出画质、码率、分辨率与编码器，流程灵活又易用。' },
  { Icon: ShieldIcon, title: '本地安全处理', text: '压缩完全在你的浏览器内完成，文件不会上传到任何服务器，隐私从架构上得到保障。' },
  { Icon: FileVideoIcon, title: '支持 40+ 视频格式', text: 'MP4、AVI、MKV、MOV、WEBM、WMV 等 40 多种格式都能处理，输出通用 MP4，随处可播。' },
  { Icon: ZapIcon, title: '压缩速度快', text: '无需排队等待云端，点击按钮立即开始处理，短视频几秒到几分钟即可完成。' },
  { Icon: MouseIcon, title: '人人都能轻松使用', text: '直观的操作界面，只需几次点击即可完成从选择文件到下载结果的全部流程。' },
  { Icon: BadgeCheckIcon, title: '无水印、免登录', text: '输出不带任何水印，无需注册账号，也没有积分和次数限制，完全免费使用。' },
];

export function Features() {
  return (
    <section className="section" id="features">
      <div className="container">
        <div className="section-head">
          <h2 className="gradient-text">使用高级视频压缩器压缩视频</h2>
          <p className="vic-desc">借助 FFmpeg 级别的压缩引擎，在尽量保留画质的同时把文件体积降到最低。</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">
                <f.Icon size={22} strokeWidth={1.8} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- how it works ---------------- */
const STEPS = [
  {
    tag: 'STEP 1',
    title: '上传您的视频',
    text: '选择任意需要压缩的视频文件，支持 MP4、MOV、AVI、MKV 等格式。把视频拖拽到虚线框内，或点击"选择文件"从设备中选取，也可以先试试示例视频。',
  },
  {
    tag: 'STEP 2',
    title: '选择压缩模式',
    text: '基础模式提供 90% / 70% / 50% / 30% 四档预设，也可以直接输入目标大小；高级模式可调整编码器、画质（CRF）、速度与分辨率。',
  },
  {
    tag: 'STEP 3',
    title: '下载压缩结果',
    text: '压缩完成后即可在线预览效果，对比压缩前后的体积差异，确认满意后一键下载无水印的 MP4 文件。',
  },
];

export function HowTo() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section" id="how">
      <div className="container">
        <div className="section-head">
          <h2 className="gradient-text">如何压缩视频文件</h2>
          <p className="vic-desc">通过简单的三步流程，把大视频变成便于分享和存储的小文件。</p>
        </div>
        <div className="howto-grid">
          <div className="howto-visual">
            <div className="howto-frame">
              <div className="howto-frame-top">
                <i />
                <i />
                <i />
              </div>
              <div className="howto-play">
                <span className="howto-play-circle">
                  <PlayIcon size={22} />
                </span>
              </div>
              <div className="howto-frame-bar">
                <i />
              </div>
            </div>
            <div className="howto-badges">
              <span className="howto-badge">原始 145 MB</span>
              <span className="howto-badge blue">压缩后 25 MB</span>
            </div>
          </div>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div
                key={s.tag}
                className={`step-card${open === i ? ' open' : ''}`}
                onMouseEnter={() => setOpen(i)}
                onClick={() => setOpen(i)}
              >
                <span className="step-tag">{s.tag}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- use cases ---------------- */
const USE_CASES = [
  {
    tag: '邮件附件',
    title: '用于邮件发送的视频压缩',
    text: '大体积视频作为邮件附件常常超过大小限制而无法发送。先用 VideoCompress 把视频压到附件限额之内，发送、接收和管理都更省心。',
    Icon: MailIcon,
    visual: 'uv-1',
  },
  {
    tag: '社区平台',
    title: '用于社交平台与社群的视频压缩',
    text: '很多社区对上传大小限制严格。压缩后的视频可以在不开通会员的情况下轻松分享到社群和聊天工具中，画质依然清晰。',
    Icon: ChatIcon,
    visual: 'uv-2',
  },
  {
    tag: '释放空间',
    title: '为设备和网盘释放存储空间',
    text: '把手机、电脑里积压的视频统一压缩归档，平均可减少一半以上的占用空间，备份上云也更快、更省流量。',
    Icon: HardDriveIcon,
    visual: 'uv-3',
  },
];

export function UseCases() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="gradient-text">在日常场景中使用视频压缩器</h2>
          <p className="vic-desc">让视频在日常工作中更易于分享、存储和管理。</p>
        </div>
        <div className="usecase-grid">
          {USE_CASES.map((u, i) => (
            <article className={`usecase-card${i % 2 === 1 ? ' flip' : ''}`} key={u.title}>
              <div className={`usecase-visual ${u.visual}`}>
                <span className="uv-badge">{u.tag}</span>
                <span className="uv-icon">
                  <u.Icon size={30} strokeWidth={1.6} />
                </span>
              </div>
              <div className="usecase-text">
                <span className="usecase-tag">{u.tag}</span>
                <h3>{u.title}</h3>
                <p>{u.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- reviews ---------------- */
const REVIEWS = [
  {
    name: 'Alex Rivera',
    role: '创新科技 CTO',
    color: '#3c83f6',
    text: '压缩流程完全在浏览器里完成这点太省心了，敏感演示视频再也不用传到第三方服务器。4K 素材压完依然清晰。',
  },
  {
    name: '林晓萌',
    role: '市场团队负责人',
    color: '#8b5cf6',
    text: '每天都在给客户发视频方案，以前总要先传网盘。现在直接压到 20MB 以内发邮件，效率高太多了。',
  },
  {
    name: 'David Kim',
    role: '独立开发者',
    color: '#f97316',
    text: '高级模式里的 CRF 和分辨率控制非常专业，输出就是标准 FFmpeg 品质，完全替代了我本地的命令行流程。',
  },
  {
    name: '王思远',
    role: '在线教育讲师',
    color: '#10b981',
    text: '课程视频动辄好几个 G，压缩后体积减半以上画质几乎看不出差别，学员下载播放都顺畅了。',
  },
  {
    name: 'Sofia Martins',
    role: '内容创作者',
    color: '#ec4899',
    text: '无水印、免登录、不限次数，这三点就值得五星。界面清爽，妈妈都能上手。',
  },
  {
    name: '陈建国',
    role: '企业 IT 管理',
    color: '#0ea5e9',
    text: '公司对数据外发管控严格，本地处理的方案直接通过了安全评估，成了团队标配小工具。',
  },
  {
    name: 'Marcus Lee',
    role: '视频博主',
    color: '#f59e0b',
    text: '上传社群前的最后一道工序。90% 预设压出来的体积刚好卡在限制之下，省了大量重新导出的时间。',
  },
  {
    name: '刘婉如',
    role: '自媒体运营',
    color: '#6366f1',
    text: '之前用别的工具总要注册、买积分。这个完全免费还更快，已经推荐给全组同事。',
  },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Reviews() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="gradient-text">用户评价</h2>
          <p className="vic-desc">从超大的 4K 文件到日常社媒内容，用户都信赖 VideoCompress 快速完成视频压缩。</p>
        </div>
        <div className="reviews-grid">
          {REVIEWS.map((r) => (
            <div className="review-card" key={r.name}>
              <div className="stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} size={14} />
                ))}
              </div>
              <p className="review-text">{r.text}</p>
              <div className="review-person">
                <span className="avatar" style={{ background: r.color }}>
                  {initials(r.name)}
                </span>
                <span>
                  <span className="review-name">{r.name}</span>
                  <br />
                  <span className="review-role">{r.role}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- size comparison ---------------- */
const COMPARE = [
  { mode: '原始', width: '100%', bytes: '145 MB', delta: '', cls: 'origin' },
  { mode: '基础', width: '47%', bytes: '68 MB', delta: '-53.1%', cls: 'basic' },
  { mode: '强力', width: '18%', bytes: '25 MB', delta: '-82.8%', cls: 'strong' },
  { mode: '高级', width: '24%', bytes: '35 MB', delta: '-75.9%', cls: 'adv' },
];

export function Compare() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="gradient-text">轻松压缩视频</h2>
          <p className="vic-desc">只需几个步骤，就能把大视频文件变成更小、更实用的文件。</p>
        </div>
        <div className="compare-box">
          {COMPARE.map((c) => (
            <div className="compare-item" key={c.mode}>
              <span className="mode">{c.mode}</span>
              <div className="track">
                <div className={`bar ${c.cls}`} style={{ width: c.width }}>
                  {c.bytes}
                </div>
              </div>
              <span className="delta">{c.delta}</span>
            </div>
          ))}
          <p className="crf-caption" style={{ textAlign: 'center', marginTop: 4 }}>
            示例：4K 视频（145 MB）分别使用三种模式压缩后的体积对比
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- CTA ---------------- */
export function Cta() {
  return (
    <section className="section">
      <div className="cta-box">
        <h2>立即开始压缩你的视频</h2>
        <p>无需注册、无需上传、没有水印和次数限制——把视频拖进来，几步就能得到更小的文件。</p>
        <a className="cta-pill" href="#compress">
          <PlayIcon size={14} /> 立即压缩视频
        </a>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
const FAQS = [
  {
    q: '我的文件会被上传到服务器吗？',
    a: '不会。VideoCompress 使用 WebAssembly 技术把 FFmpeg 编译进浏览器，解码、压缩、编码全部在你的设备本地完成。即使压缩过程中断网，也不影响处理。',
  },
  {
    q: 'VideoCompress 是如何工作的？',
    a: '核心是运行在浏览器沙箱里的 FFmpeg 引擎。首次使用时会下载约 31MB 的引擎文件（之后有缓存），之后你选择的压缩参数会被转换成标准的 FFmpeg 命令在本地执行。',
  },
  {
    q: '如何在尽量不损失画质的情况下缩小体积？',
    a: '建议优先使用 50% 或 30% 预设，或切换到高级模式选择较低的 CRF 值（数值越小画质越高）。H.265 编码器在同画质下体积更小，但压缩速度明显更慢。',
  },
  {
    q: '压缩后的视频要怎么播放？',
    a: '输出为通用性最好的 MP4（H.264 + AAC，并启用 faststart），主流浏览器、手机、电脑和剪辑软件都能直接打开。',
  },
  {
    q: '视频压缩用哪种编码器更好？',
    a: 'H.264 速度最快、兼容性最好，适合绝大多数场景；H.265（HEVC）能再省 20-40% 体积，特别适合 1080p / 4K 内容，但耗时约为 H.264 的数倍。',
  },
  {
    q: '有视频大小限制吗？',
    a: '没有人为限制，但受浏览器内存制约，建议处理 500MB 以内的文件。更大的文件也能尝试，取决于你设备的内存余量。',
  },
  {
    q: '比云端压缩工具慢还是快？',
    a: '小视频（几分钟内）通常更快，因为省去了上传和排队时间。超长视频受浏览器单线程编码限制会慢一些——这是"文件不出本机"所付出的合理代价。',
  },
  {
    q: '真的完全免费吗？',
    a: '是的。因为计算发生在你自己的设备上，没有服务器成本，也就没有理由收费。无水印、无积分、无订阅。',
  },
  {
    q: '需要下载或安装软件吗？',
    a: '不需要。在 Windows、Mac、Linux、iPhone 或 Android 的现代浏览器中打开网页即可使用，也可以把它添加到主屏幕当轻应用用。',
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="section" id="faq">
      <div className="container">
        <div className="section-head">
          <h2 className="gradient-text">VideoCompress 常见问题</h2>
          <p className="vic-desc">关于本地视频压缩，你想了解的都在这里：快速、简单、并保持高质量。</p>
        </div>
        <div className="faq-wrap">
          {FAQS.map((f, i) => (
            <div className={`faq-item${open === i ? ' open' : ''}`} key={f.q}>
              <button className="faq-q" onClick={() => setOpen(open === i ? null : i)}>
                {f.q}
                <ChevronDown size={18} />
              </button>
              <div className="faq-a" style={open === i ? { maxHeight: 260 } : undefined}>
                <div className="faq-a-inner">{f.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- footer ---------------- */
import { goHomeAnchor, navigate } from '../lib/router';
import { ALL_TOOLS } from '../tools/nav';

const FOOTER_ABOUT: Array<{ label: string; onClick: () => void }> = [
  { label: '功能特性', onClick: () => goHomeAnchor('features') },
  { label: '常见问题', onClick: () => goHomeAnchor('faq') },
  { label: '价格', onClick: () => navigate('/pricing') },
  { label: '博客', onClick: () => navigate('/blog') },
  { label: '隐私说明', onClick: () => navigate('/privacy') },
  { label: '使用条款', onClick: () => navigate('/terms') },
];

export function Footer() {
  const groups = [
    { title: '压缩', items: ALL_TOOLS.filter((t) => t.group === 'compress') },
    { title: '编辑', items: ALL_TOOLS.filter((t) => t.group === 'edit') },
    { title: '转换', items: ALL_TOOLS.filter((t) => t.group === 'convert') },
    { title: 'AI 工具', items: ALL_TOOLS.filter((t) => t.group === 'ai') },
  ];
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <span className="header-logo" style={{ fontSize: 15 }}>
              <span className="logo-mark">
                <PlayIcon size={11} />
              </span>
              VideoCompress
            </span>
            <span className="footer-tagline">快速压缩视频，无水印、不上传，文件全程留在你的设备上。</span>
          </div>
          <div className="footer-social">
            <span className="social-dot" title="X (Twitter)">
              𝕏
            </span>
            <span className="social-dot" title="Discord">
              💬
            </span>
            <span className="social-dot" title="GitHub">
              ⌘
            </span>
          </div>
        </div>
        <div className="footer-cols">
          {groups.map((g) => (
            <div className="footer-col" key={g.title}>
              <h4>{g.title}</h4>
              {g.items.map((t) => (
                <a key={t.path} href={`#${t.path}`}>
                  {t.label}
                </a>
              ))}
            </div>
          ))}
          <div className="footer-col">
            <h4>关于</h4>
            {FOOTER_ABOUT.map((it) => (
              <a
                key={it.label}
                href="#/"
                onClick={(e) => {
                  e.preventDefault();
                  it.onClick();
                }}
              >
                {it.label}
              </a>
            ))}
          </div>
        </div>
        <div className="footer-bottom">© 2026 VideoCompress. 版权所有。 · 基于 FFmpeg (WebAssembly) 本地构建</div>
      </div>
    </footer>
  );
}
