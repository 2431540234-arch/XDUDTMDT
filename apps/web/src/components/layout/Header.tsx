// Component Header chứa logo, thanh tìm kiếm, thông tin liên hệ, giỏ hàng
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCartStore } from "@/store/cartStore";
import { useUIStore } from "@/store/uiStore";

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const cartCount = useCartStore((s) => s.count);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const showToast = useUIStore((s) => s.showToast);
  const [keyword, setKeyword] = useState("");

  function handleSearch() {
    const trimmed = keyword.trim();
    setSearchQuery(trimmed);
    showToast(trimmed ? `Đang tìm: ${trimmed}` : "Đang hiển thị tất cả sản phẩm");
  }

  return (
    <div>
      <div className="hidden h-8 items-center justify-between whitespace-nowrap border-b border-gray-200 px-2 text-[10px] text-primary sm:flex">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4">
          <div>Showroom: 423 - 425 Lê Văn Khương, P. Tân Thới Hiệp, TP.HCM</div>
          <div className="flex items-center gap-1">
            Xưởng Sản Xuất: 551/156/37 Lê Văn Khương, Tân Thới Hiệp, TP.HCM
            {isAuthenticated ? (
              <>
                <span>|</span>
                <span className="font-bold">Xin chào, {user?.name}</span>
                <span>|</span>
                <button onClick={logout} className="font-bold hover:underline">
                  ĐĂNG XUẤT
                </button>
              </>
            ) : (
              <>
                <span>|</span>
                <Link href="/login" className="font-bold hover:underline">
                  ĐĂNG NHẬP
                </Link>
                <span>|</span>
                <Link href="/register" className="font-bold hover:underline">
                  ĐĂNG KÝ
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <header className="bg-cream">
        <div className="mx-auto flex h-[60px] max-w-[1600px] items-center gap-3.5 px-4">
          <Link href="/" className="relative h-[55px] w-[110px] flex-none">
            <Image src="/images/brand/logo.png" alt="Aurelia Living" fill className="object-cover object-left" />
          </Link>

          <div className="flex h-[34px] max-w-[400px] flex-1 overflow-hidden rounded border border-gray-200 bg-white">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              type="text"
              placeholder="Nhập từ khóa"
              className="w-full px-3 text-xs outline-none"
            />
            <button onClick={handleSearch} aria-label="Tìm kiếm" className="w-9 text-lg text-primary">
              ⌕
            </button>
          </div>

          <div className="ml-auto min-w-[100px] text-right leading-tight">
            <span className="block text-[10px] text-ink">Gọi Ngay</span>
            <strong className="text-sm text-ink">0972 799 033</strong>
          </div>

          <Link href="/cart" className="relative mr-0.5 text-2xl text-primary">
            🛒
            <span className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
              {cartCount}
            </span>
          </Link>
        </div>
      </header>
    </div>
  );
}
