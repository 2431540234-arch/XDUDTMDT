// Service gọi API nội dung công khai: banner, trang tĩnh, FAQ, liên hệ, cài đặt, thông báo
import type { Page } from '@aurelia-living/shared-types';
import type { Banner, NotificationView, Post, StoreSettings } from '@/types/api';
import { http } from './api-client';

export interface FaqTopic {
  key: string;
  label: string;
  items: Array<{ id: number; question: string; answer: string }>;
}

export const contentApi = {
  banners: () => http.get<Banner[]>('/banners'), // TODO: chưa có trong BE
  posts: () => http.get<Post[]>('/posts'), // TODO: chưa có trong BE
  page: (slug: string) => http.get<Page>(`/pages/${slug}`),
  policies: () => http.get<Array<Pick<Page, 'slug' | 'title'>>>('/pages', { type: 'policy' }), // TODO: chưa có trong BE
  faq: () => http.get<FaqTopic[]>('/faq'), // TODO: chưa có trong BE
  contact: (body: { fullName: string; phone: string; email: string; subject: string; content: string }) =>
    http.post<null>('/contact', body), // TODO: chưa có trong BE
  settings: () => http.get<StoreSettings>('/settings/public'),
};

export const notificationApi = {
  list: (q: { type?: string; page?: number; pageSize?: number } = {}) =>
    http.list<NotificationView>('/notifications', q),
  unreadCount: () => http.get<{ count: number }>('/notifications/unread-count'), // TODO: chưa có trong BE
  markRead: (id: number) => http.patch<NotificationView>(`/notifications/${id}/read`),
  markAllRead: () => http.patch<null>('/notifications/read-all'),
};
