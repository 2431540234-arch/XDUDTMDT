// Trang chủ giới thiệu Aurelia Living
"use client";

import Image from "next/image";
import { useState } from "react";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import Navbar from "@/components/layout/Navbar";
import ProductCard from "@/components/product/ProductCard";
import { mockProducts } from "@/mocks/products";
import { useUIStore } from "@/store/uiStore";
import type { ProductSection } from "@/types/product";

const sections: { key: ProductSection; title: string }[] = [
  { key: "flashSale", title: "FLASH SALE" },
  { key: "featured", title: "NỔI BẬT" },
  { key: "newProducts", title: "SẢN PHẨM MỚI" },
];

type SectionFilter = ProductSection | "all";

export default function HomePage() {
  const searchQuery = useUIStore((s) => s.searchQuery);
  const toastMessage = useUIStore((s) => s.toastMessage);
  const [activeSection, setActiveSection] = useState<SectionFilter>("all");

  const filteredProducts = mockProducts
    .filter((p) => activeSection === "all" || p.section === activeSection)
    .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <>
      <Header />
      <Navbar />

      <main>
        <section className="mx-auto w-full max-w-[1600px] px-4">
          <Image
            src="/images/brand/hero-banner.png"
            alt="Aurelia Living - Giải pháp nội thất toàn diện"
            width={1600}
            height={781}
            priority
            className="h-auto w-full"
          />
        </section>

        <section className="mx-auto max-w-[1600px] px-4 pb-12 pt-10">
          <div className="flex flex-wrap items-center justify-center gap-x-24 gap-y-3">
            <button
              onClick={() => setActiveSection("all")}
              className={`text-sm font-bold uppercase transition-colors ${
                activeSection === "all" ? "text-primary" : "text-gray-500 hover:text-primary"
              }`}
            >
              Tất cả
            </button>
            {sections.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`text-sm font-bold uppercase transition-colors ${
                  activeSection === section.key ? "text-primary" : "text-gray-500 hover:text-primary"
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.length ? (
              filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)
            ) : (
              <p className="col-span-full py-10 text-center text-sm text-gray-400">Không có sản phẩm phù hợp</p>
            )}
          </div>
        </section>
      </main>

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[100] rounded bg-primary px-4 py-2.5 text-sm text-white shadow-lg">
          {toastMessage}
        </div>
      )}

      <Footer />
    </>
  );
}
