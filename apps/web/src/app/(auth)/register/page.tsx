// Trang đăng ký
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password !== confirm) {
      setMessage({ text: "Mật khẩu nhập lại không khớp.", success: false });
      return;
    }

    try {
      await register(name, email, password);
      setMessage({ text: "Đăng ký thành công! Đang chuyển sang trang đăng nhập...", success: true });
      setTimeout(() => router.push("/login"), 900);
    } catch (err) {
      setMessage({ text: (err as Error).message, success: false });
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-8">
      <section className="w-full max-w-[430px] rounded-lg bg-white p-8 shadow-xl">
        <div className="relative mx-auto mb-4 h-[60px] w-[110px]">
          <Image src="/images/brand/logo.png" alt="Aurelia Living" fill className="object-cover" />
        </div>
        <h1 className="mb-2 text-center text-2xl font-bold text-primary">ĐĂNG KÝ</h1>
        <p className="mb-6 text-center text-gray-500">Tạo tài khoản mới</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <Input
            id="registerName"
            label="Họ và tên"
            type="text"
            placeholder="Nhập họ và tên"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            id="registerEmail"
            label="Email"
            type="email"
            placeholder="Nhập email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="registerPassword"
            label="Mật khẩu"
            type="password"
            placeholder="Tối thiểu 6 ký tự"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            id="registerConfirm"
            label="Nhập lại mật khẩu"
            type="password"
            placeholder="Nhập lại mật khẩu"
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Button type="submit" disabled={isLoading} className="mt-2 w-full">
            {isLoading ? "ĐANG XỬ LÝ..." : "ĐĂNG KÝ"}
          </Button>
          {message && (
            <div
              className={`rounded bg-gray-100 p-2.5 text-center ${message.success ? "text-green-700" : "text-primary"}`}
            >
              {message.text}
            </div>
          )}
        </form>

        <p className="mt-5 text-center text-gray-500">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-bold text-primary">
            Đăng nhập
          </Link>
        </p>
        <Link href="/" className="mt-3 block text-center text-gray-500">
          ← Quay lại trang chủ
        </Link>
      </section>
    </main>
  );
}
