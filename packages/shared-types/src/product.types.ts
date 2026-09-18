// Định nghĩa các kiểu dữ liệu dùng chung cho sản phẩm (Product, model 3D, ảnh...)

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  model3dUrl?: string;
}
