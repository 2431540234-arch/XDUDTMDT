// TODO: tham khảo cho Đợt 2 - trang chi tiết sản phẩm, cần port sang kiến trúc Tailwind + zustand trước khi dùng
"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import {
  findProduct,
  relatedProducts,
  formatPrice,
  onImgError,
} from "../../../lib/products-data";
import "../../home.css";
import "./product.css";

const GALLERY_EXTRA = [
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=900&q=80",
];

export default function ProductDetailPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const product = findProduct(slug);

  const [activeIdx, setActiveIdx] = useState(0);
  const [qty, setQty] = useState(1);

  if (!product) {
    return (
      <div className="pd-page">
        <SiteHeader />
        <div className="pd-empty">
          <h1>Không tìm thấy sản phẩm 😥</h1>
          <Link href="/" className="pd-btn pd-btn--solid">← Về trang chủ</Link>
        </div>
      </div>
    );
  }

  const gallery = [product.img, ...GALLERY_EXTRA];
  const mainImg = gallery[Math.min(activeIdx, gallery.length - 1)];
  const related = relatedProducts(product, 4);
  const productCode = ("AV-" + product.slug.slice(0, 6)).toUpperCase();
  const discount = Math.round((1 - product.price / product.oldPrice) * 100);
  const catHref = product.categorySlug ? `/danh-muc/${product.categorySlug}` : "/";

  return (
    <div className="pd-page">
      <SiteHeader />

      <div className="pd-wrap">
        {/* BREADCRUMB */}
        <p className="pd-breadcrumb">
          <Link href="/">Trang chủ</Link> / <Link href={catHref}>{product.categoryTitle}</Link> / <span>{product.name}</span>
        </p>

        <div className="pd-main">
          {/* ===== ẢNH + THUMBNAIL ===== */}
          <div className="pd-gallery">
            <div className="pd-mainimg">
              <img src={mainImg} alt={product.name} onError={onImgError} />
            </div>
            <div className="pd-thumbs">
              {gallery.map((g, i) => (
                <button key={i} className={"pd-thumb" + (i === activeIdx ? " active" : "")} onClick={() => setActiveIdx(i)}>
                  <img src={g} alt={`${product.name} ${i + 1}`} onError={onImgError} />
                </button>
              ))}
            </div>
          </div>

          {/* ===== THÔNG TIN SẢN PHẨM ===== */}
          <div className="pd-info">
            <h1 className="pd-name">{product.name}</h1>

            <div className="pd-rating">
              <span className="pd-stars">★★★★★</span>
              <span>1 Đánh giá</span>
            </div>

            <div className="pd-pricebox">
              <span className="pd-price">{formatPrice(product.price)}</span>
              <span className="pd-old">{formatPrice(product.oldPrice)}</span>
              <span className="pd-discount">-{discount}%</span>
            </div>

            <ul className="pd-specs">
              <li><b>Nhà sản xuất:</b> Aurelia Living</li>
              <li><b>Mã sản phẩm:</b> {productCode}</li>
            </ul>

            <h2 className="pd-subname">{product.name}</h2>

            <ul className="pd-specs">
              <li><b>Chất Liệu:</b> Gỗ công nghiệp cao cấp chống ẩm</li>
              <li><b>Màu Sắc:</b> Nâu trầm / Trắng kem</li>
              <li><b>Kích Thước:</b> Ngang 100 x Sâu 50 x Cao 75 (cm)</li>
              <li><b>Bảo Hành:</b> 24 tháng &amp; hỗ trợ lâu dài</li>
            </ul>

            <p className="pd-stock"><b>Tình trạng:</b> <span className="pd-instock">Còn hàng</span></p>

            <div className="pd-qtyrow">
              <b>Số lượng:</b>
              <div className="pd-qty">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>−</button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => q + 1)}>+</button>
              </div>
            </div>

            <div className="pd-actions">
              <button className="pd-btn pd-btn--outline" onClick={() => alert(`Đã thêm ${qty} x "${product.name}" vào giỏ hàng!`)}>
                🛒 Thêm vào giỏ hàng
              </button>
              <button className="pd-btn pd-btn--solid" onClick={() => alert(`Chuyển tới thanh toán: ${qty} x "${product.name}"`)}>
                🛍 Mua ngay
              </button>
            </div>

            <div className="pd-installment">
              <b>TRẢ GÓP LÃI SUẤT 0%</b>
              <span>Chỉ áp dụng cho đơn hàng trên 3 triệu</span>
            </div>

            <p className="pd-cats"><b>Danh mục:</b> <Link href={catHref}>{product.categoryTitle}</Link></p>
          </div>
        </div>

        {/* ===== MÔ TẢ ===== */}
        <div className="pd-desc">
          <h2 className="pd-desc__tab">Mô tả</h2>
          <p>
            <b>{product.name}</b> là lựa chọn hoàn hảo cho không gian sống hiện đại. Sản phẩm được{" "}
            <b>sản xuất trực tiếp tại xưởng Aurelia Living</b> — không qua trung gian, chất liệu gỗ
            công nghiệp cao cấp chống ẩm, bề mặt phủ melamine sang trọng, dễ vệ sinh. Thiết kế tinh tế
            phù hợp nhiều phong cách nội thất từ hiện đại đến tân cổ điển.
          </p>
          <p>✦ Giao hàng &amp; lắp đặt tận nơi — Đổi trả trong 7 ngày — Hotline: 0901 234 567</p>
        </div>

        {/* ===== SẢN PHẨM LIÊN QUAN ===== */}
        <section className="pd-related">
          <h2>Sản phẩm liên quan</h2>
          <div className="al-grid4">
            {related.map((r) => (
              <Link key={r.slug} href={`/san-pham/${r.slug}`} className="al-pcard">
                <div className="al-pcard__imgwrap">
                  <img src={r.img} alt={r.name} className="al-pcard__img" onError={onImgError} />
                  <span className="al-pcard__badge">🔥 -{formatPrice(r.oldPrice - r.price)}</span>
                </div>
                <h3 className="al-pcard__name">{r.name}</h3>
                <div className="al-pcard__prices">
                  <span className="al-pcard__price">{formatPrice(r.price)}</span>
                  <span className="al-pcard__old">{formatPrice(r.oldPrice)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ===== THANH MUA NGAY DÍNH ĐÁY ===== */}
      <div className="pd-stickybar">
        <img src={product.img} alt={product.name} onError={onImgError} />
        <div className="pd-stickybar__info">
          <b>{product.name}</b>
          <span>{formatPrice(product.price)} <i>{formatPrice(product.oldPrice)}</i></span>
        </div>
        <button className="pd-btn pd-btn--solid" onClick={() => alert(`Mua ngay: ${product.name}`)}>
          Mua Ngay
        </button>
      </div>

      <footer className="al-footer">
        <div className="al-footer__bottom">© 2026 Aurelia Living. All rights reserved.</div>
      </footer>

      <a href="tel:0901234567" className="al-float al-float--call">📞</a>
    </div>
  );
}