// UC-ADM-29 (phần không gian mẫu): phễu "lượt xem → bấm hotspot → thêm vào giỏ" theo từng không gian, và các sản phẩm dẫn khách
// tới không gian (space_views.source_product_id). Không có phần AR (D-P11).
//
// Gộp người dùng và khách theo visitorId: một "người xem" là một visitorId (khách đã đăng nhập vẫn gửi visitorId của trình duyệt
// nên cùng một người trước/sau khi đăng nhập chỉ tính MỘT); dòng không có visitorId (dữ liệu cũ) dùng user_id, không có cả hai thì
// mỗi dòng là một người. Mỗi người xem một không gian nhiều lần chỉ tính một lần ở mỗi bước của phễu:
//   viewers  = số người xem          clicked = số người có ít nhất một lượt bấm hotspot (hotspot_click_count > 0)
//   carted   = số người có ít nhất một lượt thêm vào giỏ (added_to_cart)   both = vừa bấm hotspot vừa thêm vào giỏ
//   clickRate = clicked / viewers,  cartRate = carted / viewers,  clickToCartRate = both / clicked   (0 khi mẫu số = 0)
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { qStr, type RawQuery } from '../../common/utils/list-query';
import { validationError } from '../../common/utils/validate';
import { addDaysYmd, endOfDayVn, startOfDayVn, vnYmd } from '../../common/utils/vn-date';
import { PrismaService } from '../../prisma/prisma.service';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const ratio = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10_000) / 10_000 : 0);

interface Row {
  views: number;
  viewers: number;
  clicked: number;
  carted: number;
  both: number;
}

const stage = (r: Row) => ({
  views: r.views,
  viewers: r.viewers,
  clicked: r.clicked,
  carted: r.carted,
  clickRate: ratio(r.clicked, r.viewers),
  cartRate: ratio(r.carted, r.viewers),
  clickToCartRate: ratio(r.both, r.clicked),
});

@Injectable()
export class AdminSpaceStatsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(q: RawQuery) {
    const to = qStr(q, 'to') || vnYmd();
    const from = qStr(q, 'from') || addDaysYmd(to, -29); // 30 ngày tính cả ngày `to`
    const bad: Record<string, string> = {};
    if (!YMD.test(from) || Number.isNaN(Date.parse(`${from}T00:00:00+07:00`)))
      bad.from = 'Ngày bắt đầu phải có dạng YYYY-MM-DD.';
    if (!YMD.test(to) || Number.isNaN(Date.parse(`${to}T00:00:00+07:00`)))
      bad.to = 'Ngày kết thúc phải có dạng YYYY-MM-DD.';
    if (!bad.from && !bad.to && from > to) bad.from = 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.';
    if (Object.keys(bad).length) throw validationError(bad);
    return {
      from,
      to,
      start: startOfDayVn(from),
      end: endOfDayVn(to),
    };
  }

  /** GET /admin/stats/spaces?from=&to= */
  async funnel(q: RawQuery) {
    const { from, to, start, end } = this.range(q);
    // pk = "người xem" đã gộp theo visitorId (xem ghi chú đầu tệp)
    const base = Prisma.sql`
      SELECT space_id, source_product_id,
             COALESCE(visitor_id::text, 'u' || user_id::text, 'r' || id::text) AS pk,
             hotspot_click_count > 0 AS clicked, added_to_cart AS carted
      FROM space_views
      WHERE created_at >= ${start} AND created_at <= ${end}`;

    const perSpace = await this.prisma.$queryRaw<Array<Row & { space_id: number }>>(Prisma.sql`
      WITH v AS (${base}),
      per AS (
        SELECT space_id, pk, count(*)::int AS views, bool_or(clicked) AS clicked, bool_or(carted) AS carted
        FROM v GROUP BY space_id, pk)
      SELECT space_id, sum(views)::int AS views, count(*)::int AS viewers,
             (count(*) FILTER (WHERE clicked))::int AS clicked,
             (count(*) FILTER (WHERE carted))::int AS carted,
             (count(*) FILTER (WHERE clicked AND carted))::int AS both
      FROM per GROUP BY space_id`);

    const total = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      WITH v AS (${base}),
      per AS (
        SELECT pk, count(*)::int AS views, bool_or(clicked) AS clicked, bool_or(carted) AS carted
        FROM v GROUP BY pk)
      SELECT coalesce(sum(views), 0)::int AS views, count(*)::int AS viewers,
             (count(*) FILTER (WHERE clicked))::int AS clicked,
             (count(*) FILTER (WHERE carted))::int AS carted,
             (count(*) FILTER (WHERE clicked AND carted))::int AS both
      FROM per`);

    const bySpaceSource = await this.prisma.$queryRaw<
      Array<{ space_id: number; product_id: number; views: number; viewers: number }>
    >(Prisma.sql`
      WITH v AS (${base})
      SELECT space_id, source_product_id AS product_id, count(*)::int AS views, count(DISTINCT pk)::int AS viewers
      FROM v WHERE source_product_id IS NOT NULL GROUP BY space_id, source_product_id`);
    const allSource = await this.prisma.$queryRaw<
      Array<{ product_id: number; views: number; viewers: number; spaces: number }>
    >(Prisma.sql`
      WITH v AS (${base})
      SELECT source_product_id AS product_id, count(*)::int AS views, count(DISTINCT pk)::int AS viewers,
             count(DISTINCT space_id)::int AS spaces
      FROM v WHERE source_product_id IS NOT NULL GROUP BY source_product_id`);

    const spaces = await this.prisma.space.findMany({
      where: { id: { in: perSpace.map((r) => r.space_id) } },
      select: { id: true, title: true, slug: true },
    });
    const productIds = [
      ...new Set([...bySpaceSource.map((r) => r.product_id), ...allSource.map((r) => r.product_id)]),
    ];
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const pName = new Map(products.map((p) => [p.id, p]));
    const source = (r: { product_id: number; views: number; viewers: number }) => ({
      productId: r.product_id,
      name: pName.get(r.product_id)?.name ?? `Sản phẩm #${r.product_id}`,
      slug: pName.get(r.product_id)?.slug ?? null,
      views: r.views,
      viewers: r.viewers,
    });

    return {
      from,
      to,
      totals: stage(total[0] ?? { views: 0, viewers: 0, clicked: 0, carted: 0, both: 0 }),
      spaces: perSpace
        .map((r) => {
          const s = spaces.find((x) => x.id === r.space_id);
          return {
            spaceId: r.space_id,
            title: s?.title ?? `Không gian #${r.space_id}`,
            slug: s?.slug ?? null,
            ...stage(r),
            sources: bySpaceSource
              .filter((x) => x.space_id === r.space_id)
              .sort((a, b) => b.viewers - a.viewers || b.views - a.views || a.product_id - b.product_id)
              .slice(0, 5)
              .map(source),
          };
        })
        .sort((a, b) => b.viewers - a.viewers || a.spaceId - b.spaceId),
      sources: allSource
        .sort((a, b) => b.viewers - a.viewers || b.views - a.views || a.product_id - b.product_id)
        .slice(0, 10)
        .map((r) => ({ ...source(r), spaces: r.spaces })),
    };
  }
}
