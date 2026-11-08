// Seed dữ liệu từ chính mock-data của Frontend (apps/web/src/mock-data) để giao diện chạy với API thật
// giống hệt khi chạy với mock. Idempotent: bản ghi đã có (theo khóa chính giữ nguyên id của mock) được bỏ qua.
//   npm run db:seed -w @aurelia-living/api          (SEED_SOURCE=mock là mặc định)
// Quy trình: nạp bảng mock (buildSeed) → copy ảnh/GLB/frame 360 vào kho → chèn bảng theo thứ tự khóa ngoại
//            (tắt trigger trong transaction để giữ nguyên lịch sử trạng thái, rating... của mock) → đặt lại sequence.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import Module from 'node:module';
import { resolve } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { storeObject } from './seed-storage';

const WEB_SRC = resolve(__dirname, '../../web/src');

// Mock-data dùng alias `@/…` của Next.js → ánh xạ sang apps/web/src khi chạy ngoài Next
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M = Module as any;
const origResolve = M._resolveFilename;
M._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request.startsWith('@/')) request = resolve(WEB_SRC, request.slice(2));
  return origResolve.call(this, request, ...rest);
};

type MockDb = import('../../web/src/mock-data/db').Db;

const prisma = new PrismaClient();
const log = (m: string) => console.log(`[seed-mock] ${m}`);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** uuid hợp lệ: giữ nguyên nếu đã đúng, nếu không thì sinh cố định từ chuỗi gốc (idempotent) */
const fixUuid = (v: string) => {
  if (UUID_RE.test(v)) return v;
  const h = createHash('md5').update(v).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const hex = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const ymd = (iso: string) => iso.slice(0, 10);

// ---------------------------------------------------------------- media
interface MediaOut {
  id: number;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  altText: string | null;
  uploadedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

async function renderSvg(url: string): Promise<string | null> {
  const svgMod = await import(resolve(WEB_SRC, 'mock-data/utils/svg'));
  const u = new URL(url, 'http://x');
  const sp = u.searchParams;
  const kind = u.pathname.replace('/mock-img/', '').replace(/\.svg$/, '');
  const num = (k: string, d: number) => {
    const n = Number(sp.get(k));
    return Number.isFinite(n) && sp.get(k) !== null ? n : d;
  };
  switch (kind) {
    case 'product':
      return svgMod.productSvg(
        sp.get('t') ?? 'sofa',
        sp.get('c') ?? 'C9B6A0',
        num('v', 1),
        sp.get('l') ?? undefined,
      );
    case 'room':
      return svgMod.roomSvg(sp.get('s') ?? 'Hiện đại', sp.get('r') ?? 'living_room', num('n', 1));
    case 'pano':
      return svgMod.panoSvg(sp.get('s') ?? 'Hiện đại', sp.get('r') ?? 'living_room', num('n', 1));
    case 'banner':
      return svgMod.bannerSvg(num('n', 1), sp.get('s') ?? 'Hiện đại');
    case 'avatar':
      return svgMod.avatarSvg(sp.get('n') ?? 'A');
    default:
      return null;
  }
}

/** Đưa một URL của mock (ảnh SVG sinh động hoặc tệp tĩnh trong public/mock) lên kho; trả về khóa lưu trữ */
async function ingest(url: string): Promise<{ key: string; size: number; mime: string }> {
  if (url.startsWith('/mock-img/')) {
    const svg = await renderSvg(url);
    if (svg === null) throw new Error(`Không dựng được ảnh ${url}`);
    const key = `mock/img/${hex(url)}.svg`;
    const size = await storeObject(key, Buffer.from(svg, 'utf8'), 'image/svg+xml');
    return { key, size, mime: 'image/svg+xml' };
  }
  if (url.startsWith('/mock/')) {
    const [path, query] = url.split('?');
    const file = resolve(WEB_SRC, '../public', path.slice(1));
    const body = await readFile(file);
    const ext = path.split('.').pop()!.toLowerCase();
    const mime =
      ext === 'glb' ? 'model/gltf-binary' : ext === 'svg' ? 'image/svg+xml' : 'application/octet-stream';
    // Cùng một tệp GLB dùng cho nhiều sản phẩm (?p=<id>) → mỗi bản ghi media cần khóa riêng
    const key = query ? path.slice(1).replace(/(\.\w+)$/, `-${hex(url)}$1`) : path.slice(1);
    const size = await storeObject(key, body, mime);
    return { key, size, mime };
  }
  throw new Error(`URL không hỗ trợ: ${url}`);
}

// ---------------------------------------------------------------- chèn hàng loạt giữ nguyên id
// Cột id của DB là GENERATED ALWAYS AS IDENTITY ⇒ createMany không chèn được id tường minh.
// Dùng INSERT … OVERRIDING SYSTEM VALUE qua jsonb_populate_recordset, ánh xạ tên trường → tên cột bằng DMMF.
const MODELS = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));

