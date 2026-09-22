"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU_ITEMS, menuHref } from "../lib/products-data";

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <>
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

      <nav className="al-nav">
        <div className="al-nav__danhmuc">☰ DANH MỤC</div>
        <ul className="al-nav__list">
          {MENU_ITEMS.map((m) => {
            const href = menuHref(m.slug);
            const active = pathname === href;
            return (
              <li key={m.slug || "home"}>
                <Link href={href} className={"al-nav__link" + (active ? " active" : "")}>
                  {m.label} <span className="al-nav__caret">▾</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}