// Component Footer chứa thông tin liên hệ, liên kết nhanh và bản quyền
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-12 bg-ink text-white">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.3fr]">
        <div>
          <h3 className="relative mb-5 pb-2.5 text-base after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-[45px] after:bg-primary">
            Aurelia Living
          </h3>
          <p className="my-2 text-sm leading-relaxed text-gray-300">
            Chuyên thiết kế, sản xuất và thi công nội thất theo yêu cầu.
          </p>
          <p className="my-2 text-sm leading-relaxed text-gray-300">
            <strong className="text-white">Địa chỉ:</strong> TP. Hồ Chí Minh
          </p>
          <p className="my-2 text-sm leading-relaxed text-gray-300">
            <strong className="text-white">Hotline:</strong> <a href="tel:0900000000">0900 000 000</a>
          </p>
          <p className="my-2 text-sm leading-relaxed text-gray-300">
            <strong className="text-white">Email:</strong> <a href="mailto:info@aurelialiving.vn">info@aurelialiving.vn</a>
          </p>
        </div>

        <div>
          <h3 className="relative mb-5 pb-2.5 text-base after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-[45px] after:bg-primary">
            LIÊN KẾT NHANH
          </h3>
          {[
            { href: "/", label: "Trang chủ" },
            { href: "/products?category=phong-ngu", label: "Phòng ngủ" },
            { href: "/products?category=phong-khach", label: "Phòng khách" },
            { href: "/products?category=phong-bep", label: "Phòng bếp" },
            { href: "/products?category=van-phong", label: "Văn phòng" },
            { href: "/products?category=tre-em", label: "Nội thất trẻ em" },
          ].map((link) => (
            <Link key={link.href} href={link.href} className="mb-3 block text-sm text-gray-300 hover:pl-1 hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>

        <div>
          <h3 className="relative mb-5 pb-2.5 text-base after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-[45px] after:bg-primary">
            SẢN PHẨM
          </h3>
          {[
            { href: "/products?category=giuong-ngu", label: "Giường ngủ" },
            { href: "/products?category=tu-ao", label: "Tủ áo" },
            { href: "/products?category=tu-bep", label: "Tủ bếp" },
            { href: "/products?category=ban-phan", label: "Bàn phấn" },
            { href: "/products?category=ban-lam-viec", label: "Bàn làm việc" },
            { href: "/products?category=tu-giay", label: "Tủ giày" },
            { href: "/products?category=ke-tivi", label: "Kệ Tivi" },
          ].map((link) => (
            <Link key={link.href} href={link.href} className="mb-3 block text-sm text-gray-300 hover:pl-1 hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>

        <div>
          <h3 className="relative mb-5 pb-2.5 text-base after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-[45px] after:bg-primary">
            HỖ TRỢ KHÁCH HÀNG
          </h3>
          <Link href="/login" className="mb-3 block text-sm text-gray-300 hover:pl-1 hover:text-white">
            Đăng nhập
          </Link>
          <Link href="/register" className="mb-3 block text-sm text-gray-300 hover:pl-1 hover:text-white">
            Đăng ký
          </Link>
          <Link href="/products?promotion=true" className="mb-3 block text-sm text-gray-300 hover:pl-1 hover:text-white">
            Khuyến mãi
          </Link>

          <div className="mt-5 flex gap-2.5">
            {["Facebook", "TikTok", "Zalo"].map((name) => (
              <a
                key={name}
                href="#"
                title={name}
                className="rounded border border-gray-600 px-3 py-2 text-sm hover:border-primary hover:bg-primary"
              >
                {name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700 py-4 text-center">
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} Aurelia Living. All Rights Reserved.</p>
      </div>
    </footer>
  );
}
