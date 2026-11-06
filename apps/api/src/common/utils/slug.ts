// Sinh slug từ tiếng Việt: "Bàn trà gỗ sồi" → "ban-tra-go-soi" (đ → d, bỏ dấu, chỉ giữ a-z0-9-)
import slugify from 'slugify';

export const toSlug = (s: string): string =>
  slugify(
    String(s ?? '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D'),
    { lower: true, strict: true, locale: 'vi', trim: true },
  );
