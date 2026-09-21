// Trang đăng nhập
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      setMessage({ text: "Đăng nhập thành công!", success: true });
      setTimeout(() => router.push("/"), 700);
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
        <h1 className="mb-2 text-center text-2xl font-bold text-primary">ĐĂNG NHẬP</h1>
        <p className="mb-6 text-center text-gray-500">Đăng nhập tài khoản của bạn</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <Input
            id="loginEmail"
            label="Email"
            type="email"
            placeholder="Nhập email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="loginPassword"
            label="Mật khẩu"
            type="password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={isLoading} className="mt-2 w-full">
            {isLoading ? "ĐANG XỬ LÝ..." : "ĐĂNG NHẬP"}
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
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-bold text-primary">
            Đăng ký ngay
          </Link>
        </p>
        <Link href="/" className="mt-3 block text-center text-gray-500">
          ← Quay lại trang chủ
        </Link>
      </section>
    </main>
  );
}
