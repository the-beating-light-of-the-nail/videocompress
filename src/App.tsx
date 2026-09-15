import { Suspense, lazy, useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import HomePage from './components/HomePage';
import { Footer } from './components/Sections';
import { useRoute } from './lib/router';
import { BlogPage, DesktopPage, LegalPage, PricingPage } from './components/StaticPages';

const ImageCompressPage = lazy(() => import('./tools/ImageCompressPage'));
const PdfCompressPage = lazy(() => import('./tools/PdfCompressPage'));
const VideoCutterPage = lazy(() => import('./tools/VideoCutterPage'));
const CropVideoPage = lazy(() => import('./tools/CropVideoPage'));
const AudioCutterPage = lazy(() => import('./tools/AudioCutterPage'));
const VideoToMp3Page = lazy(() => import('./tools/VideoToMp3Page'));
const VideoToTextPage = lazy(() => import('./tools/VideoToTextPage'));
const VideoTranslatorPage = lazy(() => import('./tools/VideoTranslatorPage'));
const PdfTranslatorPage = lazy(() => import('./tools/PdfTranslatorPage'));
const ImageTranslatorPage = lazy(() => import('./tools/ImageTranslatorPage'));

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const path = useRoute();

  const page = (() => {
    switch (path) {
      case '/image-compressor':
        return <ImageCompressPage />;
      case '/pdf-compressor':
        return <PdfCompressPage />;
      case '/video-cutter':
        return <VideoCutterPage />;
      case '/crop-video':
        return <CropVideoPage />;
      case '/audio-cutter':
        return <AudioCutterPage />;
      case '/video-to-mp3':
        return <VideoToMp3Page />;
      case '/video-to-text':
        return <VideoToTextPage />;
      case '/video-translator':
        return <VideoTranslatorPage />;
      case '/pdf-translator':
        return <PdfTranslatorPage />;
      case '/image-translator':
        return <ImageTranslatorPage />;
      case '/pricing':
        return <PricingPage />;
      case '/blog':
        return <BlogPage />;
      case '/privacy':
        return <LegalPage kind="privacy" />;
      case '/terms':
        return <LegalPage kind="terms" />;
      case '/subscription-policies':
        return <LegalPage kind="subscription" />;
      case '/desktop':
        return <DesktopPage />;
      default:
        return <HomePage />;
    }
  })();

  return (
    <div className="shell" id="top">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="content">
        <Header onMenu={() => setMenuOpen(true)} />
        <Suspense fallback={<div className="page-loading">正在加载工具…</div>}>{page}</Suspense>
        <Footer />
      </div>
    </div>
  );
}
