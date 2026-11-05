// Dữ liệu tiếng Việt tự nhiên: họ tên, địa chỉ, nội dung đánh giá/hỏi đáp
export const lastNames = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Hồ',
  'Ngô',
  'Dương',
  'Lý',
];
export const maleMiddle = ['Văn', 'Minh', 'Quốc', 'Hữu', 'Đức', 'Thanh', 'Gia', 'Hoàng'];
export const femaleMiddle = ['Thị', 'Thu', 'Ngọc', 'Phương', 'Khánh', 'Bảo', 'Mai', 'Thùy'];
export const maleFirst = [
  'An',
  'Bình',
  'Cường',
  'Dũng',
  'Hải',
  'Hùng',
  'Khoa',
  'Long',
  'Nam',
  'Phúc',
  'Quân',
  'Sơn',
  'Tuấn',
  'Việt',
  'Khải',
  'Đạt',
];
export const femaleFirst = [
  'Anh',
  'Chi',
  'Dung',
  'Hà',
  'Hạnh',
  'Lan',
  'Linh',
  'Ngân',
  'Nhung',
  'Oanh',
  'Trang',
  'Thảo',
  'Vy',
  'Yến',
  'Hương',
  'My',
];

export const provinces: Array<{
  province: string;
  districts: Array<{ district: string; wards: string[] }>;
  fee: number;
}> = [
  {
    province: 'TP. Hồ Chí Minh',
    fee: 30000,
    districts: [
      { district: 'Quận 1', wards: ['Phường Bến Nghé', 'Phường Đa Kao', 'Phường Nguyễn Thái Bình'] },
      { district: 'Quận 7', wards: ['Phường Tân Phong', 'Phường Phú Mỹ', 'Phường Tân Hưng'] },
      { district: 'Quận Bình Thạnh', wards: ['Phường 25', 'Phường 22', 'Phường 13'] },
      { district: 'TP. Thủ Đức', wards: ['Phường Thảo Điền', 'Phường An Phú', 'Phường Hiệp Bình Chánh'] },
    ],
  },
  {
    province: 'Hà Nội',
    fee: 45000,
    districts: [
      { district: 'Quận Cầu Giấy', wards: ['Phường Dịch Vọng', 'Phường Nghĩa Đô', 'Phường Mai Dịch'] },
      { district: 'Quận Hai Bà Trưng', wards: ['Phường Bạch Mai', 'Phường Minh Khai', 'Phường Thanh Nhàn'] },
      { district: 'Quận Nam Từ Liêm', wards: ['Phường Mỹ Đình 1', 'Phường Mễ Trì', 'Phường Trung Văn'] },
    ],
  },
  {
    province: 'Đà Nẵng',
    fee: 60000,
    districts: [
      { district: 'Quận Hải Châu', wards: ['Phường Thạch Thang', 'Phường Hòa Thuận Đông'] },
      { district: 'Quận Sơn Trà', wards: ['Phường An Hải Bắc', 'Phường Mân Thái'] },
    ],
  },
  {
    province: 'Cần Thơ',
    fee: 70000,
    districts: [{ district: 'Quận Ninh Kiều', wards: ['Phường Xuân Khánh', 'Phường An Khánh'] }],
  },
  {
    province: 'Bình Dương',
    fee: 45000,
    districts: [{ district: 'TP. Thủ Dầu Một', wards: ['Phường Phú Cường', 'Phường Chánh Nghĩa'] }],
  },
];

export const streets = [
  'Nguyễn Huệ',
  'Lê Lợi',
  'Trần Hưng Đạo',
  'Võ Văn Tần',
  'Phạm Văn Đồng',
  'Nguyễn Trãi',
  'Lý Thường Kiệt',
  'Hoàng Diệu',
  'Cách Mạng Tháng 8',
  'Nguyễn Văn Linh',
  'Điện Biên Phủ',
  'Hai Bà Trưng',
];

