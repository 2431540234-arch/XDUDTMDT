// Chỉ cho phép chuyển hướng nội bộ (tránh open redirect qua ?next=)
export const safeNext = (n: string | null, fallback = '/') =>
  n && n.startsWith('/') && !n.startsWith('//') ? n : fallback;
