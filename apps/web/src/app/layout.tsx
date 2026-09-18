import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Aurelia Living",
  description: "Nội thất xem 3D/360° và trải nghiệm AR",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
