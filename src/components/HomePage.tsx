import { useEffect } from 'react';
import Compressor from './Compressor';
import { Cta, Compare, Faq, Features, HowTo, Reviews, Trust, UseCases } from './Sections';

export default function HomePage() {
  useEffect(() => {
    document.title = 'VideoCompress - 免费在线视频压缩工具';
  }, []);
  return (
    <main>
      <section className="hero">
        <h1 className="gradient-text">免费在线视频压缩工具</h1>
        <p className="vic-desc">在浏览器本地快速压缩视频，无水印、无需上传，画质表现出色。</p>
      </section>

      <div className="workspace-wrap">
        <Compressor />
      </div>

      <Trust />
      <Features />
      <HowTo />
      <UseCases />
      <Reviews />
      <Compare />
      <Cta />
      <Faq />
    </main>
  );
}
