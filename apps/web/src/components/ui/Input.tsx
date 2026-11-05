'use client';

import { forwardRef, useId, useState } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import Icon, { type IconName } from './Icon';

interface FieldShellProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function FieldShell({ label, required, error, hint, htmlFor, className, children }: FieldShellProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: IconName;
  suffix?: ReactNode;
  wrapperClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, suffix, wrapperClassName, className, required, id, type, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={hint}
      htmlFor={inputId}
      className={wrapperClassName}
    >
      <div className="relative">
        {icon && (
          <Icon
            name={icon}
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
        )}
        <input
          id={inputId}
          ref={ref}
          type={isPassword && show ? 'text' : type}
          aria-invalid={Boolean(error)}
          className={cn(
            'field',
            icon && 'pl-10',
            Boolean(isPassword || suffix) && 'pr-10',
            error && 'field-error',
            className,
          )}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
          >
            <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
          </button>
        ) : suffix ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>
        ) : null}
      </div>
    </FieldShell>
  );
});
export default Input;

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
  options?: Array<{ value: string | number; label: string }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, wrapperClassName, options, placeholder, className, required, id, children, ...rest },
  ref,
) {
  const auto = useId();
  const sid = id ?? auto;
  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={hint}
      htmlFor={sid}
      className={wrapperClassName}
    >
      <select
        id={sid}
        ref={ref}
        className={cn('field appearance-auto pr-8', error && 'field-error', className)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
    </FieldShell>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, wrapperClassName, className, required, id, rows = 4, ...rest },
  ref,
) {
  const auto = useId();
  const tid = id ?? auto;
  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={hint}
      htmlFor={tid}
      className={wrapperClassName}
    >
      <textarea
        id={tid}
        ref={ref}
        rows={rows}
        className={cn('field resize-y', error && 'field-error', className)}
        {...rest}
      />
    </FieldShell>
  );
});

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={cid} className="flex cursor-pointer items-start gap-2 text-sm text-ink">
        <input
          id={cid}
          ref={ref}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          {...rest}
        />
        {label && <span>{label}</span>}
      </label>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
