import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHydrated } from '../../src/hooks/useHydrated';

// Hồi quy lỗi hydration của breadcrumb (KNOWN_ISSUES.md mục 1): máy chủ không có dữ liệu danh mục; nếu bộ nhớ đệm của client
// ĐÃ có dữ liệu khi component hydrate (Header nạp xong trước) thì lần render đầu của client khác HTML máy chủ.
// Ở đây "bộ nhớ đệm" là một biến module đã có dữ liệu lúc hydrate; không cần React Query để kiểm cơ chế.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cache = { categories: ['Phòng khách'] as string[] | undefined };

function Crumb({ safe }: { safe: boolean }) {
  const hydrated = useHydrated();
  const data = safe ? (hydrated ? cache.categories : undefined) : cache.categories;
  return <nav>{data ? <a href="/products">Sản phẩm</a> : <span>Sản phẩm</span>}</nav>;
}

async function hydrate(safe: boolean) {
  const saved = cache.categories;
  cache.categories = undefined; // máy chủ: chưa có danh mục
  const html = renderToString(<Crumb safe={safe} />);
  cache.categories = saved; // client: Header đã nạp danh mục trước lúc hydrate
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const errors: string[] = [];
  const spy = vi
    .spyOn(console, 'error')
    .mockImplementation((...a) => void errors.push(a.map(String).join(' ')));
  await act(async () => {
    hydrateRoot(container, <Crumb safe={safe} />, { onRecoverableError: (e) => errors.push(String(e)) });
  });
  spy.mockRestore();
  return {
    html,
    container,
    errors: errors.filter((e) => /hydrat|Expected server HTML|did not match/i.test(e)),
  };
}

describe('useHydrated: lần render đầu của client giống HTML máy chủ', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('máy chủ render false (không dữ liệu); sau hydrate dữ liệu có sẵn được áp dụng, KHÔNG lỗi hydration', async () => {
    const r = await hydrate(true);
    expect(r.html).toContain('<span>Sản phẩm</span>');
    expect(r.errors).toEqual([]);
    expect(r.container.querySelector('a[href="/products"]')).not.toBeNull(); // sau hydrate đã dùng danh mục
  });

  it('đối chứng: không dùng useHydrated (đọc thẳng cache) thì bị lỗi hydration như lỗi thật', async () => {
    const r = await hydrate(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
