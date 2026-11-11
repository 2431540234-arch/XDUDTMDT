// Hiển thị nội dung trang tĩnh/chính sách dạng Markdown (CONG_NGHE.md mục 4: soạn bằng textarea Markdown).
// An toàn XSS: react-markdown dựng phần tử React (không dùng dangerouslySetInnerHTML); HTML thô bị bỏ (skipHtml, KHÔNG
// dùng rehype-raw); liên kết javascript:/data: bị urlTransform mặc định của react-markdown loại bỏ.
import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';

const components: Components = {
  h1: ({ children }) => <h2 className="pt-4 text-xl font-extrabold text-ink">{children}</h2>,
  h2: ({ children }) => <h2 className="pt-4 text-lg font-extrabold text-ink">{children}</h2>,
  h3: ({ children }) => <h3 className="pt-3 text-base font-bold text-ink">{children}</h3>,
  p: ({ children }) => <p>{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="text-muted">{children}</em>,
  a: ({ href, children }) => {
    const external = /^https?:\/\//i.test(href ?? '');
    return (
      <a
        href={href}
        className="font-medium text-primary underline"
        {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
      >
        {children}
      </a>
    );
  },
};

export default function RichText({ content }: { content: string }): ReactNode {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <ReactMarkdown skipHtml components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
