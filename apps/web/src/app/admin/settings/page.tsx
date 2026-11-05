'use client';

// Cài đặt (WIREFRAME 7.26) + khu vực "Dữ liệu giả lập" (khôi phục dữ liệu mẫu, giả lập lỗi/độ trễ)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/admin/FilterBar';
import UploadDropzone, { readAsDataUrl } from '@/components/admin/UploadDropzone';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { ErrorState, PageSkeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { paymentMethodLabel } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { ApiClientError, USE_MOCK } from '@/services/api-client';
import { toast } from '@/store/uiStore';
import type { ShippingZone, StoreSettings } from '@/types/api';

type Tab = 'store' | 'payments' | 'shipping' | 'email' | 'theme' | 'seo' | 'security' | 'mock';
const MENU: Array<[Tab, string]> = [
  ['store', 'Thông tin cửa hàng'],
  ['payments', 'Thanh toán'],
  ['shipping', 'Vận chuyển'],
  ['email', 'Email & thông báo'],
  ['theme', 'Giao diện'],
  ['seo', 'SEO'],
  ['security', 'Bảo mật'],
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="relative inline-flex h-6 w-11 cursor-pointer items-center">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="absolute inset-0 rounded-full bg-line transition peer-checked:bg-primary" />
      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </label>
  );
}

