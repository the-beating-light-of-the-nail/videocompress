# videocompress.ai — Design Tokens & Global Foundation (extracted 2026-09-15)

## Typography
- Body: `Inter, sans-serif` (self-host or Google Fonts; UI falls back to `ui-sans-serif, system-ui`)
- H1 (hero): 40.8px @1440 (classes: `text-[2rem] md:text-[2.35rem] lg:text-[2.55rem]`), weight 700, `leading-relaxed`,
  **gradient text**: `linear-gradient(#171717, #525252)` + `background-clip: text` (dark gray → mid gray)
- H2 (sections): ~36px bold (`text-2xl md:text-4xl font-bold leading-[1.18]`), same `.gradient-text` class
- Section description (`.vic-desc`): 18px, color `rgb(64,64,64)` / `#404040`, centered
- Small labels: 12px semibold `text-gray-700`; micro: 10-11px

## Colors (from :root CSS vars + computed styles)
- `--primary: 217 91% 60%` → **#3C83F6** (rgb 60,131,246)); primary-foreground near-white
- Page background: `#FFFFFF`; body text `#0A0A0A`
- Section alt background: `#F8F8F8` (trust strip), footer `#F7F8FB`
- Gray ramp (Tailwind): gray-700 #374151, gray-600 #4B5563, gray-500 #6B7280, neutral-500 #737373, neutral-600 #525252
- Amber info banner: border `amber-200/60`, bg `amber-50/80`, text `amber-800`, strong `amber-900`
- Card accents: `--secondary: 214 95% 93%` (light blue), selected chip bg `blue-50/60` + border `#3C83F6`
- Border grays: `gray-200/80`, `gray-100`, use-case card border `#D8E6FB`
- Radius scale: chips/panels `rounded-xl` 12px, cards `rounded-3xl` 24px / `rounded-[28px]` 28px, workspace `rounded-2xl` 16px, FAQ `rounded-lg` 8px, CTA pill `rounded-full`
- Shadows: card `shadow-sm`; use-case `0 20px 60px rgba(...)` large soft; primary btn `0 1px 3px rgba(0,0,0,.1)`

## Header (sticky)
- Height 64px, `sticky top-0 z-30`, bg `rgba(255,255,255,0.7)`, `backdrop-filter: blur(40px)`,
  border-bottom `1px solid rgba(241,245,249,0.7)` (slate-100/70)
- Left: logo (image `logo.svg`: blue play mark + wordmark). Right: nav "产品"(dropdown) "价格" "下载客户端" "登录" + language switcher
- Note: full desktop layout = fixed left sidebar (product tree, ~230px, `ease-sidebar`) + content column;
  the sidebar is `hidden lg:flex` — visible ≥1024px

## Buttons
- Primary (选择文件 split button): bg #3C83F6, radius 12px (rounded-2xl), white text semibold,
  left segment with white circle icon + label, 1px white/30 divider, right chevron segment, shadow-sm
- Standard primary (开始压缩): full-width, h-10 (40px), rounded, bg-primary, white, arrow icon
- Ghost/outline (CTA): `rounded-full border border-neutral-300/30`, w-60 h-10, shadow-small

## Workspace (hero compressor) geometry @1440
- Container `max-w-5xl` (1024px), card `grid gap-5 p-5 rounded-2xl border gray-200/80 bg-white shadow-sm`
- Left `video-preview-area`: 512×640, `rounded-xl bg-slate-50`; dropzone `border-2 dashed rounded-xl p-5`;
  sample-video button top-right (ghost pill); upload illustration img 48×36; title 14px semibold;
  2 hint lines 12px `text-neutral-500`
