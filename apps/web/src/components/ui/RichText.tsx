// Hiển thị nội dung trang tĩnh dạng Markdown đơn giản: "## tiêu đề", "- gạch đầu dòng", đoạn văn
import type { ReactNode } from 'react';

export function parseBlocks(src: string): Array<{ type: 'h' | 'p' | 'ul'; text?: string; items?: string[] }> {
  const out: Array<{ type: 'h' | 'p' | 'ul'; text?: string; items?: string[] }> = [];
  for (const line of src.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('## ')) out.push({ type: 'h', text: t.slice(3) });
    else if (t.startsWith('- ')) {
      const last = out[out.length - 1];
      if (last?.type === 'ul') last.items!.push(t.slice(2));
      else out.push({ type: 'ul', items: [t.slice(2)] });
    } else out.push({ type: 'p', text: t });
  }
  return out;
}

export default function RichText({ content }: { content: string }): ReactNode {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parseBlocks(content).map((b, i) =>
        b.type === 'h' ? (
          <h2 key={i} className="pt-4 text-lg font-extrabold text-ink">
            {b.text}
          </h2>
        ) : b.type === 'ul' ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items!.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className={b.text!.startsWith('_') ? 'text-xs italic text-muted' : undefined}>
            {b.text!.replace(/^_|_$/g, '')}
          </p>
        ),
      )}
    </div>
  );
}
