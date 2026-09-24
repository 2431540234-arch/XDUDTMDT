// Service xử lý logic nghiệp vụ quản lý danh mục
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // Trả về danh sách danh mục cha kèm danh mục con - khớp CategoryGroup[] phía frontend
  async findAll() {
    const parents = await this.prisma.category.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    });

    return parents.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      children: p.children.map((c) => ({ slug: c.slug, name: c.name })),
    }));
  }

  // Trả về 1 danh mục (cha hoặc con) theo slug, kèm danh mục con nếu có
  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: { orderBy: { name: "asc" } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục với slug "${slug}"`);
    }

    return {
      slug: category.slug,
      name: category.name,
      description: category.description,
      imageUrl: category.imageUrl,
      parent: category.parent ? { slug: category.parent.slug, name: category.parent.name } : null,
      children: category.children.map((c) => ({ slug: c.slug, name: c.name })),
    };
  }
}
