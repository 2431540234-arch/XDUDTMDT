// Ô nhập liệu dùng chung, có nhãn và thông báo lỗi tùy chọn
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, id, className = "", ...rest }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-2 block font-bold text-ink">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`w-full rounded border px-3 py-3 outline-none transition-colors focus:border-primary ${
          error ? "border-red-500" : "border-gray-300"
        } ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});

Input.displayName = "Input";

export default Input;
