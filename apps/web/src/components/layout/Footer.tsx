import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Logo from './Logo';

const col = (title: string, links: Array<[string, string]>) => (
  <div>
    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink">{title}</h3>
    <ul className="space-y-2 text-sm text-muted">
      {links.map(([label, href]) => (
        <li key={label}>
          <Link href={href} className="hover:text-primary">
            {label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

/** Footer 5 cột, nền be (WIREFRAME 1.2) */
export default function Footer() {
  return (
    <footer className="mt-16 bg-surface-muted">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <Logo sub={false} />
          <p className="mt-3 text-sm text-muted">Nội thất cho không gian sống hiện đại.</p>
          <div className="mt-4 flex gap-3 text-primary">
            {(['facebook', 'instagram', 'youtube', 'music'] as const).map((n) => (
              <a
                key={n}
                href="#"
                aria-label={n === 'music' ? 'TikTok' : n}
                className="rounded-full border border-primary/30 p-2 hover:bg-white"
              >
                <Icon name={n} size={16} />
              </a>
            ))}
          </div>
        </div>
        {col('Liên kết nhanh', [
          ['Trang chủ', '/'],
          ['Sản phẩm', '/products'],
          ['Không gian mẫu', '/spaces'],
          ['Danh mục', '/products'],
          ['Về chúng tôi', '/about'],
        ])}
        {col('Chính sách', [
          ['Chính sách mua hàng', '/policies/chinh-sach-mua-hang'],
          ['Chính sách đổi trả', '/policies/chinh-sach-doi-tra'],
          ['Chính sách bảo hành', '/policies/chinh-sach-bao-hanh'],
          ['Chính sách bảo mật', '/policies/chinh-sach-bao-mat'],
          ['Điều khoản sử dụng', '/policies/dieu-khoan-su-dung'],
        ])}
        {col('Hỗ trợ', [
          ['Hướng dẫn mua hàng', '/policies/chinh-sach-mua-hang'],
          ['Câu hỏi thường gặp', '/faq'],
          ['Liên hệ', '/contact'],
        ])}
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink">Liên hệ</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex items-center gap-2">
              <Icon name="mail" size={16} /> aurelia@gmail.com
            </li>
            <li className="flex items-center gap-2">
              <Icon name="phone" size={16} /> 0123 456 789
            </li>
            <li className="flex items-start gap-2">
              <Icon name="pin" size={16} className="mt-0.5 shrink-0" /> 123 Nguyễn Văn A, TP.HCM
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">
        © 2026 Aurelia Living. Bảo lưu mọi quyền.
      </div>
    </footer>
  );
}