- Right settings panel: 450×640 `rounded-xl border-gray-100 p-4 shadow-sm`
  - Tabs: `grid-cols-2 bg-slate-100 p-1 rounded-lg`, active tab = white bg + shadow, h-8, 14px medium
  - Basic: legend "压缩预设" 12px semibold gray-700; 4 chips `grid-cols-4 gap-1.5`, chip h-53 `rounded-xl border p-2`,
    icon + label 12px bold gray-800, sub 10px semibold blue-600 ("90% 更小"…);
    selected: `border-primary bg-blue-50/60`
  - "压缩后大小：" row: label 12px semibold + input `h-8 w-20 rounded-md border text-right` + "MB" + slider
    (track h-1.5 bg primary/20, thumb 20px circle border-2 primary)
  - Advanced (`advanced-settings grid grid-cols-2 gap-x-3 gap-y-2.5`): 视频编码 select (H.264/H.265),
    压缩方式 select (按视频质量/按文件大小), 选择质量(CRF) col-span-2 slider+caption
    ("21 良好质量 - 中等大小（默认）"), 压缩速度 col-span-2 select (非常快…), + conditional field
  - Actions bottom: `mt-auto border-t gray-100 pt-3`: primary "开始压缩" h-10 full width + arrow;
    amber credits banner `rounded-lg text-[11px] px-2 py-1.5` (we replace with a privacy/local-processing banner)

## Sections inventory (top→bottom, content column widths)
1. `compressor-hero` — H1 + vic-desc + workspace (max-w-5xl)
2. Trust strip — `bg-[#f8f8f8] px-4`, H2 `.gradient-text` + vic-desc centered, logo row
   (flex wrap center gap-10; grayscale brand logos) — we render neutral wordmark chips
3. Features — `max-w-7xl`, H2 + desc, `grid sm:2 md:3 gap-6`;
   card `rounded-3xl p-6 bg-gradient-to-b from-neutral-100 to-white` (rendered: white, border, radius ~16-20px,
   squircle blue-gradient icon badge 48px with white line glyph + soft glow);
   title 16px bold neutral-800; body 14px neutral-600 leading-relaxed
4. How-to — `max-w-[1200px]`; left: aspect-video (560px) rounded-3xl crossfading illustration
   (light blue gradient panel + white frame); right: 3 hover-expand step cards
   (`rounded-xl`, expanded 190px / collapsed 62px, "STEP 1" 12px bold primary + title 16px bold + desc 14px gray-600);
   INTERACTION: hover/click expands a step & crossfades the matching image
5. Use cases — `max-w-[1200px]`, 3 article cards `rounded-[28px] border-[#d8e6fb] bg-white p-5
   shadow-[0_20px_60px_rgba(219,234,254,0.6)]`, grid 2-col (image / text) alternating order;
   small blue tag pill + h3 20px bold + p 14px gray-600
6. Reviews — `max-w-7xl px-10`, H2 + desc, 2-col masonry (`md:grid-cols-2 gap-6`);
   card `rounded-xl p-4 border` white; 5 blue star SVGs; quote 14px; footer: 32px round avatar + name bold 14px + role 12px gray
7. Compare — `video-reduce-container` H2 + desc; centered video demo 750px with size badge overlay
   ("4K 145MB") + 4 mode option buttons under video (原始/基础/强力/高级, 120×66, active = primary border+ring);
   static fallback: bars 原始 145MB → 基础 68MB(-53.1%) 强力 25MB(-82.8%) 高级 35MB(-75.9%)
8. CTA — centered `max-w-4xl rounded-2xl border slate-500/20 bg-neutral-50 p-10 shadow-inner`;
   H2 24-32px bold black; p 20px(text-xl) gray-600; pill button (w-60 h-10 rounded-full border)
9. FAQ — `max-w-[1200px] flex flex-col gap-4 text-center`, H2 + vic-desc;
   accordion container 700px; item `w-full border rounded-lg` h-62 collapsed, open → `border-primary`,
   header button h-60 font-medium 15px + chevron, body 14px `text-gray-500/gray-600`
10. Footer — `mt-10 bg-[#f7f8fb] text-[#171b2a]`; top: logo + tagline + social/lang (border-b #E1E5EB pb-6);
    middle: 5-col link grid (压缩/编辑/转换/AI 工具/关于) py-7; bottom: "© 2026 VideoCompress. 版权所有。" 12px

## Assets policy (deliberate)
- Their logo, upload illustration, photos, how-to/use-case images, avatar photos are NOT copied.
  We recreate: own logo (blue play mark), lucide line icons, initial-circle avatars, CSS/SVG illustrations.
- Fonts: load Inter from Google Fonts.