export const reviewPositive = [
  'Sản phẩm đẹp hơn mong đợi, chất liệu chắc chắn và hoàn thiện rất tỉ mỉ. Nhân viên giao hàng lắp đặt nhanh gọn.',
  'Màu sắc đúng như hình, đặt vào phòng khách rất hợp. Gia đình mình ai cũng thích.',
  'Đóng gói cẩn thận, giao đúng hẹn. Dùng được 2 tuần thấy rất êm và bền, sẽ ủng hộ shop tiếp.',
  'Mình xem bản 3D trên web trước khi mua nên hình dung đúng kích thước, đặt vào căn hộ vừa vặn luôn.',
  'Giá hợp lý so với chất lượng. Đường may sắc nét, khung gỗ chắc, không có mùi lạ.',
  'Thiết kế tối giản nhưng sang, phối với bộ bàn ghế cũ rất hài hòa. Rất đáng tiền.',
  'Giao hàng nhanh hơn dự kiến 1 ngày. Sản phẩm nguyên vẹn, lắp ráp dễ, hướng dẫn rõ ràng.',
  'Vải mềm, không bị xù lông sau vài lần vệ sinh. Con nhỏ nhà mình nằm chơi cả ngày luôn.',
];
export const reviewNeutral = [
  'Sản phẩm ổn so với tầm giá, tuy nhiên màu thực tế hơi đậm hơn trên ảnh một chút.',
  'Chất lượng khá, giao hàng hơi chậm so với dự kiến nhưng shop có báo trước.',
  'Dùng tạm ổn, mong shop cải thiện phần hướng dẫn lắp đặt cho dễ hiểu hơn.',
];
export const reviewNegative = [
  'Hàng giao có một vết xước nhỏ ở cạnh, đã liên hệ shop và đang chờ xử lý.',
  'Kích thước hơi nhỏ hơn mình tưởng, nên xem kỹ thông số trước khi đặt.',
];
export const reviewTags = [
  'Chất lượng tốt',
  'Đúng mô tả',
  'Giao hàng nhanh',
  'Đóng gói cẩn thận',
  'Giá hợp lý',
];

export const questionTexts = [
  'Sản phẩm này có giao kèm lắp đặt tại nhà không ạ?',
  'Mình ở chung cư tầng 12 thì thang máy có chở vừa không shop?',
  'Có thể đặt thêm màu khác ngoài các màu trên web không?',
  'Bảo hành khung gỗ bao lâu vậy shop?',
  'Vải có chống thấm, dễ vệ sinh không ạ?',
  'Kích thước thực tế có đúng như mô hình 3D không?',
  'Shop có showroom ở Hà Nội để xem trực tiếp không?',
  'Còn hàng màu kem size lớn không ạ? Khi nào có hàng lại?',
  'Có xuất hóa đơn VAT cho công ty được không?',
  'Sản phẩm chịu tải tối đa bao nhiêu kg?',
  'Mình muốn đổi sang màu khác sau khi nhận hàng thì thủ tục thế nào?',
  'Có hỗ trợ trả góp 0% không shop?',
];
export const answerTexts = [
  'Dạ Aurelia có hỗ trợ giao và lắp đặt miễn phí nội thành TP.HCM và Hà Nội cho đơn từ 5 triệu ạ.',
  'Dạ shop giao tận nơi bằng xe tải nhỏ, nếu thang máy không vừa đội giao sẽ hỗ trợ vận chuyển bằng thang bộ ạ.',
  'Dạ hiện tại có thể đặt theo màu có sẵn, các màu khác shop nhận làm theo yêu cầu với thời gian 15–20 ngày ạ.',
  'Dạ khung gỗ được bảo hành 24 tháng, vải và mút bảo hành 12 tháng ạ.',
  'Dạ vải đã được xử lý chống bám bẩn, bạn có thể lau bằng khăn ẩm. Có thể tháo vỏ đệm để giặt ạ.',
  'Dạ mô hình 3D dựng đúng tỉ lệ 1:1 theo thông số kỹ thuật, sai số dưới 1cm ạ.',
];
