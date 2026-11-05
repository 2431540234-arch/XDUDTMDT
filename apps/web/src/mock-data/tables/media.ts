// Bảng `media` – mọi ảnh/tệp được các bảng khác tham chiếu (đăng ký qua utils/media-registry)
import './users';
import './categories';
import './brands';
import './_products_gen';
import './_spaces_gen';
export { mediaRows as media } from '../utils/media-registry';
