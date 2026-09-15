export type ToolGroup = 'compress' | 'edit' | 'convert' | 'ai';

export interface ToolMeta {
  path: string;
  label: string;
  group: ToolGroup;
  h1: string;
  sub: string;
  docTitle: string;
}

export const HOME: ToolMeta = {
  path: '/',
  label: '视频压缩',
  group: 'compress',
  h1: '免费在线视频压缩工具',
  sub: '在浏览器本地快速压缩视频，无水印、无需上传，画质表现出色。',
  docTitle: 'VideoCompress - 免费在线视频压缩工具',
};

export const IMAGE_COMPRESS: ToolMeta = {
  path: '/image-compressor',
  label: '图片压缩器',
  group: 'compress',
  h1: '免费在线图片压缩',
  sub: '免费在线图片压缩器，可快速、轻松地压缩图片，同时保持图片质量和视觉清晰度。',
  docTitle: '图片压缩器 - 免费在线批量压缩图片',
};

export const PDF_COMPRESS: ToolMeta = {
  path: '/pdf-compressor',
  label: 'PDF 压缩器',
  group: 'compress',
  h1: '在线压缩 PDF 文档',
  sub: '使用在线 PDF 压缩器快速、轻松地减小 PDF 文件大小，同时不损失质量、可读性或文档原始布局。',
  docTitle: 'PDF 压缩器 - 免费在线压缩 PDF 文件',
};

export const VIDEO_CUTTER: ToolMeta = {
  path: '/video-cutter',
  label: '视频剪切',
  group: 'edit',
  h1: '免费在线视频剪切器',
  sub: '快速且简单的视频剪切器，几秒内就能在线剪切片段、移除不需要的区段。',
  docTitle: '视频剪切器 - 免费在线剪切视频',
};

export const CROP_VIDEO: ToolMeta = {
  path: '/crop-video',
  label: '裁剪视频',
  group: 'edit',
  h1: '在线视频裁剪器',
  sub: '几秒内在线裁剪视频。可选择预设比例，也可拖拽自定义画面区域，完成后立即下载。',
  docTitle: '在线视频裁剪器 - 免费裁剪视频画面',
};

export const AUDIO_CUTTER: ToolMeta = {
  path: '/audio-cutter',
  label: '音频剪辑',
  group: 'edit',
  h1: '免费在线音频剪辑',
  sub: '上传你的音频或视频，精确裁剪所需片段并下载文件。简单、快速、全程在线。',
  docTitle: '免费在线音频剪辑 - 裁剪与截取任意音频',
};

export const VIDEO_TO_MP3: ToolMeta = {
  path: '/video-to-mp3',
  label: '视频转 MP3',
  group: 'convert',
  h1: '视频转 MP3 转换器',
  sub: '将视频转换为 MP3，立即下载你的 MP3 文件。免费在线视频转 MP3 工具，无需注册。',
  docTitle: '视频转 MP3 转换器 - 免费在线视频转 MP3',
};

export const VIDEO_TO_TEXT: ToolMeta = {
  path: '/video-to-text',
  label: '视频转文字',
  group: 'ai',
  h1: '视频转文字',
  sub: '将任何视频转换为精准文字。AI 驱动的视频转录，全部在你的浏览器本地完成，免费、在线、简单易用。',
  docTitle: '视频转文字工具 – 免费在线AI视频转录',
};

export const VIDEO_TRANSLATOR: ToolMeta = {
  path: '/video-translator',
  label: '视频翻译',
  group: 'ai',
  h1: 'AI 视频翻译',
  sub: '将视频语音转为翻译字幕，同时保留原始音频。对照原文与译文，导出多种格式的字幕文件。',
  docTitle: 'AI 视频翻译 - 免费在线视频翻译',
};

export const PDF_TRANSLATOR: ToolMeta = {
  path: '/pdf-translator',
  label: 'PDF 翻译',
  group: 'ai',
  h1: 'AI 文档翻译',
  sub: '翻译 PDF、Word、TXT 与 EPUB 文档，保留原有结构。全部在你的浏览器本地完成，无需注册。',
  docTitle: 'AI 文档翻译 - 免费在线 PDF 翻译',
};

export const IMAGE_TRANSLATOR: ToolMeta = {
  path: '/image-translator',
  label: '图片翻译',
  group: 'ai',
  h1: 'AI 图片翻译',
  sub: '上传 JPG、PNG、WEBP 图片，自动识别图中的文字并翻译，译文回填原图版面，一键下载。',
  docTitle: 'AI 图片翻译 - 免费在线图片文字翻译',
};

export const TOOL_GROUPS: Array<{ id: ToolGroup; title: string; items: ToolMeta[] }> = [
  { id: 'compress', title: '压缩', items: [HOME, IMAGE_COMPRESS, PDF_COMPRESS] },
  { id: 'edit', title: '编辑', items: [VIDEO_CUTTER, CROP_VIDEO, AUDIO_CUTTER] },
  { id: 'convert', title: '转换', items: [VIDEO_TO_MP3] },
  {
    id: 'ai',
    title: 'AI 工具',
    items: [VIDEO_TO_TEXT, VIDEO_TRANSLATOR, PDF_TRANSLATOR, IMAGE_TRANSLATOR],
  },
];

export const ALL_TOOLS: ToolMeta[] = TOOL_GROUPS.flatMap((g) => g.items);

export function toolByPath(path: string): ToolMeta | undefined {
  return ALL_TOOLS.find((t) => t.path === path);
}
