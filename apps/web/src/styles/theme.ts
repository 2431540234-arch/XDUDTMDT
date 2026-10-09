// Định nghĩa theme (màu sắc, kích thước) dùng chung cho giao diện web.
// Được nối vào tailwind.config.ts nên dùng được dạng class: bg-primary, text-secondary...

export const theme = {
  colors: {
    primary: '#8B5E3C',
    secondary: '#F4EBE0',
  },
} as const;
