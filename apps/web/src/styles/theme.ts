// Định nghĩa theme (màu sắc, kích thước) dùng chung cho giao diện web.
// Được nối vào tailwind.config.ts nên dùng được dạng class: bg-primary, text-muted, border-line...
// Giá trị theo WIREFRAME.md mục 0.1 (màu nâu gỗ – kem – be ấm).

export const theme = {
  colors: {
    primary: { DEFAULT: '#8B4A2B', hover: '#6F3A21', soft: '#F3EBE3' },
    secondary: '#F3EBE3',
    bg: '#FAF6F2',
    surface: { DEFAULT: '#FFFFFF', muted: '#F3EBE3' },
    ink: '#2B1E16',
    muted: '#7A6E66',
    line: '#E8DFD7',
    star: '#F5A623',
    danger: '#E53935',
    success: '#2E7D32',
  },
} as const;
