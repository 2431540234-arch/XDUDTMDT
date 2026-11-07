'use client';

// Quản lý thuộc tính và giá trị (UC-ADM-08): Màu sắc, Kích thước, Chất liệu… Giá trị được chọn trong form biến thể của sản phẩm.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/admin/FilterBar';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { ErrorState, PageSkeleton } from '@/components/ui/States';
import { errorMessage } from '@/lib/validators';
import { ApiClientError } from '@/services/api-client';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { AttributeAdmin, AttributeValueAdmin } from '@/types/api';

type Dlg =
  | { kind: 'attr'; editing: AttributeAdmin | null }
  | { kind: 'value'; attr: AttributeAdmin; editing: AttributeValueAdmin | null }
  | { kind: 'delAttr'; attr: AttributeAdmin }
  | { kind: 'delValue'; attr: AttributeAdmin; value: AttributeValueAdmin }
  | null;

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['admin', 'attributes'] });
    qc.invalidateQueries({ queryKey: ['admin', 'product'] });
  };
}

function AttrModal({ editing, onClose }: { editing: AttributeAdmin | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [code, setCode] = useState(editing?.code ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () =>
      editing
        ? adminApi.attributes.update(editing.id, {
            name: name.trim(),
            ...(editing.isSystem ? {} : { code: code.trim() }),
          })
        : adminApi.attributes.create({ code: code.trim(), name: name.trim() }),
    onSuccess: () => {
      toast.success(editing ? 'Đã cập nhật thuộc tính.' : 'Đã thêm thuộc tính.');
      refresh();
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'VALIDATION_FAILED') setErrs(e.fieldErrors());
      else if (e instanceof ApiClientError && e.code === 'CONFLICT') {
        const f = e.details ? Object.keys(e.details)[0] : 'name';
        setErrs({ [f]: e.message });
      } else toast.error(errorMessage(e));
    },
  });
  const submit = () => {
    const x: Record<string, string> = {};
    if (!code.trim()) x.code = 'Vui lòng nhập mã thuộc tính.';
    else if (!/^[a-z][a-z0-9_]*$/.test(code.trim()))
      x.code = 'Mã chỉ gồm chữ thường không dấu, số và gạch dưới.';
    if (!name.trim()) x.name = 'Vui lòng nhập tên thuộc tính.';
    setErrs(x);
    if (!Object.keys(x).length) save.mutate();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Sửa thuộc tính' : 'Thêm thuộc tính'}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Lưu thuộc tính
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Mã thuộc tính"
          required
          value={code}
          disabled={editing?.isSystem}
          onChange={(e) => {
            setCode(e.target.value);
            setErrs((x) => ({ ...x, code: '' }));
          }}
          error={errs.code}
          hint={
            editing?.isSystem
              ? 'Mã của thuộc tính hệ thống không đổi được.'
              : 'Chữ thường, không dấu, ví dụ: finish'
          }
        />
        <Input
          label="Tên thuộc tính"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrs((x) => ({ ...x, name: '' }));
          }}
          error={errs.name}
        />
      </div>
    </Modal>
  );
}

function ValueModal({
  attr,
  editing,
  onClose,
}: {
  attr: AttributeAdmin;
  editing: AttributeValueAdmin | null;
  onClose: () => void;
}) {
  const refresh = useRefresh();
  const isColor = attr.code === 'color';
  const [value, setValue] = useState(editing?.value ?? '');
  const [hex, setHex] = useState(editing?.colorHex ?? '#CCCCCC');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => {
      const body = { value: value.trim(), ...(isColor ? { colorHex: hex } : {}) };
      return editing
        ? adminApi.attributes.updateValue(attr.id, editing.id, body)
        : adminApi.attributes.addValue(attr.id, body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Đã cập nhật giá trị.' : 'Đã thêm giá trị.');
      refresh();
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiClientError && (e.code === 'VALIDATION_FAILED' || e.code === 'CONFLICT'))
        setErrs(e.code === 'CONFLICT' ? { value: e.message } : e.fieldErrors());
      else toast.error(errorMessage(e));
    },
  });
  const submit = () => {
    if (!value.trim()) return setErrs({ value: 'Vui lòng nhập giá trị.' });
    save.mutate();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`${editing ? 'Sửa' : 'Thêm'} giá trị – ${attr.name}`}
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Lưu giá trị
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Giá trị"
          required
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setErrs({});
          }}
          error={errs.value}
        />
        {isColor && (
          <label className="block text-sm font-medium">
            Mã màu
            <span className="mt-1 flex items-center gap-3">
              <input
                type="color"
                aria-label="Chọn màu"
                value={hex}
                onChange={(e) => setHex(e.target.value.toUpperCase())}
                className="h-9 w-14 cursor-pointer rounded border border-line"
              />
              <code className="text-xs text-muted">{hex}</code>
            </span>
            {errs.colorHex && <span className="mt-1 block text-xs text-danger">{errs.colorHex}</span>}
          </label>
        )}
      </div>
    </Modal>
  );
}

