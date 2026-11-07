// Khóa chặn chạy HAI bộ test cùng lúc trên một aurelia_test (supertest và Playwright dùng chung một DB nên chạy chồng
// nhau sẽ cho kết quả sai: 404 ngẫu nhiên, tồn kho lệch…). Khóa là tệp trong thư mục tạm chứa PID; PID đã chết ⇒ bỏ qua khóa cũ.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FILE = path.join(os.tmpdir(), 'aurelia_test.lock');

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/** Giữ khóa cho tiến trình hiện tại; trả về hàm nhả khóa. Đang có tiến trình khác giữ ⇒ ném lỗi rõ ràng. */
function acquire(label) {
  if (fs.existsSync(FILE)) {
    try {
      const cur = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (cur.pid !== process.pid && alive(cur.pid)) {
        throw new Error(
          `aurelia_test đang được dùng bởi "${cur.label}" (PID ${cur.pid}, từ ${cur.at}). ` +
            'Đừng chạy hai bộ test cùng lúc (chung một DB). Đợi bộ kia xong hoặc dừng nó rồi chạy lại.',
        );
      }
    } catch (e) {
      if (String(e.message).startsWith('aurelia_test đang')) throw e;
      /* tệp hỏng ⇒ ghi đè */
    }
  }
  fs.writeFileSync(FILE, JSON.stringify({ pid: process.pid, label, at: new Date().toISOString() }));
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      const cur = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (cur.pid === process.pid) fs.unlinkSync(FILE);
    } catch {
      /* đã mất */
    }
  };
  process.on('exit', release);
  return release;
}

module.exports = { acquire, FILE };
