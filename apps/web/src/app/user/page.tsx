import "./user.css";

export default function UserPage() {
  const user = {
    name: "Nguyễn Văn A",
    email: "nguyenvana@example.com",
    phone: "0901 234 567",
  };

  return (
    <div className="user-page">
      {/* ===== HEADER VỚI LOGO ===== */}
      <header className="aurelia-header">
        <a href="/" className="aurelia-header__brand">
          <img
            src="/images/aurelia-living-logo.png"
            alt="Aurelia Living"
            className="aurelia-header__logo"
          />
          <span className="aurelia-header__name">AURELIA LIVING</span>
        </a>
        <nav className="aurelia-header__nav">
          <a href="/">Trang chủ</a>
          <a href="/products">Sản phẩm</a>
          <a href="/cart">Giỏ hàng</a>
          <a href="/user" className="active">Tài khoản</a>
        </nav>
      </header>

      {/* ===== NỘI DUNG TRANG USER ===== */}
      <main className="user-page__container">
        <aside className="user-page__sidebar">
          <div className="user-page__avatar">A</div>
          <h2>{user.name}</h2>
          <p className="user-page__member">✦ Thành viên Aurelia ✦</p>
          <ul>
            <li className="active">Hồ sơ cá nhân</li>
            <li>Đơn hàng của tôi</li>
            <li>Địa chỉ giao hàng</li>
            <li>Đăng xuất</li>
          </ul>
        </aside>

        <section className="user-page__content">
          <h1>Hồ sơ cá nhân</h1>
          <form className="user-page__form">
            <label>
              Họ và tên
              <input defaultValue={user.name} />
            </label>
            <label>
              Email
              <input type="email" defaultValue={user.email} />
            </label>
            <label>
              Số điện thoại
              <input defaultValue={user.phone} />
            </label>
            <button type="submit">Lưu thay đổi</button>
          </form>
        </section>
      </main>
    </div>
  );
}