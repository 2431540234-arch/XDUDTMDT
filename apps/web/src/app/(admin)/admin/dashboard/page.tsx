"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import "./dashboard.css";

const MENU = [
  { icon: "📊", label: "Tổng quan", slug: "dashboard" },
  { icon: "📦", label: "Sản phẩm", slug: "san-pham" },
  { icon: "🧾", label: "Đơn hàng", slug: "don-hang" },
  { icon: "👥", label: "Khách hàng", slug: "khach-hang" },
  { icon: "📈", label: "Thống kê", slug: "thong-ke" },
  { icon: "🏷️", label: "Khuyến mãi", slug: "khuyen-mai" },
  { icon: "⚙️", label: "Cài đặt", slug: "cai-dat" },
];

const STATS = [
  { icon: "💰", label: "Doanh thu tháng", value: "285.700.000₫", delta: "+12,5%", up: true, color: "green" },
  { icon: "🧾", label: "Đơn hàng mới", value: "342", delta: "+8,2%", up: true, color: "blue" },
  { icon: "👥", label: "Khách hàng", value: "1.258", delta: "+5,4%", up: true, color: "gold" },
  { icon: "↩️", label: "Đơn hoàn trả", value: "9", delta: "-2,1%", up: false, color: "red" },
];

const REVENUE = [
  { month: "T4", value: 140 },
  { month: "T5", value: 180 },
  { month: "T6", value: 160 },
  { month: "T7", value: 220 },
  { month: "T8", value: 195 },
  { month: "T9", value: 265 },
  { month: "T10", value: 240 },
  { month: "T11", value: 286 },
];

const ORDERS = [
  { id: "#AD1024", customer: "Nguyễn Văn A", date: "22/09/2026", total: "12.500.000₫", status: "Đã giao", tone: "green" },
  { id: "#AD1023", customer: "Trần Thị B", date: "22/09/2026", total: "5.600.000₫", status: "Đang giao", tone: "blue" },
  { id: "#AD1022", customer: "Lê Văn C", date: "21/09/2026", total: "28.400.000₫", status: "Chờ xác nhận", tone: "gold" },
  { id: "#AD1021", customer: "Phạm Thị D", date: "21/09/2026", total: "3.200.000₫", status: "Đã hủy", tone: "red" },
  { id: "#AD1020", customer: "Hoàng Văn E", date: "20/09/2026", total: "15.800.000₫", status: "Đã giao", tone: "green" },
];

const TOP_PRODUCTS = [
  { name: "Sofa Văng Nỉ Cao Cấp AV-101", sold: 48, percent: 92 },
  { name: "Giường Ngủ Gỗ Sồi Hiện Đại", sold: 41, percent: 79 },
  { name: "Tủ Bếp Acrylic Bóng Gương", sold: 35, percent: 67 },
  { name: "Bàn Trang Điểm Gương Led", sold: 29, percent: 55 },
];

export default function AdminDashboard() {
  const [active, setActive] = useState("dashboard");

  return (
    <div className="adb">
      {/* ===== SIDEBAR ===== */}
      <aside className="adb-side">
        <div className="adb-side__brand">
          <img src="/images/aurelia-living-logo.jpg" alt="Aurelia Living" className="adb-side__logo" />
          <div>
            <b>AURELIA</b>
            <small>Khu vực quản trị</small>
          </div>
        </div>

        <nav className="adb-side__menu">
          {MENU.map((m) => (
            <button
              key={m.slug}
              className={"adb-side__item" + (active === m.slug ? " active" : "")}
              onClick={() => setActive(m.slug)}
            >
              <span>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </nav>

        <div className="adb-side__foot">
          <Link href="/" className="adb-side__home">🏠 Về trang web</Link>
          <button className="adb-logout">🚪 Đăng xuất</button>
        </div>
      </aside>

      {/* ===== KHU VỰC CHÍNH ===== */}
      <div className="adb-main">
        {/* TOPBAR */}
        <header className="adb-topbar">
          <div>
            <h1>Xin chào, Quản trị viên 👋</h1>
            <p>Đây là tình hình kinh doanh hôm nay của Aurelia Living.</p>
          </div>
          <div className="adb-topbar__right">
            <input className="adb-search" placeholder="🔍 Tìm đơn hàng, khách hàng..." />
            <button className="adb-bell" title="Thông báo">🔔<span>3</span></button>
            <div className="adb-avatar">QT</div>
          </div>
        </header>

        {/* 4 THẺ THỐNG KÊ */}
        <section className="adb-stats">
          {STATS.map((s) => (
            <div key={s.label} className={`adb-stat adb-stat--${s.color}`}>
              <span className="adb-stat__icon">{s.icon}</span>
              <div>
                <p className="adb-stat__label">{s.label}</p>
                <b className="adb-stat__value">{s.value}</b>
                <span className={"adb-stat__delta " + (s.up ? "up" : "down")}>
                  {s.up ? "▲" : "▼"} {s.delta} so với tháng trước
                </span>
              </div>
            </div>
          ))}
        </section>

        {/* HÀNG: BIỂU ĐỒ + TOP SẢN PHẨM */}
        <section className="adb-row">
          <div className="adb-card">
            <div className="adb-card__head">
              <h2>📈 Doanh thu 8 tháng gần nhất</h2>
              <span className="adb-chip">Đơn vị: triệu ₫</span>
            </div>
            <div className="adb-chart">
              {REVENUE.map((r) => (
                <div key={r.month} className="adb-chart__col">
                  <b>{r.value}</b>
                  <div className="adb-chart__bar" style={{ height: `${(r.value / 300) * 100}%` }} />
                  <span>{r.month}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="adb-card">
            <div className="adb-card__head">
              <h2>🏆 Sản phẩm bán chạy</h2>
            </div>
            <ul className="adb-top">
              {TOP_PRODUCTS.map((p) => (
                <li key={p.name}>
                  <div className="adb-top__row">
                    <span>{p.name}</span>
                    <b>{p.sold} SP</b>
                  </div>
                  <div className="adb-top__track">
                    <div className="adb-top__fill" style={{ width: `${p.percent}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* BẢNG ĐƠN HÀNG MỚI */}
        <section className="adb-card">
          <div className="adb-card__head">
            <h2>🧾 Đơn hàng gần đây</h2>
            <button className="adb-viewall">Xem tất cả →</button>
          </div>
          <table className="adb-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Ngày đặt</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {ORDERS.map((o) => (
                <tr key={o.id}>
                  <td><b className="adb-orderid">{o.id}</b></td>
                  <td>{o.customer}</td>
                  <td>{o.date}</td>
                  <td><b>{o.total}</b></td>
                  <td><span className={`adb-badge adb-badge--${o.tone}`}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}