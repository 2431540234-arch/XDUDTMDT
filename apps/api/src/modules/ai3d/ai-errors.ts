// Lỗi của nhà cung cấp tạo mô hình bằng AI: phân loại, câu tiếng Việt cho admin, và CHE TOKEN trong mọi chuỗi.
export type AiErrorKind =
  | 'quota'
  | 'queue_timeout'
  | 'space_unavailable'
  | 'auth'
  | 'timeout'
  | 'bad_output'
  | 'bad_input'
  | 'interrupted'
  | 'unknown';

/**
 * Chỉ hai loại được tự thử lại (tối đa 1 lần): chắc chắn là tạm thời. Hết lượt GPU và lỗi không rõ KHÔNG thử lại,
 * vì mỗi lần gọi space đều tốn lượt GPU kể cả khi lỗi.
 */
const RETRYABLE: AiErrorKind[] = ['queue_timeout', 'space_unavailable'];

const FRIENDLY: Record<AiErrorKind, string> = {
  quota: 'Hết lượt GPU miễn phí trên Hugging Face. Hãy thử lại sau (hạn mức tính theo ngày).',
  queue_timeout: 'Hàng đợi của máy chủ AI quá lâu. Hãy thử lại sau.',
  space_unavailable: 'Máy chủ AI (space) đang ngủ, khởi động hoặc không truy cập được. Hãy thử lại sau.',
  auth: 'Hugging Face từ chối token. Kiểm tra HF_TOKEN trong cấu hình máy chủ.',
  timeout: 'Quá thời gian chờ tạo mô hình.',
  bad_output: 'Máy chủ AI không trả về tệp GLB hợp lệ.',
  bad_input:
    'Không đọc được ảnh đầu vào (tệp ảnh hỏng hoặc không còn trên kho). Hãy chọn ảnh khác. Chưa gọi máy chủ AI.',
  interrupted: 'Việc tạo bị gián đoạn (máy chủ khởi động lại). Không tự chạy lại để tránh tốn thêm lượt.',
  unknown: 'Lỗi không rõ từ máy chủ AI. Xem thông báo nguyên văn bên dưới.',
};

export function maskSecrets(text: string, token?: string): string {
  let out = text;
  if (token) out = out.split(token).join('<token đã che>');
  return out
    .replace(/hf_[A-Za-z0-9]{8,}/g, '<token đã che>')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]{8,}/gi, '$1<che>')
    .replace(/([?&](?:__sign|token|sig|signature|X-Amz-Signature)=)[^&"'\s]+/gi, '$1<che>');
}

/** Nguyên văn lỗi (đã che token), rút gọn */
export function rawMessage(error: unknown, token?: string): string {
  let text: string;
  if (typeof error === 'string') text = error;
  else if (error instanceof Error) text = error.message;
  else {
    const o = (error ?? {}) as { title?: unknown; message?: unknown };
    text = [o.title, o.message].filter((x) => typeof x === 'string' && x).join(': ') || JSON.stringify(error);
  }
  return maskSecrets(String(text), token).slice(0, 600);
}

/** Phân loại theo nội dung thông báo; không khớp mẫu nào ⇒ unknown (không tự thử lại) */
export function classifyMessage(raw: string): AiErrorKind {
  const s = raw.toLowerCase();
  if (/quota|exceeded your (free )?gpu|gpu limit|zerogpu.*(limit|exceed)/.test(s)) return 'quota';
  if (/401|unauthori[sz]ed|invalid (api |access )?token|invalid credentials/.test(s)) return 'auth';
  if (/queue.*(full|time(d)? ?out)|time(d)? ?out.*queue/.test(s)) return 'queue_timeout';
  if (
    /space.*(sleeping|paused|building|starting|not (running|found))|could not (resolve app config|connect to)|\b(502|503|504)\b|service unavailable|fetch failed|enotfound|econnrefused/.test(
      s,
    )
  )
    return 'space_unavailable';
  return 'unknown';
}

export class AiProviderError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    readonly raw: string,
  ) {
    super(FRIENDLY[kind]);
    this.name = 'AiProviderError';
  }

  get retryable() {
    return RETRYABLE.includes(this.kind);
  }

  static from(error: unknown, token?: string): AiProviderError {
    if (error instanceof AiProviderError) return error;
    const raw = rawMessage(error, token);
    return new AiProviderError(classifyMessage(raw), raw);
  }
}
