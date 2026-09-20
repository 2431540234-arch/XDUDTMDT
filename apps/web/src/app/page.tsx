"use client";

/* eslint-disable @next/next/no-img-element */
import type { SyntheticEvent } from "react";
import "./home.css";

const formatPrice = (n: number) => n.toLocaleString("vi-VN") + "₫";

const onImgError = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = "/images/aurelia-living-logo.jpg";
};

const flashSale = [
  { img: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=400&q=80", name: "Tủ Giày Tân Cổ Điển Màu Trắng Đẹp Hiện Đại", price: 2800000, oldPrice: 3100000 },
  { img: "https://images.unsplash.com/photo-1518051870910-a46e30d9db16?auto=format&fit=crop&w=400&q=80", name: "Bàn Học Sinh Gỗ Công Nghiệp Thông Minh Cho Bé", price: 3000000, oldPrice: 3750000 },
  { img: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=400&q=80", name: "Bộ Bàn Học Sinh Đôi Gỗ Công Nghiệp Đẹp Tiện Lợi", price: 3960000, oldPrice: 4950000 },
];

const noiBat = [
  { img: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=400&q=80", name: "Giường Ngủ Bay Gỗ Công Nghiệp Có Đèn Led Cao Cấp", price: 5000000, oldPrice: 5560000 },
  { img: "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=400&q=80", name: "Tủ Quần Áo Hiện Đại Gỗ Công Nghiệp Cao Cấp", price: 6160000, oldPrice: 6840000 },
  { img: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=400&q=80", name: "Bàn Trang Điểm Gương Tròn Thiết Kế Hiện Đại", price: 2100000, oldPrice: 2300000 },
];

const sanPhamMoi = [
  { img: "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=400&q=80", name: "Bộ Bàn Ghế Học Sinh Thông Minh Chống Gù Cao Cấp", price: 2250000, oldPrice: 2500000 },
  { img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80", name: "Hệ Tủ Kệ Phòng Khách Gỗ MDF Cao Cấp", price: 2790000, oldPrice: 3100000 },
  { img: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=400&q=80", name: "Kệ Tivi Treo Tường Gỗ Công Nghiệp Tiện Lợi", price: 2450000, oldPrice: 2720000 },
];

type Product = { img: string; name: string; price: number; oldPrice: number };

const showcases: { title: string; tabs: string[]; products: Product[] }[] = [
  {
    title: "NỘI THẤT PHÒNG NGỦ",
    tabs: ["Bàn Trang Điểm", "Tủ Quần Áo", "Tủ Đầu Giường", "Nệm Cao Su Non", "Giường Ngủ", "Phòng Ngủ"],
    products: [
      { img: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=640&q=80", name: "Bàn Trang Điểm Gỗ Trầm Bóng Vàng Đẹp Hiện Đại", price: 3200000, oldPrice: 3980000 },
      { img: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=640&q=80", name: "Bàn Trang Điểm Kết Hợp Tủ Ngăn Kéo Gỗ Công Nghiệp", price: 2850000, oldPrice: 3390000 },
      { img: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=640&q=80", name: "Bàn Trang Điểm Thông Minh Gương Led Cao Cấp", price: 2756000, oldPrice: 3200000 },
      { img: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=640&q=80", name: "Bàn Phấn Trang Điểm Nhập Khẩu Cao Cấp Giá Rẻ", price: 2236000, oldPrice: 2756000 },
    ],
  },
  {
    title: "NỘI THẤT PHÒNG KHÁCH",
    tabs: ["Kệ Tivi", "Vách Ngăn", "Tủ Cầu Thang", "Tủ Giày", "Tủ Rượu", "Bàn Sofa", "Kệ Trang Trí", "Ghế Sofa"],
    products: [
      { img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=640&q=80", name: "Hệ Tủ Kệ Phòng Khách Gỗ MDF Cao Cấp", price: 2790000, oldPrice: 3100000 },
      { img: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=640&q=80", name: "Kệ Tivi Treo Tường Gỗ Công Nghiệp Tiện Lợi", price: 2450000, oldPrice: 2720000 },
      { img: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=640&q=80", name: "Kệ Tivi Hiện Đại Gỗ MDF Cao Cấp", price: 2990000, oldPrice: 3320000 },
      { img: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=640&q=80", name: "Kệ Tivi Đẹp Gỗ Công Nghiệp Cao Cấp", price: 3290000, oldPrice: 3660000 },
    ],
  },
  {
    title: "NỘI THẤT VĂN PHÒNG",
    tabs: ["Bàn Làm Việc", "Kệ Sách", "Tủ Hồ Sơ", "Ghế Công Thái Độ", "Bàn Học", "Ghế Xoay"],
    products: [
      { img: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=640&q=80", name: "Bàn Làm Việc Gỗ Tự Nhiên Thiết Kế Hiện Đại", price: 2150000, oldPrice: 2800000 },
      { img: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=640&q=80", name: "Kệ Sách Gỗ Nhiều Tầng Chứa Đựng Đa Năng", price: 1890000, oldPrice: 2300000 },
      { img: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=640&q=80", name: "Ghế Xoay Công Thái Độ Thoải Mái Cả Ngày", price: 1250000, oldPrice: 1590000 },
      { img: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=640&q=80", name: "Tổ Hợp Bàn Làm Việc Kèm Kệ Hồ Sơ Tiện Lợi", price: 3590000, oldPrice: 4200000 },
    ],
  },
];

function Ornament() {
  return <div className="al-ornament"><span /></div>;
}

function SectionHead({ title }: { title: string }) {
  return (
    <>
      <h2 className="al-sec__title">{title}</h2>
      <Ornament />
      <p className="al-sec__all"><a href="/">Xem tất cả sản phẩm 👇</a></p>
    </>
  );
}

function MiniProduct({ img, name, price, oldPrice }: Product) {
  const save = oldPrice - price;
  return (
    <div className="al-mini">
      <div className="al-mini__imgwrap">
        <img src={img} alt={name} className="al-mini__img" onError={onImgError} />
        <span className="al-mini__badge">🔥 -{formatPrice(save)}</span>
      </div>
      <div className="al-mini__info">
        <h3 className="al-mini__name">{name}</h3>
        <div className="al-mini__prices">
          <span className="al-mini__price">{formatPrice(price)}</span>
          <span className="al-mini__old">{formatPrice(oldPrice)}</span>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ img, name, price, oldPrice }: Product) {
  const save = oldPrice - price;
  return (
    <div className="al-pcard">
      <div className="al-pcard__imgwrap">
        <img src={img} alt={name} className="al-pcard__img" onError={onImgError} />
        <span className="al-pcard__badge">🔥 -{formatPrice(save)}</span>
      </div>
      <h3 className="al-pcard__name">{name}</h3>
      <div className="al-pcard__prices">
        <span className="al-pcard__price">{formatPrice(price)}</span>
        <span className="al-pcard__old">{formatPrice(oldPrice)}</span>
      </div>
    </div>
  );
}

function Showcase({ title, tabs, products }: { title: string; tabs: string[]; products: Product[] }) {
  return (
    <section className="al-showcase">
      <SectionHead title={title} />
      <div className="al-tabs">
        {tabs.map((t, i) => (
          <a key={t} href="/" className={"al-tab" + (i === 0 ? " active" : "")}>{t}</a>
        ))}
      </div>
      <div className="al-grid4">
        {products.map((p) => <ProductCard key={p.name} {...p} />)}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="al-page">
      {/* HEADER */}
      <header className="al-header">
        <a href="/" className="al-header__brand">
          <img src="/images/aurelia-living-logo.jpg" alt="Aurelia Living" className="al-header__logo" />
          <span className="al-header__name">AURELIA LIVING</span>
        </a>
        <div className="al-search">
          <input placeholder="Nhập từ khóa..." />
          <button>🔍</button>
        </div>
        <div className="al-header__right">
          <div className="al-hotline">
            <span className="al-hotline__label">Gọi Ngay</span>
            <a className="al-hotline__number" href="tel:0901234567">0901 234 567</a>
          </div>
          <a href="/user" className="al-user" title="Tài khoản">👤</a>
          <a href="/cart" className="al-cart" title="Giỏ hàng">
            🛒<span className="al-cart__badge">0</span>
          </a>
        </div>
      </header>

      {/* MENU */}
      <nav className="al-nav">
        <div className="al-nav__danhmuc">☰ DANH MỤC</div>
        <ul className="al-nav__list">
          {["TRANG CHỦ", "GIƯỜNG NGỦ", "TỦ ÁO", "TỦ BẾP", "BÀN GHẾ", "BÀN LÀM VIỆC", "TỦ GIÀY", "KỆ TIVI", "COMBO"].map((m) => (
            <li key={m}><a href="/">{m} <span className="al-nav__caret">▾</span></a></li>
          ))}
        </ul>
      </nav>

      {/* SIDEBAR + BANNER + THANH THÔNG TIN */}
      <section className="al-hero">
        <aside className="al-side">
          {[
            "🛏️|NỘI THẤT PHÒNG NGỦ", "🛋️|NỘI THẤT PHÒNG KHÁCH", "🍳|NỘI THẤT PHÒNG BẾP",
            "💼|NỘI THẤT VĂN PHÒNG", "🧸|NỘI THẤT TRẺ EM", "📦|COMBO NỘI THẤT",
            "🪑|NỘI THẤT PHÒNG THỜ", "📐|THIẾT KẾ NỘI THẤT", "✨|SẢN PHẨM MỚI NHẤT",
          ].map((s) => {
            const [icon, name] = s.split("|");
            return (
              <a key={name} href="/" className="al-side__item">
                <span className="al-side__icon">{icon}</span>
                <span>{name}</span>
                <span className="al-side__arrow">›</span>
              </a>
            );
          })}
        </aside>

        <div className="al-banner__wrap">
          <div className="al-banner">
            <div className="al-banner__content">
              <p className="al-banner__brand">✦ AURELIA LIVING ✦</p>
              <h1>NỘI THẤT AURELIA</h1>
              <h2>GIẢI PHÁP NỘI THẤT TOÀN DIỆN</h2>
              <ul className="al-banner__checks">
                <li>Sản xuất trực tiếp tại xưởng — Không qua trung gian</li>
                <li>Thiết kế hiện đại — Thi công chuyên nghiệp</li>
                <li>Mang đến không gian sống tiện nghi và đẳng cấp</li>
              </ul>
              <div className="al-banner__features">
                {[["🏭", "SẢN XUẤT TRỰC TIẾP"], ["🏅", "CHẤT LƯỢNG VƯỢT TRỘI"], ["⏰", "TIẾN ĐỘ ĐÚNG HẸN"], ["🛡️", "BẢO HÀNH DÀI HẠN"]].map(([icon, label]) => (
                  <div key={label}>
                    <span>{icon}</span>
                    <b>{label}</b>
                  </div>
                ))}
              </div>
              <a href="/lien-he" className="al-banner__cta">🕐 TƯ VẤN &amp; BÁO GIÁ MIỄN PHÍ ›</a>
            </div>

            {/* ẢNH THẬT trong vòng tròn đỏ */}
            <div className="al-banner__art">
              <div className="al-banner__photo">
                <img
                  src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80"
                  alt="Phòng khách cao cấp Aurelia Living"
                  onError={onImgError}
                />
              </div>
              <div className="al-banner__thumbs">
                <span className="al-thumb">
                  <img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=300&q=80" alt="Phòng ngủ" onError={onImgError} />
                </span>
                <span className="al-thumb">
                  <img src="https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=300&q=80" alt="Bếp" onError={onImgError} />
                </span>
                <span className="al-thumb">
                  <img src="https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=300&q=80" alt="Văn phòng" onError={onImgError} />
                </span>
              </div>
            </div>
          </div>

          {/* THANH ĐỎ THÔNG TIN + DANH MỤC (giống Anh Khoa) */}
          <div className="al-infobar">
            <div className="al-infobar__row">
              <span>🌐 aurelialiving.vn</span>
              <span>📞 0901 234 567 - 0902 345 678</span>
              <span>📍 123 Nguyễn Văn A, P. Tân Thới, TP.HCM</span>
              <span>📘 Aurelia Living</span>
            </div>
            <div className="al-infobar__cats">
              <span>🚪 TỦ ÁO</span>
              <span>🍳 TỦ BẾP</span>
              <span>🛏️ GIƯỜNG</span>
              <span>🪑 BÀN GHẾ</span>
              <span>📐 THI CÔNG NỘI THẤT THEO YÊU CẦU</span>
            </div>
          </div>
        </div>
      </section>

      {/* KHỐI 3 CỘT */}
      <section className="al-trio">
        <div>
          <h2 className="al-trio__title">FLASH SALE</h2>
          <Ornament />
          <div className="al-trio__list">
            {flashSale.map((p) => <MiniProduct key={p.name} {...p} />)}
          </div>
        </div>
        <div>
          <h2 className="al-trio__title">NỔI BẬT</h2>
          <Ornament />
          <div className="al-trio__list">
            {noiBat.map((p) => <MiniProduct key={p.name} {...p} />)}
          </div>
        </div>
        <div>
          <h2 className="al-trio__title">SẢN PHẨM MỚI</h2>
          <Ornament />
          <div className="al-trio__list">
            {sanPhamMoi.map((p) => <MiniProduct key={p.name} {...p} />)}
          </div>
        </div>
      </section>

      {/* CÁC KHỐI DANH MỤC */}
      {showcases.map((s) => <Showcase key={s.title} {...s} />)}

      {/* FOOTER */}
      <footer className="al-footer">
        <div className="al-footer__grid">
          <div>
            <h4>AURELIA LIVING</h4>
            <p>Nội thất cao cấp — nơi sang trọng an cư.</p>
            <p>🐾 Gấu trúc vàng cầm đèn chùm — biểu tượng thịnh vượng.</p>
          </div>
          <div>
            <h4>Về chúng tôi</h4>
            <a href="/gioi-thieu">Giới thiệu</a>
            <a href="/tin-tuc">Tin tức</a>
            <a href="/tuyen-dung">Tuyển dụng</a>
          </div>
          <div>
            <h4>Hỗ trợ khách hàng</h4>
            <a href="/chinh-sach">Chính sách bảo hành</a>
            <a href="/giao-hang">Giao hàng &amp; lắp đặt</a>
            <a href="/doi-tra">Đổi trả trong 7 ngày</a>
          </div>
          <div>
            <h4>Liên hệ</h4>
            <p>📍 123 Nguyễn Văn A, Quận 1, TP.HCM</p>
            <p>📞 0901 234 567</p>
            <p>✉️ cskh@aurelialiving.vn</p>
          </div>
        </div>
        <div className="al-footer__bottom">© 2026 Aurelia Living. All rights reserved.</div>
      </footer>

      {/* NÚT NỔI */}
      <a href="tel:0901234567" className="al-float al-float--call">📞</a>
      <a href="/lien-he" className="al-float al-float--consult">
        <span>📅</span>
        Gửi tư vấn
      </a>
    </div>
  );
}