# videocompress.ai — Observed Behaviors

- **Header**: sticky top, constant style (white/70 + blur(40px) + hairline border) — no scroll transition observed.
- **Desktop layout**: fixed left sidebar (~230px, product tree) visible ≥1024px; content column beside it.
  Mobile: sidebar hidden, hamburger in header toggles a slide-in drawer.
- **Compressor tabs** (基础压缩/高级压缩): click-driven; active tab white bg + shadow on slate-100 track.
- **Preset chips**: click to select → `border-primary bg-blue-50/60`; also drives the target-size MB value.
- **Target size**: number input + slider pair (same value, two controls).
- **Advanced panel**: mode select swaps CRF slider ↔ size input row.
- **How-to steps**: hover/click expands a step card (190px) and collapses others; left image crossfades to match.
- **FAQ**: accordion, one-open-at-a-time; open item gets `border-primary`; body animates height.
- **No scroll-triggered animations, no smooth-scroll library** (no .lenis / locomotive).
- **Videos in compare section**: 4 stacked videos, one visible per selected mode button (原始/基础/强力/高级).
- Clone adjustments (intentional): our engine is local (WASM), so the credits/amber banner becomes a
  local-processing notice; cloud-only sections' copy is adapted to local processing; no feedback FAB.
