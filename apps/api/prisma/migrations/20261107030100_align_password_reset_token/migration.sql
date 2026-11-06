-- M6: theo DAC_TA D-T29 (không có OTP): đặt lại mật khẩu bằng liên kết chứa token (password_resets.token_hash).
-- Các yêu cầu OTP cũ có token_hash ngẫu nhiên (không thể dùng làm liên kết) nên đánh dấu đã dùng; giữ nguyên các dòng.
UPDATE password_resets SET used_at = now() WHERE used_at IS NULL;
ALTER TABLE password_resets DROP COLUMN otp_hash;
ALTER TABLE password_resets DROP COLUMN attempts;
ALTER TABLE password_resets DROP COLUMN last_sent_at;
