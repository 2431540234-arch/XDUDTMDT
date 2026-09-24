// Trang chi tiết sản phẩm - TODO: bổ sung viewer 3D/360° ở đây (chưa làm ở đợt này)
"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import Navbar from "@/components/layout/Navbar";
import ProductCard from "@/components/product/ProductCard";
import Button from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";
import { mockProducts } from "@/mocks/products";
import { useCartStore } from "@/store/cartStore";
import { useUIStore } from "@/store/uiStore";

interface ProductDetailPageProps {
  params: { id: string };
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const product = mockProducts.find((p) => p.id === params.id);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const showToast = useUIStore((s) => s.showToast);

  if (!product) {
    notFound();
  }
  const currentProduct = product;

  const discountPercent = currentProduct.oldPrice
    ? Math.round(((currentProduct.oldPrice - currentProduct.price) / currentProduct.oldPrice) * 100)
    : 0;

  const related = mockProducts
    .filter(
      (p) =>
        p.id !== currentProduct.id &&
        currentProduct.categorySlug &&
        p.categorySlug === currentProduct.categorySlug,
    )
    .slice(0, 4);

  function handleAddToCart() {
    addItem(currentProduct.id, quantity);
    showToast(`Đã thêm ${quantity} "${currentProduct.name}" vào giỏ hàng`);
  }

  return (
    <>
      <Header />
      <Navbar />

      <main className="mx-auto max-w-[1600px] px-4 py-8">
        <p className="mb-4 text-xs text-gray-500">
          <Link href="/" className="hover:text-primary">
            Trang chủ
          </Link>{" "}
          /{" "}
          {product.categorySlug && (
            <>
              <Link href={`/products?category=${product.categorySlug}`} className="hover:text-primary">
                {product.categoryTitle}
              </Link>{" "}
              /{" "}
            </>
          )}
          <span>{product.name}</span>
        </p>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-gray-100">
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            {discountPercent > 0 && (
              <span className="absolute left-0 top-0 rounded-br-lg bg-accent px-3 py-1.5 text-sm font-bold text-white">
                -{discountPercent}%
              </span>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-ink">{product.name}</h1>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-bold text-heading">{formatCurrency(product.price)}</span>
              {product.oldPrice && (
                <span className="text-lg text-gray-400 line-through">{formatCurrency(product.oldPrice)}</span>
              )}
            </div>

            <ul className="mt-6 space-y-2 text-sm text-ink">
              <li>
                <b>Nhà sản xuất:</b> Aurelia Living
              </li>
              <li>
                <b>Mã sản phẩm:</b> {product.id.toUpperCase()}
              </li>
              <li>
                <b>Chất liệu:</b> Gỗ công nghiệp cao cấp chống ẩm
              </li>
              <li>
                <b>Bảo hành:</b> 24 tháng &amp; hỗ trợ lâu dài
              </li>
            </ul>

            <p className="mt-4 text-sm">
              <b>Tình trạng:</b> <span className="text-green-600">Còn hàng</span>
            </p>

            <div className="mt-6 flex items-center gap-3">
              <b className="text-sm">Số lượng:</b>
              <div className="flex items-center rounded border border-gray-300">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-1.5 text-lg disabled:opacity-40"
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className="w-10 text-center">{quantity}</span>
                <button onClick={() => setQuantity((q) => q + 1)} className="px-3 py-1.5 text-lg">
                  +
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleAddToCart}>
                🛒 Thêm vào giỏ hàng
              </Button>
              <Button variant="primary" onClick={handleAddToCart}>
                Mua ngay
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-lg border border-gray-100 p-6">
          <h2 className="mb-3 text-lg font-bold text-heading">Mô tả</h2>
          <p className="text-sm leading-relaxed text-gray-600">
            <b>{product.name}</b> là lựa chọn hoàn hảo cho không gian sống hiện đại. Sản phẩm được sản xuất
            trực tiếp tại xưởng Aurelia Living — không qua trung gian, chất liệu gỗ công nghiệp cao cấp
            chống ẩm, bề mặt phủ melamine sang trọng, dễ vệ sinh.
          </p>
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-lg font-bold text-heading">Sản phẩm liên quan</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
