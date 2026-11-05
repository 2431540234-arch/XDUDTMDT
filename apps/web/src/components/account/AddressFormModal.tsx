'use client';

// Modal thêm/sửa địa chỉ nhận hàng – dùng ở Tài khoản (2.8) và Thanh toán (2.5)
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import Button from '@/components/ui/Button';
import Input, { Checkbox, Select } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { PROVINCES } from '@/lib/provinces';
import { addressSchema, applyApiErrors, errorMessage } from '@/lib/validators';
import { addressApi } from '@/services/auth.api';
import { toast } from '@/store/uiStore';
import type { AddressView } from '@/types/api';

type Values = z.infer<typeof addressSchema>;

export default function AddressFormModal({
  open,
  onClose,
  address,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  address?: AddressView | null;
  onSaved?: (a: AddressView) => void;
}) {
  const qc = useQueryClient();
  const f = useForm<Values>({
    resolver: zodResolver(addressSchema),
    defaultValues: { label: 'Nhà riêng', province: PROVINCES[0], isDefault: false },
  });
  useEffect(() => {
    if (open) {
      f.reset(
        address
          ? {
              label: address.label,
              recipientName: address.recipientName,
              phone: address.phone,
              province: address.province,
              district: address.district,
              ward: address.ward,
              addressLine: address.addressLine,
              isDefault: address.isDefault,
            }
          : {
              label: 'Nhà riêng',
              recipientName: '',
              phone: '',
              province: PROVINCES[0],
              district: '',
              ward: '',
              addressLine: '',
              isDefault: false,
            },
      );
    }
  }, [open, address]);

  const save = useMutation({
    mutationFn: (v: Values) => (address ? addressApi.update(address.id, v) : addressApi.create(v)),
    onSuccess: (a) => {
      toast.success(address ? 'Đã cập nhật địa chỉ.' : 'Đã thêm địa chỉ mới.');
      qc.invalidateQueries({ queryKey: ['addresses'] });
      onSaved?.(a);
      onClose();
    },
    onError: (e) => {
      if (!applyApiErrors(e, f.setError)) toast.error(errorMessage(e));
    },
  });
  const err = f.formState.errors;
  const provinces = PROVINCES.includes(f.watch('province')) ? PROVINCES : [f.watch('province'), ...PROVINCES];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={address ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={save.isPending} onClick={f.handleSubmit((v) => save.mutate(v))}>
            Lưu địa chỉ
          </Button>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()} noValidate>
        <Input
          label="Tên gợi nhớ"
          required
          placeholder="Nhà riêng, Văn phòng…"
          error={err.label?.message}
          {...f.register('label')}
        />
        <Input
          label="Người nhận"
          required
          error={err.recipientName?.message}
          {...f.register('recipientName')}
        />
        <Input
          label="Số điện thoại"
          required
          inputMode="tel"
          placeholder="0901234567"
          error={err.phone?.message}
          {...f.register('phone')}
        />
        <Select label="Tỉnh/Thành phố" required error={err.province?.message} {...f.register('province')}>
          {provinces.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Input label="Quận/Huyện" required error={err.district?.message} {...f.register('district')} />
        <Input label="Phường/Xã" required error={err.ward?.message} {...f.register('ward')} />
        <Input
          wrapperClassName="sm:col-span-2"
          label="Số nhà, tên đường"
          required
          error={err.addressLine?.message}
          {...f.register('addressLine')}
        />
        <Checkbox className="sm:col-span-2" label="Đặt làm địa chỉ mặc định" {...f.register('isDefault')} />
      </form>
    </Modal>
  );
}