function MockPanel() {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState({ latency: true, errorRate: 0, forceError: false });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    import('@/mock-data/db').then((m) => setCfg(m.getConfig()));
  }, []);
  const update = async (patch: Partial<typeof cfg>) => {
    const m = await import('@/mock-data/db');
    m.setConfig(patch);
    setCfg(m.getConfig());
  };
  const reset = useMutation({
    mutationFn: async () => {
      const m = await import('@/mock-data/db');
      m.resetDb();
    },
    onSuccess: () => {
      qc.clear();
      toast.success('Đã khôi phục dữ liệu mẫu. Đang tải lại…');
      setTimeout(() => window.location.assign('/admin/settings'), 600);
    },
  });
  if (!USE_MOCK)
    return (
      <p className="text-sm text-muted">Chỉ khả dụng khi chạy với dữ liệu giả (NEXT_PUBLIC_USE_MOCK=true).</p>
    );
  return (
    <div className="space-y-5">
      <div className="rounded-card border border-line p-4">
        <p className="font-semibold">Khôi phục dữ liệu mẫu</p>
        <p className="mt-1 text-sm text-muted">
          Xóa mọi thay đổi (giỏ hàng, đơn hàng, CRUD…) lưu trong trình duyệt và nạp lại bộ dữ liệu ban đầu.
          Cũng có thể mở bất kỳ trang nào kèm <code>?resetMock=1</code>.
        </p>
        <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirm(true)}>
          Khôi phục dữ liệu mẫu
        </Button>
      </div>
      <div className="space-y-4 rounded-card border border-line p-4">
        <p className="font-semibold">Giả lập mạng</p>
        <div className="flex items-center justify-between">
          <span className="text-sm">Độ trễ 200–500ms</span>
          <Toggle label="Độ trễ" checked={cfg.latency} onChange={(v) => update({ latency: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Ép mọi yêu cầu GET trả lỗi 500 (thử nút “Thử lại”)</span>
          <Toggle label="Ép lỗi" checked={cfg.forceError} onChange={(v) => update({ forceError: v })} />
        </div>
        <div>
          <label className="mb-1 flex justify-between text-sm">
            <span>Tỉ lệ lỗi ngẫu nhiên</span>
            <b>{Math.round(cfg.errorRate * 100)}%</b>
          </label>
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={Math.round(cfg.errorRate * 100)}
            onChange={(e) => update({ errorRate: Number(e.target.value) / 100 })}
            className="w-full accent-primary"
            aria-label="Tỉ lệ lỗi ngẫu nhiên"
          />
        </div>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Khôi phục dữ liệu mẫu"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Hủy
            </Button>
            <Button variant="danger" loading={reset.isPending} onClick={() => reset.mutate()}>
              Khôi phục
            </Button>
          </>
        }
      >
        <p className="text-sm">Toàn bộ thay đổi của bạn trong chế độ dữ liệu giả sẽ bị xóa. Bạn chắc chắn?</p>
      </Modal>
    </div>
  );
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: adminApi.settings.get });
  const [tab, setTab] = useState<Tab>('store');
  const [s, setS] = useState<StoreSettings | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [cfgModal, setCfgModal] = useState<string | null>(null);
  useEffect(() => {
    if (q.data) setS(q.data);
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => adminApi.settings.save(s!),
    onSuccess: (d) => {
      toast.success('Đã lưu thay đổi.');
      qc.setQueryData(['admin', 'settings'], d);
      qc.invalidateQueries({ queryKey: ['settings-public'] });
      setErrs({});
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'VALIDATION_FAILED') setErrs(e.fieldErrors());
      else toast.error(errorMessage(e));
    },
  });

  if (q.isLoading || !s) return q.isError ? <ErrorState onRetry={() => q.refetch()} /> : <PageSkeleton />;
  const store = s.store;
  const setStore = (k: keyof StoreSettings['store'], v: string | null) => {
    setS({ ...s, store: { ...store, [k]: v } });
    setErrs((e) => ({ ...e, [k]: '' }));
  };
  const setZone = (i: number, p: Partial<ShippingZone>) =>
    setS({ ...s, shippingZones: s.shippingZones.map((z, k) => (k === i ? { ...z, ...p } : z)) });
  const menu: Array<[Tab, string]> = USE_MOCK ? [...MENU, ['mock', 'Dữ liệu giả lập']] : MENU;

  return (
    <div>
      <PageHeader
        title="Cài đặt"
        description="Cấu hình cửa hàng, thanh toán và vận chuyển."
        actions={
          tab !== 'mock' && ['store', 'payments', 'shipping'].includes(tab) ? (
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              Lưu thay đổi
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <nav className="card h-fit p-2" aria-label="Nhóm cài đặt">
          {menu.map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-current={tab === k}
              className={cn(
                'block w-full rounded-btn px-3 py-2.5 text-left text-sm font-medium',
                tab === k ? 'bg-surface-muted text-primary' : 'hover:bg-surface-muted/60',
              )}
            >
              {l}
            </button>
          ))}
        </nav>
        <div className="card p-5 sm:p-6">
          {tab === 'store' && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold">Thông tin cửa hàng</h2>
              <UploadDropzone
                label="Logo"
                preview={store.logoUrl}
                onError={toast.error}
                onFiles={async ([f]) => setStore('logoUrl', await readAsDataUrl(f))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Tên cửa hàng"
                  required
                  value={store.name}
                  onChange={(e) => setStore('name', e.target.value)}
                  error={errs.name}
                />
                <Input
                  label="Slogan"
                  value={store.slogan}
                  onChange={(e) => setStore('slogan', e.target.value)}
                />
                <Input
                  label="Email"
                  required
                  type="email"
                  value={store.email}
                  onChange={(e) => setStore('email', e.target.value)}
                  error={errs.email}
                />
                <Input
                  label="Hotline"
                  required
                  value={store.hotline}
                  onChange={(e) => setStore('hotline', e.target.value)}
                  error={errs.hotline}
                />
                <Input
                  wrapperClassName="sm:col-span-2"
                  label="Địa chỉ"
                  value={store.address}
                  onChange={(e) => setStore('address', e.target.value)}
                />
                <Input
                  label="Mã số thuế"
                  value={store.taxCode}
                  onChange={(e) => setStore('taxCode', e.target.value)}
                />
              </div>
            </div>
          )}
          {tab === 'payments' && (
            <div>
              <h2 className="mb-4 text-lg font-extrabold">Phương thức thanh toán</h2>
              <ul className="divide-y divide-line">
                {s.payments.map((p, i) => (
                  <li key={p.method} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <div>
                      <p className="font-semibold">
                        {paymentMethodLabel[p.method as keyof typeof paymentMethodLabel] ?? p.method}
                      </p>
                      <p className="text-sm text-muted">{p.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {['vnpay', 'momo', 'zalopay'].includes(p.method) && (
                        <button
                          type="button"
                          className="text-sm font-semibold text-primary hover:underline"
                          onClick={() => setCfgModal(p.method)}
                        >
                          Cấu hình
                        </button>
                      )}
                      <Toggle
                        label={`Bật ${p.method}`}
                        checked={p.enabled}
                        onChange={(v) =>
                          setS({
                            ...s,
                            payments: s.payments.map((x, k) => (k === i ? { ...x, enabled: v } : x)),
                          })
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <Modal
                open={Boolean(cfgModal)}
                onClose={() => setCfgModal(null)}
                title={`Cấu hình ${cfgModal?.toUpperCase()}`}
                width={460}
                footer={
                  <>
                    <Button variant="ghost" onClick={() => setCfgModal(null)}>
                      Đóng
                    </Button>
                    <Button
                      onClick={() => {
                        toast.success('Đã lưu cấu hình (mô phỏng).');
                        setCfgModal(null);
                      }}
                    >
                      Lưu cấu hình
                    </Button>
                  </>
                }
              >
                <div className="space-y-4">
                  <Input label="Mã đối tác (TMN Code)" placeholder="SANDBOX01" />
                  <Input label="Khóa bí mật (Secret)" type="password" placeholder="••••••••" />
                  <p className="text-xs text-muted">
                    Khóa không được lưu ở bản dữ liệu giả; chỉ nhập khi tích hợp cổng thật.
                  </p>
                </div>
              </Modal>
            </div>
          )}
          {tab === 'shipping' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-extrabold">Phí vận chuyển</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setS({
                      ...s,
                      shippingZones: [
                        ...s.shippingZones,
                        {
                          id: Date.now(),
                          name: 'Khu vực mới',
                          fee: 50000,
                          freeFrom: 10_000_000,
                          eta: '3–5 ngày',
                        },
                      ],
                    })
                  }
                >
                  <Icon name="plus" size={14} /> Thêm khu vực
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs uppercase text-muted">
                    <tr>
                      <th className="py-2">Khu vực</th>
                      <th>Phí</th>
                      <th>Miễn phí từ</th>
                      <th>Thời gian</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {s.shippingZones.map((z, i) => (
                      <tr key={z.id}>
                        <td className="py-2 pr-2">
                          <input
                            aria-label="Khu vực"
                            className="field !py-1.5"
                            value={z.name}
                            onChange={(e) => setZone(i, { name: e.target.value })}
                          />
                        </td>
                        <td className="pr-2">
                          <input
                            aria-label="Phí"
                            inputMode="numeric"
                            className="field !py-1.5"
                            value={z.fee}
                            onChange={(e) => setZone(i, { fee: Number(e.target.value.replace(/\D/g, '')) })}
                          />
                          <span className="text-xs text-muted">{formatCurrency(z.fee)}</span>
                        </td>
                        <td className="pr-2">
                          <input
                            aria-label="Miễn phí từ"
                            inputMode="numeric"
                            className="field !py-1.5"
                            value={z.freeFrom}
                            onChange={(e) =>
                              setZone(i, { freeFrom: Number(e.target.value.replace(/\D/g, '')) })
                            }
                          />
                          <span className="text-xs text-muted">{formatCurrency(z.freeFrom)}</span>
                        </td>
                        <td className="pr-2">
                          <input
                            aria-label="Thời gian giao"
                            className="field !py-1.5"
                            value={z.eta}
                            onChange={(e) => setZone(i, { eta: e.target.value })}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            aria-label="Xóa khu vực"
                            className="p-1.5 text-muted hover:text-danger"
                            onClick={() =>
                              setS({ ...s, shippingZones: s.shippingZones.filter((_, k) => k !== i) })
                            }
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {['email', 'theme', 'seo', 'security'].includes(tab) && (
            <div className="space-y-2 text-sm">
              <h2 className="text-lg font-extrabold">{MENU.find((m) => m[0] === tab)?.[1]}</h2>
              <p className="text-muted">
                {tab === 'email' &&
                  'Email giao dịch gửi qua SMTP (Mailpit ở môi trường phát triển); thông báo trong ứng dụng do hệ thống tự tạo khi đơn hàng đổi trạng thái.'}
                {tab === 'theme' &&
                  'Giao diện dùng bộ màu nâu – kem – be của Aurelia Living (design tokens trong apps/web/src/styles/theme.ts).'}
                {tab === 'seo' &&
                  'Tiêu đề và mô tả SEO được cấu hình theo từng sản phẩm, danh mục và trang tĩnh.'}
                {tab === 'security' &&
                  'Phiên đăng nhập dùng JWT (access 15 phút, refresh 7 ngày); giới hạn tốc độ 10 yêu cầu/phút cho đăng nhập và quên mật khẩu.'}
              </p>
              <p className="rounded-btn bg-surface-muted/60 p-3 text-muted">
                Nhóm cài đặt này hiển thị thông tin cấu hình hiện hành; chỉnh sửa trực tiếp sẽ được bổ sung
                khi backend cung cấp API tương ứng.
              </p>
            </div>
          )}
          {tab === 'mock' && (
            <div>
              <h2 className="mb-4 text-lg font-extrabold">Dữ liệu giả lập</h2>
              <MockPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
