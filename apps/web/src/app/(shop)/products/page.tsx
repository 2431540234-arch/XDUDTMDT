// Trang danh sách sản phẩm nội thất, lọc theo danh mục qua query "?category=" hoặc "?promotion=true"
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import Navbar from "@/components/layout/Navbar";
import ProductCard from "@/components/product/ProductCard";
import { mockCategoryGroups } from "@/mocks/categories";
import { mockProducts } from "@/mocks/products";

interface ProductsPageProps {
  searchParams: { category?: string; promotion?: string };
}

function findCategoryName(slug: string): string | undefined {
  for (const group of mockCategoryGroups) {
    if (group.slug === slug) return group.name;
    const child = group.children.find((c) => c.slug === slug);
    if (child) return child.name;
  }
  return undefined;
}

export default function ProductsPage({ searchParams }: ProductsPageProps) {
  const categorySlug = searchParams.category;
  const isPromotion = searchParams.promotion === "true";

  let products = mockProducts;
  if (categorySlug) {
    products = products.filter((p) => p.categorySlug === categorySlug);
  }
  if (isPromotion) {
    products = products.filter((p) => p.oldPrice && p.oldPrice > p.price);
  }

  const categoryName = categorySlug ? findCategoryName(categorySlug) : undefined;
  const heading = isPromotion ? "Khuyến mãi" : categoryName ?? "Tất cả sản phẩm";

  return (
    <>
      <Header />
      <Navbar />

      <main className="mx-auto max-w-[1600px] px-4 py-8">
        <p className="mb-4 text-xs text-gray-500">
          <Link href="/" className="hover:text-primary">
            Trang chủ
          </Link>{" "}
          / <span>{heading}</span>
        </p>
        <h1 className="mb-6 text-2xl font-bold text-heading">{heading}</h1>

        {products.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-gray-400">Không tìm thấy sản phẩm phù hợp.</p>
        )}
      </main>

      <Footer />
    </>
  );
}
