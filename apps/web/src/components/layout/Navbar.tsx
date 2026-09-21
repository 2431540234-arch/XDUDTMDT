// Component Navbar chứa link trang chủ, mega-menu danh mục và các link nhanh
import Link from "next/link";
import { mockCategoryGroups, quickNavLinks } from "@/mocks/categories";

export default function Navbar() {
  return (
    <nav className="relative z-50 h-[46px] bg-primary text-white shadow-md">
      <div className="mx-auto flex h-full max-w-[1600px] items-center px-4">
        <div className="group relative h-full">
          <button
            type="button"
            className="h-full bg-primary-dark px-5 text-xs font-bold group-hover:bg-white group-hover:text-primary"
          >
            ☰ DANH MỤC
          </button>

          <div className="invisible absolute left-0 top-[46px] grid w-[min(900px,calc(100vw-30px))] -translate-y-2 grid-cols-3 gap-x-6 gap-y-4 border border-gray-200 bg-white p-5 opacity-0 shadow-xl transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
            {mockCategoryGroups.map((group) => (
              <div key={group.slug} className="flex flex-col border-r border-gray-100 pr-3 last:border-r-0">
                <Link
                  href={`/products?category=${group.slug}`}
                  className="mb-1 text-xs font-bold uppercase text-primary"
                >
                  {group.name}
                </Link>
                {group.children.map((child) => (
                  <Link
                    key={child.slug}
                    href={`/products?category=${child.slug}`}
                    className="py-1 text-xs text-gray-600 hover:pl-1 hover:text-primary"
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="hidden flex-1 items-center md:flex">
          {quickNavLinks.map((link) => (
            <Link
              key={link.slug}
              href={`/products?category=${link.slug}`}
              className="flex h-full items-center whitespace-nowrap px-2.5 text-[11px] font-semibold hover:bg-white/10"
            >
              {link.name.toUpperCase()}
            </Link>
          ))}
        </div>

        <Link href="/products?promotion=true" className="ml-auto flex h-full items-center px-[18px] text-xs font-bold">
          KHUYẾN MÃI
        </Link>
      </div>
    </nav>
  );
}
