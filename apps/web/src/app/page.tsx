"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import "./home.css";
import SiteHeader from "../components/SiteHeader";
import {
  flashSale,
  noiBat,
  sanPhamMoi,
  showcases,
  formatPrice,
  onImgError,
  type Product,
} from "../lib/products-data";

type CardProduct = Product & { slug: string };

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

function MiniProduct({ img, name, price, oldPrice, slug }: CardProduct) {
  const save = oldPrice - price;
  return (
    <Link href={`/san-pham/${slug}`} className="al-mini">
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
    </Link>
  );
}

function ProductCard({ img, name, price, oldPrice, slug }: CardProduct) {
  const save = oldPrice - price;
  return (
    <Link href={`/san-pham/${slug}`} className="al-pcard">
      <div className="al-pcard__imgwrap">
        <img src={img} alt={name} className="al-pcard__img" onError={onImgError} />
        <span className="al-pcard__badge">🔥 -{formatPrice(save)}</span>
      </div>
      <h3 className="al-pcard__name">{name}</h3>
      <div className="al-pcard__prices">
        <span className="al-pcard__price">{formatPrice(price)}</span>
        <span className="al-pcard__old">{formatPrice(oldPrice)}</span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="al-page">
      <SiteHeader />

      {/* SIDEBAR + BANNER */}
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
            <div className="al-banner__art">
              <div className="al-banner__photo">
                <img
                  src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80"
                  alt="Phòng khách cao cấp Aurelia Living"
                  onError={onImgError}
                />
              </div>
              <div className="al-banner__thumbs">
                <span className="al-thumb"><img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=300&q=80" alt="Phòng ngủ" onError={onImgError} /></span>
                <span className="al-thumb"><img src="https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=300&q=80" alt="Bếp" onError={onImgError} /></span>
                <span className="al-thumb"><img src="https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=300&q=80" alt="Văn phòng" onError={onImgError} /></span>
              </div>
            </div>
          </div>

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

      {/* 3 CỘT */}
      <section className="al-trio">
        <div>
          <h2 className="al-trio__title">FLASH SALE</h2>
          <Ornament />
          <div className="al-trio__list">
            {flashSale.map((p) => <MiniProduct key={p.slug} {...p} />)}
          </div>
        </div>
        <div>
          <h2 className="al-trio__title">NỔI BẬT</h2>
          <Ornament />
          <div className="al-trio__list">
            {noiBat.map((p) => <MiniProduct key={p.slug} {...p} />)}
          </div>
        </div>
        <div>
          <h2 className="al-trio__title">SẢN PHẨM MỚI</h2>
          <Ornament />
          <div className="al-trio__list">
            {sanPhamMoi.map((p) => <MiniProduct key={p.slug} {...p} />)}
          </div>
        </div>
      </section>

      {/* SHOWCASES */}
      {showcases.map((s) => (
        <section key={s.title} className="al-showcase">
          <SectionHead title={s.title} />
          <div className="al-tabs">
            {s.tabs.map((t, i) => (
              <a key={t} href="/" className={"al-tab" + (i === 0 ? " active" : "")}>{t}</a>
            ))}
          </div>
          <div className="al-grid4">
            {s.products.map((p) => <ProductCard key={p.slug} {...p} />)}
          </div>
        </section>
      ))}

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

      <a href="tel:0901234567" className="al-float al-float--call">📞</a>
      <a href="/lien-he" className="al-float al-float--consult">
        <span>📅</span>
        Gửi tư vấn
      </a>
    </div>
  );
}