'use client';

// Đổi mật khẩu (WIREFRAME 7.5)
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input, { Checkbox } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { applyApiErrors, errorMessage, passwordChecks } from '@/lib/validators';
import { userApi } from '@/services/auth.api';
import { toast } from '@/store/uiStore';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
    newPassword: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự.'),
    confirm: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới.'),
    logoutOthers: z.boolean().optional(),
  })
  .refine((d) => d.newPassword === d.confirm, { path: ['confirm'], message: 'Mật khẩu xác nhận không khớp.' })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ['newPassword'],
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  });
type Values = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const f = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '', logoutOthers: true },
  });
  const save = useMutation({
    mutationFn: (v: Values) =>
      userApi.changePassword({
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
        logoutOthers: v.logoutOthers,
      }),
    onSuccess: () => {
      toast.success('Đã cập nhật mật khẩu.');
      f.reset({ currentPassword: '', newPassword: '', confirm: '', logoutOthers: true });
    },
    onError: (e) => {
      if (!applyApiErrors(e, f.setError)) toast.error(errorMessage(e));
    },
  });
  const err = f.formState.errors;
  const checks = passwordChecks(f.watch('newPassword') ?? '', f.watch('currentPassword') ?? '');
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Đổi mật khẩu</h1>
      <p className="mt-1 text-sm text-muted">
        Để bảo mật tài khoản, hãy chọn mật khẩu mạnh và không dùng lại ở nơi khác.
      </p>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <form className="card space-y-4 p-6" noValidate onSubmit={f.handleSubmit((v) => save.mutate(v))}>
          <Input
            label="Mật khẩu hiện tại"
            required
            type="password"
            icon="lock"
            autoComplete="current-password"
            error={err.currentPassword?.message}
            {...f.register('currentPassword')}
          />
          <Input
            label="Mật khẩu mới"
            required
            type="password"
            icon="lock"
            autoComplete="new-password"
            error={err.newPassword?.message}
            {...f.register('newPassword')}
          />
          <Input
            label="Xác nhận mật khẩu mới"
            required
            type="password"
            icon="lock"
            autoComplete="new-password"
            error={err.confirm?.message}
            {...f.register('confirm')}
          />
          <Checkbox label="Đăng xuất khỏi tất cả thiết bị khác" {...f.register('logoutOthers')} />
          <div className="flex gap-2">
            <Button type="submit" loading={save.isPending}>
              Cập nhật mật khẩu
            </Button>
            <Button type="button" variant="ghost" onClick={() => f.reset()}>
              Hủy
            </Button>
          </div>
        </form>
        <aside className="h-fit rounded-card bg-surface-muted p-5 text-sm">
          <h2 className="mb-3 font-bold">Yêu cầu mật khẩu</h2>
          <ul className="space-y-2">
            {checks.map((c) => (
              <li
                key={c.label}
                className={cn('flex items-center gap-2', c.ok ? 'text-emerald-600' : 'text-muted')}
              >
                <Icon name={c.ok ? 'check' : 'close'} size={16} /> {c.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Nếu bạn đăng nhập bằng Google và chưa có mật khẩu, hãy dùng chức năng “Quên mật khẩu” để tạo mật
            khẩu mới.
          </p>
        </aside>
      </div>
    </div>
  );
}
