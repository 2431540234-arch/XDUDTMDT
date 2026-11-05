'use client';

import { useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

interface Props {
  label?: string;
  hint?: string;
  accept?: string;
  maxMB?: number;
  multiple?: boolean;
  /** Trả về danh sách file hợp lệ (mock không upload thật) */
  onFiles: (files: File[]) => void;
  /** Ảnh xem trước (data URL / URL) */
  preview?: string | null;
  onError?: (message: string) => void;
  className?: string;
}

/** Vùng kéo thả tải tệp (WIREFRAME 3.3, 7.21, 7.23): kiểm tra loại tệp và dung lượng phía client */
export default function UploadDropzone({
  label,
  hint = 'Kéo thả ảnh hoặc click để tải lên – PNG, JPG (tối đa 5MB)',
  accept = 'image/png,image/jpeg',
  maxMB = 5,
  multiple,
  onFiles,
  preview,
  onError,
  className,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    const exts = accept.split(',').map((a) => a.trim());
    const ok: File[] = [];
    for (const f of files) {
      const extOk = exts.some((a) =>
        a.startsWith('.')
          ? f.name.toLowerCase().endsWith(a)
          : a.endsWith('/*')
            ? f.type.startsWith(a.slice(0, -1))
            : f.type === a,
      );
      if (!extOk) onError?.(`Tệp "${f.name}" không đúng định dạng cho phép.`);
      else if (f.size > maxMB * 1024 * 1024) onError?.(`Tệp "${f.name}" vượt quá ${maxMB}MB.`);
      else ok.push(f);
    }
    if (ok.length) onFiles(ok);
  };

  return (
    <div className={className}>
      {label && <p className="mb-1.5 text-sm font-medium">{label}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handle(e.dataTransfer.files);
          }}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-2 rounded-btn border-2 border-dashed px-4 py-8 text-center transition',
            drag
              ? 'border-primary bg-primary-soft'
              : 'border-line bg-surface-muted/30 hover:border-primary/60',
          )}
        >
          <Icon name="upload" size={26} className="text-primary" />
          <span className="text-sm text-muted">{hint}</span>
        </button>
        {preview !== undefined && (
          <div className="flex h-auto w-28 shrink-0 items-center justify-center overflow-hidden rounded-btn border border-line bg-surface-muted/40">
            {preview ? (
              <img src={preview} alt="Xem trước" className="h-full w-full object-cover" />
            ) : (
              <Icon name="image" size={28} className="text-muted" />
            )}
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  );
}

/** Đọc file ảnh thành data URL để xem trước/lưu vào mock */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