export default function AdminAttributesPage() {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ['admin', 'attributes'], queryFn: adminApi.attributes.list });
  const [dlg, setDlg] = useState<Dlg>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null && q.data?.length) setOpen(q.data[0].id);
  }, [q.data, open]);

  const delAttr = useMutation({
    mutationFn: (id: number) => adminApi.attributes.remove(id),
    onSuccess: () => {
      toast.success('Đã xóa thuộc tính.');
      refresh();
      setDlg(null);
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setDlg(null);
    },
  });
  const delValue = useMutation({
    mutationFn: ({ attrId, valueId }: { attrId: number; valueId: number }) =>
      adminApi.attributes.removeValue(attrId, valueId),
    onSuccess: () => {
      toast.success('Đã xóa giá trị.');
      refresh();
      setDlg(null);
    },
    onError: (e) => {
      toast.error(errorMessage(e)); // 409: đang được biến thể sử dụng
      setDlg(null);
    },
  });

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <div>
      <PageHeader
        title="Thuộc tính"
        description="Định nghĩa Màu sắc, Kích thước, Chất liệu… và các giá trị để gắn cho biến thể sản phẩm."
        actions={
          <Button onClick={() => setDlg({ kind: 'attr', editing: null })}>
            <Icon name="plus" size={16} /> Thêm thuộc tính
          </Button>
        }
      />
      <div className="space-y-4">
        {q.data!.map((a) => (
          <section key={a.id} className="card p-5" aria-label={`Thuộc tính ${a.name}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className="flex items-center gap-2 text-left"
                aria-expanded={open === a.id}
                onClick={() => setOpen(open === a.id ? null : a.id)}
              >
                <Icon name={open === a.id ? 'chevronDown' : 'chevronRight'} size={16} />
                <h2 className="text-lg font-bold">{a.name}</h2>
                <code className="text-xs text-muted">{a.code}</code>
                <span className="text-xs text-muted">· {a.values.length} giá trị</span>
                {a.isSystem && (
                  <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] text-primary">
                    Hệ thống
                  </span>
                )}
              </button>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDlg({ kind: 'value', attr: a, editing: null })}
                >
                  <Icon name="plus" size={14} /> Thêm giá trị
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Sửa thuộc tính ${a.name}`}
                  onClick={() => setDlg({ kind: 'attr', editing: a })}
                >
                  Sửa
                </Button>
                {!a.isSystem && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Xóa thuộc tính ${a.name}`}
                    onClick={() => setDlg({ kind: 'delAttr', attr: a })}
                  >
                    Xóa
                  </Button>
                )}
              </div>
            </div>
            {open === a.id && (
              <div className="mt-4 overflow-x-auto">
                {a.values.length === 0 ? (
                  <p className="text-sm text-muted">Chưa có giá trị.</p>
                ) : (
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-left text-xs uppercase text-muted">
                      <tr>
                        <th className="py-2">Giá trị</th>
                        {a.code === 'color' && <th>Màu</th>}
                        <th>Biến thể đang dùng</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {a.values.map((v) => (
                        <tr key={v.id}>
                          <td className="py-2 font-semibold">{v.value}</td>
                          {a.code === 'color' && (
                            <td>
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className="h-5 w-5 rounded-full border border-black/15"
                                  style={{ background: v.colorHex ?? '#ccc' }}
                                />
                                <code className="text-xs text-muted">{v.colorHex}</code>
                              </span>
                            </td>
                          )}
                          <td>{v.usageCount}</td>
                          <td className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Sửa giá trị ${v.value}`}
                              onClick={() => setDlg({ kind: 'value', attr: a, editing: v })}
                            >
                              Sửa
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Xóa giá trị ${v.value}`}
                              onClick={() => setDlg({ kind: 'delValue', attr: a, value: v })}
                            >
                              Xóa
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      {dlg?.kind === 'attr' && <AttrModal editing={dlg.editing} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'value' && (
        <ValueModal attr={dlg.attr} editing={dlg.editing} onClose={() => setDlg(null)} />
      )}
      <Modal
        open={dlg?.kind === 'delAttr' || dlg?.kind === 'delValue'}
        onClose={() => setDlg(null)}
        title={dlg?.kind === 'delAttr' ? 'Xóa thuộc tính' : 'Xóa giá trị'}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDlg(null)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={delAttr.isPending || delValue.isPending}
              onClick={() =>
                dlg?.kind === 'delAttr'
                  ? delAttr.mutate(dlg.attr.id)
                  : dlg?.kind === 'delValue' &&
                    delValue.mutate({ attrId: dlg.attr.id, valueId: dlg.value.id })
              }
            >
              Xóa
            </Button>
          </>
        }
      >
        {dlg?.kind === 'delAttr' && (
          <p className="text-sm">
            Xóa thuộc tính <b>{dlg.attr.name}</b> và các giá trị của nó? Không xóa được nếu có giá trị đang
            được biến thể sử dụng.
          </p>
        )}
        {dlg?.kind === 'delValue' && (
          <>
            <p className="text-sm">
              Xóa giá trị <b>{dlg.value.value}</b> của thuộc tính {dlg.attr.name}?
            </p>
            {dlg.value.usageCount > 0 && (
              <p role="alert" className="mt-3 rounded-btn bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Giá trị đang được <b>{dlg.value.usageCount} biến thể</b> sử dụng nên sẽ không xóa được.
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
