// Khai báo kiểu dữ liệu cục bộ liên quan đến sản phẩm cho web

export type ProductSection = "flashSale" | "featured" | "newProducts";

export interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  oldPrice?: number;
  image: string;
  section: ProductSection;
}

export interface CategoryLink {
  slug: string;
  name: string;
}

export interface CategoryGroup {
  slug: string;
  name: string;
  children: CategoryLink[];
}