async function insertMany(tx: Prisma.TransactionClient, modelName: string, rows: unknown[]) {
  if (!rows.length) return;
  const model = MODELS.get(modelName)!;
  const fields = new Map(
    model.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum').map((f) => [f.name, f]),
  );
  const table = model.dbName ?? model.name;
  const prepared = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
      const f = fields.get(k);
      if (f && v !== undefined) out[f.dbName ?? f.name] = v instanceof Date ? v.toISOString() : v;
    }
    return out;
  });
  // Chỉ chèn các cột có mặt ở MỌI dòng; cột vắng mặt dùng DEFAULT của DB (jsonb_populate_recordset sẽ cho NULL)
  const cols = Object.keys(prepared[0]).filter((c) => prepared.every((r) => c in r));
  const colList = cols.map((c) => `"${c}"`).join(', ');
  for (let i = 0; i < prepared.length; i += 500) {
    const chunk = prepared.slice(i, i + 500).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
    await tx.$executeRawUnsafe(
      `INSERT INTO "${table}" (${colList}) OVERRIDING SYSTEM VALUE SELECT ${colList} FROM jsonb_populate_recordset(NULL::"${table}", $1::jsonb) ON CONFLICT DO NOTHING`,
      JSON.stringify(chunk),
    );
  }
}

/** tx.<model>.createMany({ data }) → insertMany; các lệnh khác (upsert, findMany…) giữ nguyên */
function withOverriding(tx: Prisma.TransactionClient): Prisma.TransactionClient {
  const byDelegate = new Map(
    [...MODELS.keys()].map((n) => [n.charAt(0).toLowerCase() + n.slice(1), n] as const),
  );
  return new Proxy(tx, {
    get(target, prop, receiver) {
      const model = typeof prop === 'string' ? byDelegate.get(prop) : undefined;
      if (!model) return Reflect.get(target, prop, receiver);
      const delegate = Reflect.get(target, prop, receiver);
      return new Proxy(delegate, {
        get(d, m) {
          if (m === 'createMany') {
            return async ({ data }: { data: unknown[] }) => insertMany(target, model, data);
          }
          return d[m];
        },
      });
    },
  }) as Prisma.TransactionClient;
}

