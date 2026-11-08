'use client';

// Về chúng tôi (WIREFRAME 7.11)
import { useQuery } from '@tanstack/react-query';
import RichText from '@/components/ui/RichText';
import { LinkButton } from '@/components/ui/Button';
import Icon, { type IconName } from '@/components/ui/Icon';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { contentApi } from '@/services/content.api';

const stats = [
  ['50.000+', 'Khách hàng'],
  ['1.200+', 'Sản phẩm'],
  ['300+', 'Mô hình 3D'],
  ['12', 'Showroom'],
];
const values: Array<[IconName, string, string]> = [
  ['shield', 'Chất lượng', 'Vật liệu chọn lọc, kiểm tra nghiêm ngặt 5 bước.'],
  ['eye', 'Minh bạch', 'Giá rõ ràng, chính sách đổi trả dễ dàng.'],
  ['cube', 'Sáng tạo', 'Công nghệ 3D giúp chọn đồ chính xác.'],
  ['heart', 'Tận tâm', 'Đồng hành từ tư vấn đến lắp đặt tại nhà.'],
];
const team = [
  ['Lê Minh Quân', 'Nhà sáng lập'],
  ['Nguyễn Thị Thu', 'Giám đốc thiết kế'],
  ['Trần Quốc Bảo', 'Quản lý vận hành'],
  ['Phạm Ngọc Linh', 'Chăm sóc khách hàng'],
];

export default function AboutPage() {
  const q = useQuery({ queryKey: ['page', 'about'], queryFn: () => contentApi.page('about') });
  return (
    <div>
      <section className="relative h-[380px] overflow-hidden bg-ink">
        <img
          src="/mock-img/banner?s=Japandi&n=9"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/80 to-transparent" />
        <div className="container-page relative flex h-full flex-col justify-center text-white">
          <p className="text-xs font-semibold tracking-[0.3em]">VỀ AURELIA LIVING</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-extrabold sm:text-5xl">
            Mang không gian sống mơ ước đến gần bạn hơn
          </h1>
          <p className="mt-3 max-w-lg text-white/85">
            Từ phòng khách đến phòng ngủ, chúng tôi giúp bạn hình dung và sở hữu không gian sống hoàn hảo bằng
            công nghệ 3D.
          </p>
        </div>
      </section>
      <div className="container-page -mt-10 relative z-10">
        <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-white p-6 shadow-card sm:grid-cols-4">
          {stats.map(([n, l]) => (
            <div key={l} className="text-center">
              <dt className="text-2xl font-extrabold text-primary sm:text-3xl">{n}</dt>
              <dd className="text-sm text-muted">{l}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="container-page space-y-16 py-14">
        <section className="grid items-center gap-8 md:grid-cols-2">
          <img
            src="/mock-img/room?s=Bắc%20Âu&r=living_room&n=7"
            alt="Không gian sống"
            className="aspect-[4/3] w-full rounded-2xl object-cover"
          />
          <div>
            <h2 className="mb-3 text-2xl font-extrabold">Câu chuyện</h2>
            {q.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : q.isError ? (
              <ErrorState onRetry={() => q.refetch()} />
            ) : (
              q.data?.content && <RichText content={q.data.content} />
            )}
          </div>
        </section>
        <section>
          <h2 className="mb-6 text-center text-2xl font-extrabold">Giá trị cốt lõi</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(([icon, t, d]) => (
              <div key={t} className="card p-6 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-primary">
                  <Icon name={icon} size={24} />
                </span>
                <h3 className="font-bold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-6 text-center text-2xl font-extrabold">Đội ngũ</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {team.map(([n, r]) => (
              <div key={n} className="card p-5 text-center">
                <img
                  src={`/mock-img/avatar?n=${encodeURIComponent(n)}`}
                  alt={n}
                  className="mx-auto h-20 w-20 rounded-full"
                />
                <p className="mt-3 font-bold">{n}</p>
                <p className="text-xs text-muted">{r}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-surface-muted p-8 text-center sm:p-12">
          <h2 className="text-2xl font-extrabold">Ghé thăm showroom của chúng tôi</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Trải nghiệm trực tiếp chất liệu và thiết kế tại showroom ở TP.HCM, Hà Nội và Đà Nẵng.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton href="/contact" size="lg">
              Liên hệ ngay
            </LinkButton>
            <LinkButton href="/spaces" size="lg" variant="outline">
              Xem không gian mẫu
            </LinkButton>
          </div>
        </section>
      </div>
    </div>
  );
}
