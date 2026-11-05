// Xuất dữ liệu ra CSV (mở được bằng Excel) – dùng cho nút "Xuất Excel"
export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = `${String.fromCharCode(0xfeff)}${rows.map((r) => r.map(esc).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
