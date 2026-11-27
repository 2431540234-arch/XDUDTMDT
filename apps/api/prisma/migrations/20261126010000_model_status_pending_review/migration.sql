-- Mô hình 3D phải được admin duyệt trước khi khách thấy (D-3D-AI): xử lý xong ⇒ pending_review, duyệt ⇒ ready.
-- Trigger has_3d_model không đổi (chỉ tính 'ready'). Không thêm bảng hay cột (giữ 32 bảng).
ALTER TYPE model_status ADD VALUE IF NOT EXISTS 'pending_review' BEFORE 'ready';
