'use client';

// Liên hệ (WIREFRAME 7.12)
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Button from '@/components/ui/Button';
import Icon, { type IconName } from '@/components/ui/Icon';
import Input, { Select, Textarea } from '@/components/ui/Input';
import { applyApiErrors, emailSchema, errorMessage, phoneSchema, requiredText } from '@/lib/validators';
import { contentApi } from '@/services/content.api';
import { toast } from '@/store/uiStore';

const schema = z.object({
  fullName: requiredText('Họ và tên', 2),
  phone: phoneSchema,
  email: emailSchema,
  subject: z.string().min(1, 'Vui lòng chọn chủ đề.'),
  content: requiredText('Nội dung', 10),
});
type Values = z.infer<typeof schema>;
const SUBJECTS = [
  'Tư vấn sản phẩm',
  'Đơn hàng & vận chuyển',
  'Đổi trả & bảo hành',
  'Hợp tác & dự án',
  'Khác',
];
const SHOWROOMS = [
  ['TP. Hồ Chí Minh', '123 Nguyễn Văn A, Quận 1'],
  ['Hà Nội', '45 Trần Duy Hưng, Cầu Giấy'],
  ['Đà Nẵng', '88 Nguyễn Văn Linh, Hải Châu'],
];

export default function ContactPage() {
  const settings = useQuery({ queryKey: ['settings-public'], queryFn: contentApi.settings });
  const s = settings.data?.store as { hotline?: string; email?: string; address?: string } | undefined;
  const f = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', phone: '', email: '', subject: '', content: '' },
  });
  const send = useMutation({
    mutationFn: (v: Values) => contentApi.contact(v),
    onSuccess: () => {
      toast.success('Đã gửi liên hệ. Chúng tôi sẽ phản hồi trong 24 giờ.');
      f.reset();
    },
    onError: (e) => {
      if (!applyApiErrors(e, f.setError)) toast.error(errorMessage(e));
    },
  });
  const err = f.formState.errors;
  const cards: Array<[IconName, string, string]> = [
    ['phone', 'Hotline', s?.hotline ?? '0123 456 789'],
    ['mail', 'Email', s?.email ?? 'aurelia@gmail.com'],
    ['pin', 'Showroom', s?.address ?? '123 Nguyễn Văn A, TP.HCM'],
    ['clock', 'Giờ làm việc', '8:00 – 21:00 hằng ngày'],
  ];
  return (
    <div className="container-page py-6">
      <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Liên hệ' }]} />
      <h1 className="text-3xl font-extrabold">Liên hệ với chúng tôi</h1>
      <p className="mt-1 text-muted">Đội ngũ Aurelia Living luôn sẵn sàng hỗ trợ bạn.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([icon, t, v]) => (
          <div key={t} className="card flex items-center gap-3 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-primary">
              <Icon name={icon} size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted">{t}</p>
              <p className="truncate text-sm font-semibold">{v}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form className="card space-y-4 p-6" noValidate onSubmit={f.handleSubmit((v) => send.mutate(v))}>
          <h2 className="text-lg font-extrabold">Gửi tin nhắn</h2>
          <Input label="Họ và tên" required error={err.fullName?.message} {...f.register('fullName')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Số điện thoại"
              required
              inputMode="tel"
              error={err.phone?.message}
              {...f.register('phone')}
            />
            <Input label="Email" required type="email" error={err.email?.message} {...f.register('email')} />
          </div>
          <Select
            label="Chủ đề"
            required
            placeholder="Chọn chủ đề"
            options={SUBJECTS.map((x) => ({ value: x, label: x }))}
            error={err.subject?.message}
            {...f.register('subject')}
          />
          <Textarea
            label="Nội dung"
            required
            rows={5}
            error={err.content?.message}
            {...f.register('content')}
          />
          <Button type="submit" size="lg" loading={send.isPending}>
            Gửi liên hệ
          </Button>
        </form>
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <div
              className="relative flex h-64 items-center justify-center bg-surface-muted text-muted"
              role="img"
              aria-label="Bản đồ showroom"
            >
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'linear-gradient(#d8c3a5 1px, transparent 1px), linear-gradient(90deg, #d8c3a5 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />
              <div className="relative text-center">
                <Icon name="pin" size={36} className="mx-auto text-primary" />
                <p className="mt-1 text-sm font-semibold text-ink">Aurelia Living Showroom</p>
                <p className="text-xs">Bản đồ Google Maps sẽ được nhúng ở bản chạy thật</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-extrabold">Hệ thống showroom</h2>
            <ul className="divide-y divide-line">
              {SHOWROOMS.map(([c, a]) => (
                <li key={c} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{c}</p>
                    <p className="text-muted">{a}</p>
                  </div>
                  <a
                    className="font-semibold text-primary hover:underline"
                    href={`https://www.google.com/maps/search/${encodeURIComponent(`${a} ${c}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Chỉ đường →
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
