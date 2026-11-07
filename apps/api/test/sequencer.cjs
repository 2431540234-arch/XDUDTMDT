// Thứ tự chạy file test CỐ ĐỊNH (theo tên). Mặc định Jest chạy file vừa FAIL ở lần trước lên đầu, nên thứ tự đổi giữa các lần
// chạy; các file dùng chung một aurelia_test nên thứ tự đổi ⇒ trạng thái dữ liệu đổi ⇒ lỗi chập chờn (ví dụ "Hỏi đáp" 404).
const Sequencer = require('@jest/test-sequencer').default;

module.exports = class FixedOrderSequencer extends Sequencer {
  sort(tests) {
    return [...tests].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }
};
