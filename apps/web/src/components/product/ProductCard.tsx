// Component thẻ sản phẩm hiển thị trong danh sách (dạng hàng ngang, bọc trong khung thẻ riêng)
import Image from "next/image";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const discount = product.oldPrice ? product.oldPrice - product.price : 0;

  return (
    <Link
      href={`/products/${product.id}`}
      className="flex gap-4 rounded-lg border border-gray-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative h-[110px] w-[110px] flex-none">
        <Image src={product.image} alt={product.name} fill sizes="110px" className="rounded object-cover" />
        {discount > 0 && (
          <span className="absolute -bottom-1 -left-1 whitespace-nowrap rounded-full bg-accent px-2 py-1 text-[11px] text-white">
            ↘ -{formatCurrency(discount)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center leading-snug">
        <div className="text-sm leading-snug text-ink">{product.name}</div>
        <div className="mt-2 text-base font-bold text-heading">
          {formatCurrency(product.price)}
          {product.oldPrice && (
            <span className="ml-1.5 text-sm font-normal text-gray-500 line-through">
              {formatCurrency(product.oldPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