// ---------------------------------------------------------------- main
async function main() {
  const dbMod = await import('../../web/src/mock-data/db');
  const db: MockDb = dbMod.buildSeed();
  log(
    `đọc mock-data: ${db.users.length} người dùng, ${db.products.length} sản phẩm, ${db.orders.length} đơn`,
  );

  // ---- bảo vệ dữ liệu có sẵn: nếu DB đã có người dùng/sản phẩm KHÔNG thuộc mock (ví dụ bộ dữ liệu mẫu cũ), id sẽ trùng nhau
  //      và ON CONFLICT DO NOTHING sẽ trộn hai bộ dữ liệu. Dừng lại và hướng dẫn dùng DB riêng thay vì ghi đè.
  const mockEmails = db.users.map((u) => u.email.toLowerCase());
  const mockSlugs = db.products.map((p) => p.slug);
  const [foreignUsers, foreignProducts] = await Promise.all([
    prisma.user.count({ where: { email: { notIn: mockEmails } } }),
    prisma.product.count({ where: { slug: { notIn: mockSlugs } } }),
  ]);
  if ((foreignUsers > 0 || foreignProducts > 0) && process.env.SEED_FORCE !== '1') {
    throw new Error(
      [
        `CSDL đang có dữ liệu không thuộc mock (${foreignUsers} người dùng, ${foreignProducts} sản phẩm lạ).`,
        'Seed mock giữ nguyên id của mock nên sẽ trộn lẫn với dữ liệu đó. Hãy seed vào một DB trống:',
        '  tạo DB mới (vd. aurelia_demo) → đặt DATABASE_URL tới DB đó → npm run db:deploy → npm run db:seed',
        '(đặt SEED_FORCE=1 nếu vẫn muốn chạy).',
      ].join('\n'),
    );
  }

  // ---- thuộc tính: DB có thể đã có sẵn attributes/attribute_values (dữ liệu cũ) với id khác mock → ánh xạ theo
  //      (code thuộc tính) và (thuộc tính, giá trị); chỉ tạo mới những gì chưa có, không sửa/xóa dữ liệu cũ.
  const dbAttrs = await prisma.attribute.findMany();
  const dbVals = await prisma.attributeValue.findMany();
  const usedAttr = new Set(dbAttrs.map((a) => a.id));
  const usedVal = new Set(dbVals.map((v) => v.id));
  const attrMap = new Map<number, number>();
  const newAttrs: Prisma.AttributeCreateManyInput[] = [];
  for (const a of db.attributes) {
    const ex = dbAttrs.find((x) => x.code === a.code);
    if (ex) attrMap.set(a.id, ex.id);
    else {
      let id = usedAttr.has(a.id) ? Math.max(...usedAttr) + 1 : a.id;
      while (usedAttr.has(id)) id++;
      usedAttr.add(id);
      attrMap.set(a.id, id);
      newAttrs.push({ ...a, id });
    }
  }
  const valMap = new Map<number, number>();
  const newVals: Prisma.AttributeValueCreateManyInput[] = [];
  const hexUpdates: Array<{ id: number; hex: string }> = [];
  for (const v of db.attributeValues) {
    const attrId = attrMap.get(v.attributeId)!;
    const ex = dbVals.find((x) => x.attributeId === attrId && x.value === v.value);
    const hexv = db.colorHexByValueId[v.id] ?? null;
    if (ex) {
      valMap.set(v.id, ex.id);
      if (hexv && !ex.colorHex) hexUpdates.push({ id: ex.id, hex: hexv });
    } else {
      let id = usedVal.has(v.id) ? Math.max(...usedVal) + 1 : v.id;
      while (usedVal.has(id)) id++;
      usedVal.add(id);
      valMap.set(v.id, id);
      newVals.push({ ...v, id, attributeId: attrId, colorHex: hexv });
    }
  }

  // ---- media: giữ id của mock; URL phát sinh thêm (banner, bài viết, frame 360, ảnh đánh giá…) cấp id mới
  const mediaRows: MediaOut[] = [];
  const byUrl = new Map<string, number>();
  let nextMediaId = Math.max(0, ...db.media.map((m) => m.id)) + 1;

  const ingestRow = async (id: number, url: string, base: Partial<MediaOut>) => {
    const r = await ingest(url);
    mediaRows.push({
      id,
      fileName: url.split('/').pop()!.split('?')[0],
      filePath: r.key,
      mimeType: r.mime,
      fileSize: r.size,
      altText: null,
      uploadedBy: null,
      createdAt: '2026-01-05T08:00:00.000Z',
      updatedAt: '2026-01-05T08:00:00.000Z',
      ...base,
    });
    byUrl.set(url, id);
  };

  let done = 0;
  for (const m of db.media) {
    await ingestRow(m.id, m.filePath, {
      fileName: m.fileName,
      altText: m.altText,
      uploadedBy: m.uploadedBy,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    });
    if (++done % 100 === 0) log(`  media ${done}/${db.media.length}`);
  }
  const mediaIdFor = async (url: string): Promise<number> => {
    const have = byUrl.get(url);
    if (have) return have;
    const id = nextMediaId++;
    await ingestRow(id, url, { uploadedBy: 1 });
    return id;
  };

  // ---- người dùng: băm mật khẩu của mock (admin123, 123456…) – chỉ tạo mới khi user chưa có trong DB
  const existingUserIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((u) => u.id));
  const profile = new Map(db.userProfiles.map((p) => [p.userId, p]));
  const hashCache = new Map<string, string>();
  const userRows: Prisma.UserCreateManyInput[] = [];
  for (const u of db.users) {
    if (existingUserIds.has(u.id)) continue;
    const plain = db.credentials[u.id] ?? '123456';
    let h = hashCache.get(plain);
    if (!h) hashCache.set(plain, (h = await hash(plain, 10)));
    const p = profile.get(u.id);
    userRows.push({
      id: u.id,
      uuid: fixUuid(u.uuid),
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      passwordHash: h,
      avatarMediaId: u.avatarMediaId,
      status: u.status,
      emailVerifiedAt: u.emailVerifiedAt ?? u.createdAt,
      lastLoginAt: u.lastLoginAt,
      deletedAt: u.deletedAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      gender: p?.gender ?? null,
      birthday: p?.birthday ? new Date(p.birthday) : null,
      loyaltyPoints: p?.loyaltyPoints ?? 0,
      adminNote: p?.adminNote ?? null,
    });
  }

  // ---- phụ trợ theo sản phẩm
  const extras = new Map(db.productExtras.map((e) => [e.productId, e]));
  const sizeAttrId = db.attributes.find((a) => a.code === 'size')?.id ?? 2;
  const sizeOfVariant = new Map<number, string>();
  for (const vav of db.variantAttributeValues) {
    if (vav.attributeId === sizeAttrId) {
      sizeOfVariant.set(vav.variantId, db.attributeValues.find((x) => x.id === vav.attributeValueId)!.value);
    }
  }

  // ---- URL phát sinh: banner, bài viết, ảnh đánh giá, ảnh đổi trả, frame 360
  const bannerRows: Prisma.BannerCreateManyInput[] = [];
  for (const b of db.banners) {
    bannerRows.push({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      imageMediaId: await mediaIdFor(b.imageUrl),
      link: b.link,
      position: b.position as never, // giá trị DB: 'hero-1'…
      startAt: b.startAt,
      endAt: b.endAt,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
    });
  }
  const postRows: Prisma.PostCreateManyInput[] = [];
  for (const p of db.posts) {
    postRows.push({
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      coverMediaId: await mediaIdFor(p.coverUrl),
      content: p.content,
      authorName: p.authorName,
      status: p.status === 'published' ? ('published' as const) : ('draft' as const),
      views: p.views,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
    });
  }
  const reviewImageRows: Prisma.ReviewImageCreateManyInput[] = [];
  for (const x of db.reviewExtras) {
    let i = 0;
    for (const u of x.images) {
      reviewImageRows.push({ reviewId: x.reviewId, mediaId: await mediaIdFor(u), sortOrder: i++ });
    }
  }
  const returnImageRows: Array<{ requestId: number; mediaId: number }> = [];
  for (const r of db.returnRequests) {
    for (const u of r.images) returnImageRows.push({ requestId: r.id, mediaId: await mediaIdFor(u) });
  }
  const frames360: Prisma.Product360FrameCreateManyInput[] = [];
  for (const f of db.product360Frames) {
    const cfg = db.product360.find((c) => c.productId === f.productId);
    if (!cfg) continue;
    let i = 0;
    for (const u of f.frames) {
      frames360.push({
        configId: cfg.productId, // tạm dùng productId = configId (đặt id cấu hình = productId)
        attributeValueId: valMap.get(f.colorId)!,
        frameIndex: i++,
        mediaId: await mediaIdFor(u),
      });
    }
  }
  log(`media: ${mediaRows.length} bản ghi (đã lưu lên kho)`);

  // ---- chèn dữ liệu trong MỘT transaction, tắt trigger để giữ nguyên dữ liệu mock
  await prisma.$transaction(
    async (rawTx) => {
      await rawTx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      const tx = withOverriding(rawTx);

      // vai trò: do seedCore tạo (admin = 1, user = 2)
      const roleId = new Map((await tx.role.findMany()).map((r) => [r.code, r.id]));
      const mockRole = new Map(db.roles.map((r) => [r.id, r.code]));

      await tx.media.createMany({ data: mediaRows, skipDuplicates: true });
      await tx.user.createMany({ data: userRows, skipDuplicates: true });
      await tx.userRole.createMany({
        data: db.userRoles
          .filter((r) => !existingUserIds.has(r.userId))
          .map((r) => ({ userId: r.userId, roleId: roleId.get(mockRole.get(r.roleId)!)! })),
        skipDuplicates: true,
      });
      await tx.address.createMany({
        data: db.addresses.map((a) => ({ ...a, label: db.addressLabels[a.id] ?? 'Nhà riêng' })),
        skipDuplicates: true,
      });

      // danh mục: cha trước, con sau
      const cats = [...db.categories].sort((a, b) => (a.parentId ?? 0) - (b.parentId ?? 0));
      await tx.category.createMany({
        data: cats.map((c) => ({
          ...c,
          description: db.categoryExtras[c.id]?.description ?? null,
          isFeatured: db.categoryExtras[c.id]?.isFeatured ?? false,
        })),
        skipDuplicates: true,
      });
      await tx.brand.createMany({ data: db.brands, skipDuplicates: true });
      await tx.attribute.createMany({ data: newAttrs, skipDuplicates: true });
      await tx.attributeValue.createMany({ data: newVals, skipDuplicates: true });
      for (const h of hexUpdates) {
        await rawTx.attributeValue.update({ where: { id: h.id }, data: { colorHex: h.hex } });
      }

      await tx.product.createMany({
        data: db.products.map((p) => ({
          ...p,
          style: extras.get(p.id)?.style ?? null,
          features: (extras.get(p.id)?.features ?? []) as never,
        })),
        skipDuplicates: true,
      });
      await tx.productSpec.createMany({
        data: db.productExtras.flatMap((e) =>
          e.specs.map((s, i) => ({ productId: e.productId, label: s.label, value: s.value, sortOrder: i })),
        ),
        skipDuplicates: true,
      });
      // Mock lưu tồn "có thể bán" (đã trừ hàng đang giữ cho đơn chưa giao); DB lưu tồn vật lý + số đang giữ
      const variantRows = db.productVariants.map((v) => {
        const e = extras.get(v.productId);
        const [l, w, h] = e?.dims ?? [0, 0, 0];
        const size = sizeOfVariant.get(v.id) ?? 'Tiêu chuẩn';
        const k = e?.sizeDimMult?.[size] ?? 1;
        const hk = ['Cao 1m2', 'Cao 1m5'].includes(size) ? k : 1; // chỉ biến thể "Cao" đổi chiều cao
        const price = v.salePrice ?? v.price;
        return {
          ...v,
          stockQuantity: v.stockQuantity, // tồn đã trừ theo đơn (mock: tồn có thể bán)
          costPrice: Math.round(price * (e?.costRatio ?? 0.62)),
          minStock: e?.minStock ?? 5,
          lengthCm: l ? Math.round((l * k) / 10) : null,
          widthCm: w ? Math.round((w * k) / 10) : null,
          heightCm: h ? Math.round((h * hk) / 10) : null,
        };
      });
      await tx.productVariant.createMany({ data: variantRows, skipDuplicates: true });
      // thông số tĩnh của biến thể (kích thước, giá vốn) luôn đồng bộ lại; tồn kho/giữ hàng là dữ liệu vận hành nên không ghi đè
      for (const v of variantRows) {
        await rawTx.productVariant.update({
          where: { id: v.id },
          data: {
            lengthCm: v.lengthCm,
            widthCm: v.widthCm,
            heightCm: v.heightCm,
            costPrice: v.costPrice,
            minStock: v.minStock,
          },
        });
      }
      await tx.variantAttributeValue.createMany({
        data: db.variantAttributeValues.map((x) => ({
          ...x,
          attributeId: attrMap.get(x.attributeId)!,
          attributeValueId: valMap.get(x.attributeValueId)!,
        })),
        skipDuplicates: true,
      });
      await tx.productImage.createMany({ data: db.productImages, skipDuplicates: true });
      await tx.product3DModel.createMany({
        data: db.product3dModels.map((m) => ({ ...m, uuid: fixUuid(m.uuid) })) as never,
        skipDuplicates: true,
      });
      await tx.modelFile.createMany({ data: db.modelFiles as never, skipDuplicates: true });

      await tx.product360Config.createMany({
        data: db.product360.map((c) => ({
          id: c.productId,
          productId: c.productId,
          enabled: c.enabled,
          autoRotate: c.autoRotate,
          rotationSpeed: c.rotationSpeed,
          frameCount: c.frameCount,
          defaultColorId: valMap.get(c.defaultColorId) ?? null,
        })),
        skipDuplicates: true,
      });
      await tx.product360Frame.createMany({ data: frames360, skipDuplicates: true });
      for (const c of db.product360) {
        await rawTx.product360Config.update({
          where: { productId: c.productId },
          data: { defaultColorId: valMap.get(c.defaultColorId) ?? null },
        });
      }

      // không gian mẫu
      await tx.space.createMany({
        data: db.spaces.map((s) => ({ ...s, uuid: fixUuid(s.uuid), comboDiscountPercent: 10 })),
        skipDuplicates: true,
      });
      await tx.spacePanorama.createMany({ data: db.spacePanoramas, skipDuplicates: true });
      await tx.spaceHotspot.createMany({ data: db.spaceHotspots, skipDuplicates: true });
      // Mô hình 3D đặt trong ảnh 360° (UC-ADM-17): chỉ 3 không gian đầu có placement làm dữ liệu demo; các không gian còn lại
      // không có placement nên hiển thị như trước (không tải mô hình, nhẹ cho điện thoại)
      const placedSpaces = new Set(db.spaces.slice(0, 3).map((x) => x.id));
      const placedPanos = new Set(
        db.spacePanoramas.filter((p) => placedSpaces.has(p.spaceId)).map((p) => p.id),
      );
      await tx.spaceProductPlacement.createMany({
        data: db.spaceProductPlacements.filter((p) => placedPanos.has(p.panoramaId)),
        skipDuplicates: true,
      });
      await tx.spaceBookmark.createMany({ data: db.spaceBookmarks, skipDuplicates: true });
      await tx.spaceView.createMany({
        data: db.spaceViews.map((v) => ({ ...v, visitorId: v.visitorId ? fixUuid(v.visitorId) : null })),
        skipDuplicates: true,
      });

      // giỏ hàng, yêu thích, mã giảm giá
      await tx.cart.createMany({ data: db.carts, skipDuplicates: true });
      await tx.cartItem.createMany({ data: db.cartItems, skipDuplicates: true });
      await tx.wishlist.createMany({ data: db.wishlists, skipDuplicates: true });
      const cx = new Map(db.couponExtras.map((c) => [c.couponId, c]));
      await tx.coupon.createMany({
        data: db.coupons.map((c) => {
          const x = cx.get(c.id);
          return {
            ...c,
            type: x?.kind === 'freeship' ? ('freeship' as const) : c.type,
            name: x?.name ?? null,
            description: x?.description ?? null,
            appliesTo: x?.appliesTo ?? 'all',
            appliesToLabel: x?.appliesToLabel ?? 'Tất cả sản phẩm',
          };
        }),
        skipDuplicates: true,
      });
      for (const c of db.coupons) {
        const x = cx.get(c.id);
        if (x) await rawTx.coupon.update({ where: { id: c.id }, data: { appliesToLabel: x.appliesToLabel } });
      }
      await tx.couponScope.createMany({
        data: db.couponExtras.flatMap((x) =>
          x.categoryIds.map((id) => ({ couponId: x.couponId, targetType: 'category', targetId: id })),
        ),
        skipDuplicates: true,
      });
      await tx.userCoupon.createMany({
        data: db.userCoupons.map((u) => ({
          id: u.id,
          userId: u.userId,
          couponId: u.couponId,
          savedAt: u.savedAt,
        })),
        skipDuplicates: true,
      });

      // đơn hàng
      await tx.order.createMany({
        data: db.orders.map((o) => ({ ...o, uuid: fixUuid(o.uuid) })),
        skipDuplicates: true,
      });
      await tx.orderItem.createMany({
        data: db.orderItems.map(({ lineTotal: _lineTotal, ...it }) => {
          const v = it.variantId ? db.productVariants.find((x) => x.id === it.variantId) : null;
          const e = v ? extras.get(v.productId) : null;
          return {
            ...it,
            costPrice: Math.round(it.unitPrice * (e?.costRatio ?? 0.62)),
          };
        }),
        skipDuplicates: true,
      });
      await tx.orderStatusHistory.createMany({ data: db.orderStatusHistory, skipDuplicates: true });
      await tx.payment.createMany({ data: db.payments as never, skipDuplicates: true });
      await tx.shipment.createMany({ data: db.shipments, skipDuplicates: true });
      await tx.couponUsage.createMany({ data: db.couponUsages, skipDuplicates: true });
      await tx.inventoryMovement.createMany({
        data: db.inventoryMovements.filter((m) => m.quantityChange !== 0), // DB cấm dòng biến động bằng 0
        skipDuplicates: true,
      });

      // đánh giá, hỏi đáp, đổi trả
      const rx = new Map(db.reviewExtras.map((x) => [x.reviewId, x]));
      await tx.review.createMany({
        data: db.reviews.map((r) => ({ ...r, tags: rx.get(r.id)?.tags ?? [] })),
        skipDuplicates: true,
      });
      await tx.reviewImage.createMany({ data: reviewImageRows, skipDuplicates: true });
      await tx.productQuestion.createMany({
        data: db.productQuestions.map((q) => ({
          id: q.id,
          productId: q.productId,
          userId: q.userId,
          content: q.content,
          answer: q.answer,
          answeredBy: q.answeredBy,
          answeredAt: q.answeredAt,
          isPublic: q.isPublic,
          status: q.status,
          createdAt: q.createdAt,
        })),
        skipDuplicates: true,
      });
      await tx.returnRequest.createMany({
        data: db.returnRequests.map((r) => ({
          id: r.id,
          code: r.code,
          orderId: r.orderId,
          userId: r.userId,
          type: r.type,
          reason: r.reason,
          description: r.description,
          status: r.status,
          refundAmount: r.refundAmount,
          adminNote: r.adminNote,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        skipDuplicates: true,
      });
      const retItems: Array<{ requestId: number; orderItemId: number; quantity: number }> = [];
      for (const r of db.returnRequests) {
        for (const it of r.items) {
          const oi = db.orderItems.find((x) => x.orderId === r.orderId && x.productName === it.productName);
          if (oi) retItems.push({ requestId: r.id, orderItemId: oi.id, quantity: it.quantity });
        }
      }
      await tx.returnRequestItem.createMany({ data: retItems, skipDuplicates: true });
      await tx.returnRequestImage.createMany({ data: returnImageRows, skipDuplicates: true });

      await tx.notification.createMany({ data: db.notifications as never, skipDuplicates: true });
      await tx.activityLog.createMany({ data: db.activityLogs as never, skipDuplicates: true });

      // nội dung
      await tx.page.createMany({
        data: db.pages.map((p) => ({ ...p, type: p.slug.startsWith('chinh-sach') ? 'policy' : 'static' })),
        skipDuplicates: true,
      });
      // FAQ lưu trong settings (khóa faq) theo chuẩn: không có bảng riêng
      await tx.setting.upsert({
        where: { key: 'faq' },
        update: { value: db.faqTopics as never },
        create: { key: 'faq', value: db.faqTopics as never, description: 'Câu hỏi thường gặp theo chủ đề' },
      });
      await tx.banner.createMany({ data: bannerRows, skipDuplicates: true });
      await tx.post.createMany({ data: postRows, skipDuplicates: true });
      await tx.contactMessage.createMany({
        data: db.contactMessages.map((c) => ({ ...c })),
        skipDuplicates: true,
      });
      for (const s of db.settings) {
        await tx.setting.upsert({
          where: { key: s.key },
          update: { value: s.value as never },
          create: { key: s.key, value: s.value as never, description: s.description },
        });
      }

      // kho & chi
      await tx.stockReceipt.createMany({
        data: db.stockReceipts.map((r) => ({
          id: r.id,
          code: r.code,
          type: r.type,
          supplierName: r.supplierName,
          orderCode: r.orderCode,
          status: r.status,
          createdAt: r.createdAt,
        })),
        skipDuplicates: true,
      });
      const variantIds = db.productVariants.map((v) => v.id);
      let receiptItemId = 0;
      await tx.stockReceiptItem.createMany({
        data: db.stockReceipts.flatMap((r) => {
          // Mock chỉ lưu tổng tiền và số dòng → dựng các dòng (1 cái/dòng) cộng đúng bằng tổng
          const n = Math.max(1, r.itemCount);
          const base = Math.floor(r.total / n);
          return Array.from({ length: n }, (_, i) => ({
            id: ++receiptItemId,
            receiptId: r.id,
            variantId: variantIds[(r.id * 7 + i * 13) % variantIds.length],
            quantity: 1,
            costPrice: i === n - 1 ? r.total - base * (n - 1) : base,
          }));
        }),
        skipDuplicates: true,
      });
      await tx.expense.createMany({
        data: db.expenses.map((e) => ({
          id: e.id,
          code: e.code,
          category: e.category,
          amount: e.amount,
          note: e.note,
          date: new Date(ymd(e.date)),
        })),
        skipDuplicates: true,
      });

      // bộ đếm mã (mỗi loại: giá trị hiện lớn nhất để mã mới không trùng)
      const maxSuffix = (codes: string[]) =>
        codes.reduce((m, c) => Math.max(m, Number(c.match(/(\d+)$/)?.[1] ?? 0)), 0);
      const counters: Array<[string, number]> = [
        ['RT', maxSuffix(db.returnRequests.map((r) => r.code))],
        ['PN', maxSuffix(db.stockReceipts.filter((r) => r.type === 'in').map((r) => r.code))],
        ['PX', maxSuffix(db.stockReceipts.filter((r) => r.type === 'out').map((r) => r.code))],
        ['CH', maxSuffix(db.expenses.map((e) => e.code))],
      ];
      // ALV-YYYYMMDD-NNNN: bộ đếm theo ngày
      const perDay = new Map<string, number>();
      for (const o of db.orders) {
        const m = o.orderCode.match(/^ALV-(\d{8})-(\d+)$/);
        if (m) perDay.set(m[1], Math.max(perDay.get(m[1]) ?? 0, Number(m[2])));
      }
      for (const [d, n] of perDay) counters.push([`ORD:${d}`, n]);
      for (const [key, value] of counters) {
        await tx.codeCounter.upsert({ where: { key }, update: { value }, create: { key, value } });
      }

      // sold_count = tổng số lượng của các đơn đã hoàn tất (quy tắc QUY_UOC_CODE_DB 5.2), không dùng số tính sẵn của mock
      await tx.$executeRawUnsafe(`UPDATE products p
SET sold_count = COALESCE((
  SELECT SUM(oi.quantity)
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN product_variants v ON v.id = oi.variant_id
  WHERE v.product_id = p.id AND o.status = 'completed'
), 0)`);

      // đặt lại sequence của mọi bảng có cột id tự tăng
      await tx.$executeRawUnsafe(`
        DO $$
        DECLARE r record;
        BEGIN
          FOR r IN
            SELECT c.table_name AS t, pg_get_serial_sequence(quote_ident(c.table_name), 'id') AS s
            FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.column_name = 'id' AND c.table_name <> '_prisma_migrations'
          LOOP
            IF r.s IS NOT NULL THEN
              EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM %I), 0) + 1, false)', r.s, r.t);
            END IF;
          END LOOP;
        END $$;
      `);
    },
    { timeout: 600_000, maxWait: 60_000 },
  );
  log('hoàn tất chèn dữ liệu');
}

export async function seedFromMock() {
  try {
    await main();
  } finally {
    await prisma.$disconnect();
  }
}
