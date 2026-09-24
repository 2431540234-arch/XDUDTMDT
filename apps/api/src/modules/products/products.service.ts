// Service xử lý logic nghiệp vụ quản lý sản phẩm
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateProductDto } from "./dto/create-product.dto";
import { toProductResponse } from "./dto/product-response.dto";
import type { QueryProductDto } from "./dto/query-product.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";

const PRODUCT_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: "asc" as const } },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryProductDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (query.categorySlug) {
      where.category = { slug: query.categorySlug };
    }
    if (query.search) {
      where.name = { contains: query.search, mode: "insensitive" };
    }
    if (query.promotion === "true") {
      where.compareAtPrice = { not: null };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map(toProductResponse),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với slug "${slug}"`);
    }

    return toProductResponse(product);
  }

  // Sinh slug unique từ tên - nếu trùng thì thêm hậu tố -2, -3...
  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 2;

    while (true) {
      const existing = await this.prisma.product.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === excludeId) {
        return candidate;
      }
      candidate = `${base}-${suffix}`;
      suffix++;
    }
  }

  async create(dto: CreateProductDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục với id "${dto.categoryId}"`);
    }

    const existingSku = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (existingSku) {
      throw new ConflictException(`SKU "${dto.sku}" đã tồn tại.`);
    }

    let slug: string;
    if (dto.slug) {
      const existingSlug = await this.prisma.product.findUnique({ where: { slug: dto.slug } });
      if (existingSlug) {
        throw new ConflictException(`Slug "${dto.slug}" đã tồn tại.`);
      }
      slug = dto.slug;
    } else {
      slug = await this.generateUniqueSlug(dto.name);
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        sku: dto.sku,
        description: dto.description,
        basePrice: dto.basePrice,
        compareAtPrice: dto.compareAtPrice,
        widthCm: dto.widthCm,
        heightCm: dto.heightCm,
        depthCm: dto.depthCm,
        categoryId: dto.categoryId,
        images: dto.image ? { create: [{ url: dto.image, isPrimary: true, sortOrder: 0 }] } : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    return toProductResponse(product);
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id "${id}"`);
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) {
        throw new NotFoundException(`Không tìm thấy danh mục với id "${dto.categoryId}"`);
      }
    }

    if (dto.sku && dto.sku !== existing.sku) {
      const existingSku = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (existingSku) {
        throw new ConflictException(`SKU "${dto.sku}" đã tồn tại.`);
      }
    }

    let slug: string | undefined;
    if (dto.slug && dto.slug !== existing.slug) {
      const existingSlug = await this.prisma.product.findUnique({ where: { slug: dto.slug } });
      if (existingSlug) {
        throw new ConflictException(`Slug "${dto.slug}" đã tồn tại.`);
      }
      slug = dto.slug;
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        sku: dto.sku,
        description: dto.description,
        basePrice: dto.basePrice,
        compareAtPrice: dto.compareAtPrice,
        widthCm: dto.widthCm,
        heightCm: dto.heightCm,
        depthCm: dto.depthCm,
        categoryId: dto.categoryId,
      },
      include: PRODUCT_INCLUDE,
    });

    return toProductResponse(product);
  }

  async softDelete(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id "${id}"`);
    }

    await this.prisma.product.update({ where: { id }, data: { isActive: false } });

    return { id, deleted: true };
  }
}
