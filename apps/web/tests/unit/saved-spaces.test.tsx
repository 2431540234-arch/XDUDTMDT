import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// UC-SPACE-04: trang /account/saved-spaces – loading, trống, lỗi, danh sách, bỏ lưu, lùi trang.
const { list, unbookmark, toast } = vi.hoisted(() => ({
  list: vi.fn(),
  unbookmark: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../../src/services/space.api', () => ({
  spaceApi: {
    list: (...a: unknown[]) => list(...a),
    unbookmark: (...a: unknown[]) => unbookmark(...a),
    bookmark: vi.fn(),
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 1, fullName: 'Khách' } }) }));
vi.mock('../../src/store/uiStore', () => ({ toast }));

import SavedSpacesPage from '../../src/app/(account)/account/saved-spaces/page';

const space = (id: number, slug: string) => ({
  id,
  slug,
  title: `Phòng ${slug}`,
  roomType: 'living_room',
  style: 'Hiện đại',
  description: null,
  coverUrl: null,
  productCount: 3,
  panoramaCount: 1,
  isBookmarked: true,
});
const page = (items: unknown[], pageNo = 1, totalPages = 1) => ({
  items,
  meta: { page: pageNo, pageSize: 12, total: items.length, totalPages },
});

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('Trang không gian đã lưu', () => {
  beforeEach(() => {
    list.mockReset();
    unbookmark.mockReset();
    Object.values(toast).forEach((f) => f.mockReset());
  });

  it('gọi API với bookmarked=true và hiển thị trạng thái đang tải rồi danh sách', async () => {
    list.mockResolvedValue(page([space(1, 'a'), space(2, 'b')]));
    wrap(<SavedSpacesPage />);
    expect(screen.getByTestId('saved-spaces-loading')).toBeInTheDocument();
    expect(await screen.findByTestId('saved-spaces-list')).toBeInTheDocument();
    expect(screen.getByText('Phòng a')).toBeInTheDocument();
    expect(screen.getByText('Phòng b')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ bookmarked: true, page: 1, pageSize: 12 });
  });

  it('chưa lưu không gian nào ⇒ trạng thái trống có liên kết tới /spaces', async () => {
    list.mockResolvedValue(page([]));
    wrap(<SavedSpacesPage />);
    expect(await screen.findByText('Bạn chưa lưu không gian nào')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Khám phá không gian mẫu/ })).toHaveAttribute('href', '/spaces');
  });

  it('lỗi tải ⇒ hiển thị lỗi và nút Thử lại gọi lại API', async () => {
    list.mockRejectedValueOnce(new Error('boom'));
    wrap(<SavedSpacesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh sách không gian đã lưu.');
    list.mockResolvedValueOnce(page([space(1, 'a')]));
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Phòng a')).toBeInTheDocument();
  });

  it('bỏ lưu: gọi unbookmark đúng slug, báo thành công và tải lại danh sách (mục biến mất)', async () => {
    list.mockResolvedValueOnce(page([space(1, 'a'), space(2, 'b')]));
    unbookmark.mockResolvedValue(null);
    wrap(<SavedSpacesPage />);
    await screen.findByText('Phòng b');
    list.mockResolvedValueOnce(page([space(1, 'a')]));
    fireEvent.click(screen.getAllByRole('button', { name: 'Bỏ khỏi danh sách' })[1]);
    await waitFor(() => expect(unbookmark).toHaveBeenCalledWith('b'));
    await waitFor(() => expect(screen.queryByText('Phòng b')).not.toBeInTheDocument());
    expect(screen.getByText('Phòng a')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Đã bỏ lưu không gian.');
  });

  it('bỏ lưu thất bại ⇒ báo lỗi và vẫn giữ mục trong danh sách', async () => {
    list.mockResolvedValue(page([space(1, 'a')]));
    unbookmark.mockRejectedValue(new Error('mạng lỗi'));
    wrap(<SavedSpacesPage />);
    await screen.findByText('Phòng a');
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ khỏi danh sách' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText('Phòng a')).toBeInTheDocument();
  });

  it('nhiều trang: có phân trang; bỏ lưu mục cuối của trang 2 thì lùi về trang 1', async () => {
    list.mockImplementation(async (q: { page: number }) =>
      q.page === 2 ? page([space(13, 'm')], 2, 2) : page([space(1, 'a')], 1, 2),
    );
    unbookmark.mockResolvedValue(null);
    wrap(<SavedSpacesPage />);
    await screen.findByText('Phòng a');
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await screen.findByText('Phòng m');
    expect(list).toHaveBeenLastCalledWith({ bookmarked: true, page: 2, pageSize: 12 });
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ khỏi danh sách' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ bookmarked: true, page: 1, pageSize: 12 }));
    expect(await screen.findByText('Phòng a')).toBeInTheDocument();
  });
});
