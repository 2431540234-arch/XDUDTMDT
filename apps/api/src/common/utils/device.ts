// Tên thiết bị dễ đọc từ User-Agent cho danh sách phiên đăng nhập (UC-ACC-03). Không cần thư viện: chỉ nhận diện trình duyệt/hệ điều hành phổ biến.
export function describeDevice(userAgent?: string | null): string {
  const ua = (userAgent ?? '').trim();
  if (!ua) return 'Thiết bị không xác định';
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\/|FxiOS/.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS/.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null;
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  if (browser && os) return `${browser} trên ${os}`;
  if (browser || os) return (browser ?? os)!;
  return ua.slice(0, 60);
}
