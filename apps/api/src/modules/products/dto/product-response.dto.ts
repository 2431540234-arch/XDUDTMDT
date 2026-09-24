// DTO định dạng dữ liệu sản phẩm trả về cho client - khớp field types/product.d.ts phía frontend
import { Prisma } from "@prisma/client";

const productWithRelations = Prisma.validator<Prisma.ProductDefaultArgs>()({
  include: {
    category: true,
    images: { orderBy: { sortOrder: "asc" } },
  },
});

type ProductWithRelations = Prisma.ProductGetPayload<typeof productWithRelations>;

export interface ProductResponseDto {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  oldPrice: number | null;
  image: string | null;
  categorySlug: string;
  categoryTitle: string;
  widthCm: number;
  heightCm: number;
  depthCm: number;
}

export function toProductResponse(product: ProductWithRelations): ProductResponseDto {
  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: Number(product.basePrice),
    oldPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    image: primaryImage?.url ?? null,
    categorySlug: product.category.slug,
    categoryTitle: product.category.name,
    widthCm: Number(product.widthCm),
    heightCm: Number(product.heightCm),
    depthCm: Number(product.depthCm),
  };
}
