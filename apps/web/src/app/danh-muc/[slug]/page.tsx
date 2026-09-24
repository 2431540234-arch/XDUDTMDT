// TODO: tham khảo cho Đợt 2 - trang chi tiết sản phẩm, cần port sang kiến trúc Tailwind + zustand trước khi dùng
"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useParams } from "next/navigation";
import { CATEGORIES, formatPrice, onImgError } from "../../../lib/products-data";
import SiteHeader from "../../../components/SiteHeader";
import "../../home.css";
import "./category.css";

export default function CategoryPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const category = CATEGORIES.find((c) => c.slug === slug);

  if (!category) {
    return (
      <div className="cat-page">
        <SiteHeader />
        <div className="cat-empty">
          <h1>Không tìm thấy danh mục này 😥</h1>
          <Link href="/" className="cat-empty__btn">← Về trang chủ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cat-page">
      <SiteHeader />

      <div className="cat-wrap">
        <p className="cat-breadcrumb">
          <Link href="/">Trang chủ</Link> / <span>{category.title}</span>
        </p>

        <h1 className="cat-title">{category.title}</h1>
        <div className="al-ornament"><span /></div>
        <p className="cat-desc">{category.description}</p>

        <div className="al-tabs">
          {category.tabs.map((t, i) => (
            <a key={t} href="#" className={"al-tab" + (i === 0 ? " active" : "")}>{t}</a>
          ))}
        </div>

        <div className="al-grid4">
          {category.products.map((p) => (
            <div key={p.name} className="al-pcard">
              <div className="al-pcard__imgwrap">
                <img src={p.img} alt={p.name} className="al-pcard__img" onError={onImgError} />
                <span className="al-pcard__badge">🔥 -{formatPrice(p.oldPrice - p.price)}</span>
              </div>
              <h3 className="al-pcard__name">{p.name}</h3>
              <div className="al-pcard__prices">
                <span className="al-pcard__price">{formatPrice(p.price)}</span>
                <span className="al-pcard__old">{formatPrice(p.oldPrice)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="al-footer">
        <div className="al-footer__bottom">© 2026 Aurelia Living. All rights reserved.</div>
      </footer>
    </div>
  );
}