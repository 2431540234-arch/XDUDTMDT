// Nút bấm dùng chung, theo bộ nhận diện đỏ đô Aurelia Living
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  outline: "border border-primary text-primary hover:bg-primary hover:text-white",
  ghost: "text-primary hover:underline",
};

export default function Button({ children, variant = "primary", className = "", ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded px-5 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
