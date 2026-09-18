// Định nghĩa các kiểu dữ liệu dùng chung cho giỏ hàng

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
}
