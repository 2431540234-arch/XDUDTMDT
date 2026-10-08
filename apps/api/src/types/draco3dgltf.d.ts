// Gói draco3dgltf không có kiểu; chỉ dùng hai hàm khởi tạo bộ giải/nén Draco cho glTF-Transform.
declare module 'draco3dgltf' {
  export function createDecoderModule(options?: object): Promise<object>;
  export function createEncoderModule(options?: object): Promise<object>;
}
