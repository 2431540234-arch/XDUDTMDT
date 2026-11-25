// Service gọi API nội dung công khai: FAQ, cài đặt, thông báo
import type { NotificationView, StoreSettings } from '@/types/api';
import { http } from './api-client';

export interface FaqTopic {
  key: string;
  label: string;
  items: Array<{ id: number; question: string; answer: string }>;
}

export const contentApi = {
  faq: () => http.get<FaqTopic[]>('/faq'),
  settings: () => http.get<StoreSettings>('/settings/public'),
};

export const notificationApi = {
  list: (q: { type?: string; page?: number; pageSize?: number } = {}) =>
    http.list<NotificationView>('/notifications', q),
  unreadCount: () => http.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: number) => http.patch<NotificationView>(`/notifications/${id}/read`),
  markAllRead: () => http.patch<null>('/notifications/read-all'),
};
