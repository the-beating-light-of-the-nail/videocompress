import { useRef, useState } from 'react';
import { ChevronRight, FolderIcon, PlayIcon, UploadCloud } from './Icons';

export interface DropzoneSample {
  label: string;
  url: string;
  name: string;
  type: string;
}

interface Props {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  hints: string[];
  btnLabel?: string;
  sample?: DropzoneSample;
  onError?: (msg: string) => void;
  className?: string;
}

export default function Dropzone({
  accept,
  multiple,
  onFiles,
  title,
  hints,
  btnLabel = '选择文件',
  sample,
  onError,
  className,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSample = async () => {
    try {
      const res = await fetch(sample!.url);
      if (!res.ok) throw new Error('sample missing');
      const blob = await res.blob();
      onFiles([new File([blob], sample!.name, { type: sample!.type })]);
    } catch {
      onError?.('示例文件加载失败，请直接选择本地文件。');
    }
  };

  return (
    <div
      className={`dropzone${dragOver ? ' drag-over' : ''}${className ? ` ${className}` : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length > 0) onFiles(multiple ? files : [files[0]]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = '';
        }}
      />
      {sample && (
        <button
          className="sample-btn"
          onClick={(e) => {
            e.stopPropagation();
            void loadSample();
          }}
        >
          <PlayIcon size={12} /> {sample.label}
        </button>
      )}
      <div className="upload-illustration">
        <UploadCloud size={52} style={{ color: '#94a3b8' }} strokeWidth={1.5} />
      </div>
      <p className="upload-title">{title}</p>
      {hints.map((h) => (
        <p className="upload-hint" key={h}>
          {h}
        </p>
      ))}
      <button
        className="split-btn"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        <span className="split-btn-main">
          <span className="split-btn-icon">
            <FolderIcon size={13} />
          </span>
          {btnLabel}
        </span>
        <span className="split-btn-div" />
        <span className="split-btn-side">
          <ChevronRight size={15} />
        </span>
      </button>
    </div>
  );
}
