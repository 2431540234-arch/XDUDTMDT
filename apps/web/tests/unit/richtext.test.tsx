import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RichText from '../../src/components/ui/RichText';

// Nội dung trang tĩnh là Markdown do admin nhập; FE phải hiển thị đúng định dạng và không thực thi mã độc (XSS).
describe('RichText (Markdown an toàn)', () => {
  it('hiển thị tiêu đề, đoạn văn, danh sách, in đậm và liên kết', () => {
    const { container } = render(
      <RichText
        content={
          '## Giao hàng\n\nChúng tôi giao **toàn quốc**.\n\n- Nội thành 1-2 ngày\n- Tỉnh 3-5 ngày\n\nXem [đổi trả](https://aurelia.vn/doi-tra).'
        }
      />,
    );
    expect(container.querySelector('h2')?.textContent).toBe('Giao hàng');
    expect(container.querySelector('strong')?.textContent).toBe('toàn quốc');
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://aurelia.vn/doi-tra');
    expect(a?.getAttribute('rel')).toContain('noopener');
  });

  it('XSS: không dựng thẻ script/img/iframe, không có thuộc tính on*, bỏ liên kết javascript:', () => {
    const { container } = render(
      <RichText
        content={
          'Chào <script>window.__xss = 1</script><img src=x onerror="window.__xss = 2"><iframe src="//evil"></iframe>\n\n' +
          '[bấm](javascript:window.__xss=3) và [ảnh](data:text/html;base64,AAAA) [vbs](vbscript:x)\n\n' +
          '<a href="javascript:alert(1)" onclick="alert(2)">html thô</a>'
        }
      />,
    );
    expect(container.querySelector('script, img, iframe')).toBeNull();
    expect(container.innerHTML).not.toMatch(/onerror|onclick/i);
    for (const a of Array.from(container.querySelectorAll('a'))) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/^(javascript|data|vbscript):/i);
    }
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });
});
