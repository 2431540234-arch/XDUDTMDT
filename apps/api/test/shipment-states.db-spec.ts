// E2E (supertest) UC-ADM-25 / O-03 / D-N34: máy trạng thái vận đơn theo DAC_TA §10.4, thông báo failed/returned đúng một lần,
// hủy đơn "Đang giao" khi vận đơn đã hoàn về, hoàn tiền một lần. Chạy trên aurelia_test.
// Ghi chú: hệ thống KHÔNG có endpoint webhook của đơn vị vận chuyển (vận đơn nhập tay, webhook là hướng phát triển – DAC_TA mục 13)
// nên tính idempotent được kiểm trên PATCH /admin/shipments/:id (lặp lại cùng trạng thái, yêu cầu đồng thời).
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, ShipmentStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

const ALL: ShipmentStatus[] = ['pending', 'picked_up', 'in_transit', 'failed', 'delivered', 'returned'];
/** DAC_TA §10.4 */
const ALLOWED: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered', 'failed', 'returned'],
  failed: ['in_transit', 'returned'],
  delivered: [],
  returned: [],
};

describe('Trạng thái vận đơn, hủy đơn khi hoàn hàng, hoàn tiền (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let seq = 0;
  const tag = `${Date.now()}`;

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const api = (method: Method, path: string, token?: string, body?: object) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const setShip = (id: number, body: object) => api('patch', `/admin/shipments/${id}`, admin, body);

  /** Đặt một đơn mới (khách riêng) */
  const place = async (paymentMethod: 'cod' | 'bank_transfer' = 'cod') => {
    const email = `ship-${tag}-${++seq}@test.local`;
    await api('post', '/auth/register', undefined, {
      fullName: 'Khách vận đơn',
      email,
      phone: '0911222333',
      password: 'matkhau-12345',
    });
    const tok = (await api('post', '/auth/login', undefined, { email, password: 'matkhau-12345' })).body.data
      .tokens.accessToken as string;
    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    const addr = (
      await api('post', '/addresses', tok, {
        recipientName: 'Nguyễn Văn A',
        phone: '0912345678',
        province: 'TP. Hồ Chí Minh',
        district: 'Quận 1',
        ward: 'Phường Bến Nghé',
        addressLine: '12 Lê Lợi',
      })
    ).body.data;
    const v = await prisma.productVariant.findFirstOrThrow({
      where: {
        isActive: true,
        stockQuantity: { gte: 20 },
        product: { status: 'published', deletedAt: null },
      },
      orderBy: { id: 'asc' },
    });
    await api('post', '/cart/items', tok, { variantId: v.id, quantity: 2 });
    const o = await api('post', '/orders', tok, { addressId: addr.id, paymentMethod });
    expect(o.status).toBe(201);
    return {
      tok,
      user,
      variantId: v.id,
      id: o.body.data.id as number,
      code: o.body.data.orderCode as string,
      paymentId: o.body.data.payment.id as number,
    };
  };
  /** Đưa đơn tới "Đang giao" có một vận đơn; trả về id vận đơn */
  const toShipping = async (o: { id: number }) => {
    // đơn đã thanh toán chuyển khoản thì xác nhận thanh toán đã đưa đơn sang confirmed: chỉ làm các bước còn thiếu
    const cur = (await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status;
    for (const st of ['confirmed', 'processing'].slice(cur === 'pending' ? 0 : 1))
      expect((await api('patch', `/admin/orders/${o.id}/status`, admin, { status: st })).status).toBe(200);
    const sh = await api('post', `/admin/orders/${o.id}/shipments`, admin, {
      carrier: 'ghn',
      trackingCode: `T${tag}${o.id}`,
    });
    expect(sh.status).toBe(201);
    expect((await api('patch', `/admin/orders/${o.id}/status`, admin, { status: 'shipping' })).status).toBe(
      200,
    );
    return sh.body.data.shipment.id as number;
  };
  const walk = async (shipmentId: number, steps: ShipmentStatus[]) => {
    for (const st of steps) expect((await setShip(shipmentId, { status: st })).status).toBe(200);
  };
  const orderRow = (id: number) => prisma.order.findUniqueOrThrow({ where: { id } });
  const notices = (userId: number, titlePart: string) =>
    prisma.notification.count({ where: { userId, title: { contains: titlePart } } });

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    const r = await api('post', '/auth/login', undefined, {
      email: 'admin@aurelia.vn',
      password: 'admin123',
      adminOnly: true,
    });
    admin = r.body.data.tokens.accessToken;
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  it('ma trận 6×6: chỉ các bước của DAC_TA §10.4 được phép; cùng trạng thái là thao tác rỗng; trạng thái cuối không rời', async () => {
    const o = await place();
    const id = await toShipping(o);
    for (const from of ALL) {
      for (const to of ALL) {
        // đưa vận đơn (và đơn) về trạng thái xuất phát bằng cách ghi thẳng CSDL
        await prisma.shipment.update({
          where: { id },
          data: { status: from, shippedAt: from === 'pending' ? null : new Date(), deliveredAt: null },
        });
        await prisma.order.update({ where: { id: o.id }, data: { status: 'shipping' } });
        const r = await setShip(id, { status: to });
        const label = `${from} → ${to}`;
        if (from === to) {
          expect([label, r.status]).toEqual([label, 200]); // lặp lại: rỗng
          expect((await prisma.shipment.findUniqueOrThrow({ where: { id } })).status).toBe(from);
        } else if (ALLOWED[from].includes(to)) {
          expect([label, r.status]).toEqual([label, 200]);
          expect((await prisma.shipment.findUniqueOrThrow({ where: { id } })).status).toBe(to);
        } else {
          expect([label, r.status, r.body.error?.code]).toEqual([label, 409, 'INVALID_STATE']);
          expect((await prisma.shipment.findUniqueOrThrow({ where: { id } })).status).toBe(from); // không đổi
        }
      }
    }
  }, 120_000);

  it('failed chỉ từ in_transit; failed → in_transit (giao lại) → delivered; failed → returned; đơn giữ "Đang giao"', async () => {
    const o = await place();
    const id = await toShipping(o);
    expect((await setShip(id, { status: 'failed' })).status).toBe(409); // pending → failed
    await walk(id, ['picked_up']);
    expect((await setShip(id, { status: 'failed' })).status).toBe(409); // picked_up → failed
    await walk(id, ['in_transit', 'failed']);
    expect((await orderRow(o.id)).status).toBe('shipping');
    // failed không phải trạng thái cuối: vẫn sửa được thông tin vận đơn
    expect((await setShip(id, { trackingCode: `SUA-${tag}` })).status).toBe(200);
    await walk(id, ['in_transit', 'failed', 'returned']);
    expect((await prisma.shipment.findUniqueOrThrow({ where: { id } })).status).toBe('returned');
    expect((await orderRow(o.id)).status).toBe('shipping');

    const o2 = await place();
    const id2 = await toShipping(o2);
    await walk(id2, ['picked_up', 'in_transit', 'failed', 'in_transit', 'delivered']);
    expect((await orderRow(o2.id)).status).toBe('completed');
  });

  it('shippedAt/deliveredAt đúng; trạng thái cuối delivered/returned không sửa thông tin; lặp lại trạng thái cuối là rỗng (không ghi nhật ký)', async () => {
    const o = await place();
    const id = await toShipping(o);
    await walk(id, ['picked_up', 'in_transit', 'delivered']);
    const row = await prisma.shipment.findUniqueOrThrow({ where: { id } });
    expect(row.shippedAt).not.toBeNull();
    expect(row.deliveredAt).not.toBeNull();
    expect(row.deliveredAt!.getTime()).toBeGreaterThanOrEqual(row.shippedAt!.getTime());
    const logs = () => prisma.activityLog.count({ where: { targetType: 'shipment', targetId: id } });
    const before = await logs();
    expect((await setShip(id, { status: 'delivered' })).status).toBe(200);
    expect(await logs()).toBe(before);
    expect((await setShip(id, { trackingCode: 'doi' })).status).toBe(409);
    expect((await setShip(id, { status: 'failed' })).status).toBe(409);
    expect((await orderRow(o.id)).status).toBe('completed');
  });

  it('thông báo cho khách khi failed và returned: đúng một lần, lặp lại và yêu cầu đồng thời không gửi trùng', async () => {
    const o = await place();
    const id = await toShipping(o);
    await walk(id, ['picked_up', 'in_transit']);
    expect(await notices(o.user.id, 'giao hàng không thành công')).toBe(0);

    const par = await Promise.all(Array.from({ length: 6 }, () => setShip(id, { status: 'failed' })));
    expect(par.every((r) => r.status === 200)).toBe(true);
    expect(await notices(o.user.id, `Đơn ${o.code} giao hàng không thành công`)).toBe(1);
    expect(
      await prisma.activityLog.count({ where: { action: 'shipment.update_status', targetId: id } }),
    ).toBe(3); // picked_up, in_transit, failed
    expect((await setShip(id, { status: 'failed' })).status).toBe(200); // lặp lại
    expect(await notices(o.user.id, 'giao hàng không thành công')).toBe(1);

    expect((await setShip(id, { status: 'returned' })).status).toBe(200);
    expect((await setShip(id, { status: 'returned' })).status).toBe(200);
    expect(await notices(o.user.id, `Đơn ${o.code} đã được hoàn về cửa hàng`)).toBe(1);
    const note = await prisma.notification.findFirstOrThrow({
      where: { userId: o.user.id, title: { contains: 'hoàn về cửa hàng' } },
    });
    expect(JSON.stringify(note.data)).toContain(`/account/orders/${o.code}`);
  });

  it('lỗi gửi thông báo KHÔNG làm hỏng việc cập nhật vận đơn: vận đơn vẫn đổi trạng thái và có nhật ký', async () => {
    const o = await place();
    const id = await toShipping(o);
    await walk(id, ['picked_up', 'in_transit']);
    const svc = app.get(NotificationsService, { strict: false });
    const spy = jest.spyOn(svc, 'notify').mockRejectedValueOnce(new Error('nhà cung cấp thông báo lỗi'));
    try {
      const r = await setShip(id, { status: 'failed' });
      expect(r.status).toBe(200);
      expect(r.body.data.shipment.status).toBe('failed');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
    expect((await prisma.shipment.findUniqueOrThrow({ where: { id } })).status).toBe('failed');
    expect(await notices(o.user.id, 'giao hàng không thành công')).toBe(0); // thông báo hỏng không được ghi
    expect(
      await prisma.activityLog.count({ where: { action: 'shipment.update_status', targetId: id } }),
    ).toBe(3);
    // lần cập nhật sau vẫn bình thường
    expect((await setShip(id, { status: 'in_transit' })).status).toBe(200);
  });

  it('lý do và người thực hiện được ghi vào nhật ký; lý do quá dài ⇒ 400', async () => {
    const o = await place();
    const id = await toShipping(o);
    await walk(id, ['picked_up', 'in_transit']);
    expect((await setShip(id, { status: 'failed', reason: 'x'.repeat(256) })).status).toBe(400);
    expect((await prisma.shipment.findUniqueOrThrow({ where: { id } })).status).toBe('in_transit');
    expect((await setShip(id, { status: 'failed', reason: 'Khách không nghe máy' })).status).toBe(200);
    const log = await prisma.activityLog.findFirstOrThrow({
      where: { action: 'shipment.update_status', targetId: id },
      orderBy: { id: 'desc' },
    });
    expect(log.actorId).toBe(
      (await prisma.user.findFirstOrThrow({ where: { email: 'admin@aurelia.vn' } })).id,
    );
    expect(JSON.stringify(log.changes)).toContain('Khách không nghe máy');
    expect(JSON.stringify(log.changes)).toContain('failed');
  });

  it('hai yêu cầu chuyển trạng thái KHÁC NHAU cùng lúc (failed và returned từ in_transit): chỉ một kết quả cuối, không 5xx', async () => {
    const o = await place();
    const id = await toShipping(o);
    await walk(id, ['picked_up', 'in_transit']);
    const rs = await Promise.all([setShip(id, { status: 'failed' }), setShip(id, { status: 'returned' })]);
    expect(rs.every((r) => r.status < 500)).toBe(true);
    const final = (await prisma.shipment.findUniqueOrThrow({ where: { id } })).status;
    expect(['failed', 'returned']).toContain(final);
    // returned thắng ⇒ failed sau đó 409; failed thắng ⇒ returned sau đó vẫn hợp lệ (failed → returned)
    expect(rs.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
  });

  describe('hủy đơn khi vận đơn đã hoàn về (ngoại lệ D-N34) và hoàn tiền', () => {
    it('đơn "Đang giao" chỉ hủy được khi MỌI vận đơn đã returned; khách tự hủy vẫn bị chặn', async () => {
      const o = await place();
      const id = await toShipping(o);
      const cancel = (token = admin) =>
        api('post', `/admin/orders/${o.id}/cancel`, token, { reason: 'Khách không nhận hàng' });
      // vận đơn đang chạy / failed ⇒ chưa hủy được
      await walk(id, ['picked_up']);
      expect((await cancel()).status).toBe(409);
      await walk(id, ['in_transit', 'failed']);
      const failed = await cancel();
      expect(failed.status).toBe(409);
      expect(failed.body.error.message).toContain('hoàn về');
      expect((await orderRow(o.id)).status).toBe('shipping');
      await walk(id, ['returned']);
      // khách không tự hủy được đơn đang giao kể cả khi hàng đã hoàn về
      expect((await api('post', `/orders/${o.id}/cancel`, o.tok, { reason: 'Không cần nữa' })).status).toBe(
        409,
      );
      expect((await orderRow(o.id)).status).toBe('shipping');
      // đã tạo vận đơn mới đang chạy ⇒ không hủy
      const again = await api('post', `/admin/orders/${o.id}/shipments`, admin, { carrier: 'ghtk' });
      expect(again.status).toBe(201);
      expect((await cancel()).status).toBe(409);
      await walk(again.body.data.shipment.id, ['picked_up', 'in_transit', 'returned']);
      // mọi vận đơn đã returned ⇒ hủy được
      const done = await cancel();
      expect(done.status).toBe(200);
      expect(done.body.data.status).toBe('cancelled');
      expect((await cancel()).status).toBe(409); // hủy lần hai
    });

    it('hủy ghi lịch sử (người thực hiện, lý do), hoàn lại tồn kho, giải phóng thanh toán COD chờ, không hoàn tiền (chưa thu)', async () => {
      const o = await place('cod');
      const id = await toShipping(o);
      const stock0 = (await prisma.productVariant.findUniqueOrThrow({ where: { id: o.variantId } }))
        .stockQuantity;
      await walk(id, ['picked_up', 'in_transit', 'returned']);
      const r = await api('post', `/admin/orders/${o.id}/cancel`, admin, { reason: 'Hàng hoàn về kho' });
      expect(r.status).toBe(200);
      expect(
        (await prisma.productVariant.findUniqueOrThrow({ where: { id: o.variantId } })).stockQuantity,
      ).toBe(stock0 + 2);
      expect(
        await prisma.inventoryMovement.count({
          where: { variantId: o.variantId, type: 'return', referenceCode: o.code },
        }),
      ).toBe(1);
      const hist = await prisma.orderStatusHistory.findFirstOrThrow({
        where: { orderId: o.id, toStatus: 'cancelled' },
      });
      expect([hist.fromStatus, hist.note]).toEqual(['shipping', 'Hàng hoàn về kho']);
      expect(hist.changedBy).not.toBeNull();
      expect((await orderRow(o.id)).cancelReason).toBe('Hàng hoàn về kho');
      const pay = await prisma.payment.findUniqueOrThrow({ where: { id: o.paymentId } });
      expect(pay.status).toBe('failed'); // COD chưa thu tiền
      // COD chưa thanh toán ⇒ không có gì để hoàn
      const refund = await api('post', `/admin/orders/${o.id}/refund`, admin);
      expect(refund.status).toBe(409);
      expect(await prisma.expense.count({ where: { orderId: o.id } })).toBe(0);
      expect(await notices(o.user.id, `Đơn ${o.code} đã được hủy`)).toBe(1);
    });

    it('đã thanh toán: hủy → hoàn tiền đúng một lần (phiếu chi một lần, hoàn lần hai bị từ chối, đồng thời chỉ một thành công)', async () => {
      const o = await place('bank_transfer');
      expect(
        (
          await api('patch', `/admin/payments/${o.paymentId}/confirm`, admin, {
            transactionCode: `HT-${tag}`,
          })
        ).status,
      ).toBe(200);
      const id = await toShipping(o);
      await walk(id, ['picked_up', 'in_transit', 'failed', 'returned']);
      expect((await api('post', `/admin/orders/${o.id}/cancel`, admin, { reason: 'Hoàn hàng' })).status).toBe(
        200,
      );
      let row = await orderRow(o.id);
      expect([row.status, row.paymentStatus]).toEqual(['cancelled', 'paid']); // D-N15: giữ paid để hoàn tiền thủ công
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: o.paymentId } })).status).toBe('success');

      const rs = await Promise.all([1, 2, 3].map(() => api('post', `/admin/orders/${o.id}/refund`, admin)));
      expect(rs.map((r) => r.status).sort()).toEqual([200, 409, 409]);
      row = await orderRow(o.id);
      expect([row.status, row.paymentStatus]).toEqual(['refunded', 'refunded']);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: o.paymentId } })).status).toBe(
        'refunded',
      );
      expect(await prisma.expense.count({ where: { orderId: o.id, category: 'refund' } })).toBe(1);
      expect(await notices(o.user.id, `Đơn ${o.code} đã được hoàn tiền`)).toBe(1);
      expect((await api('post', `/admin/orders/${o.id}/refund`, admin)).status).toBe(409);
      expect(await prisma.expense.count({ where: { orderId: o.id, category: 'refund' } })).toBe(1);
    });

    it('quyền: khách và người chưa đăng nhập không đổi được vận đơn hay hủy đơn đang giao', async () => {
      const o = await place();
      const id = await toShipping(o);
      await walk(id, ['picked_up', 'in_transit', 'returned']);
      expect((await api('patch', `/admin/shipments/${id}`, o.tok, { status: 'in_transit' })).status).toBe(
        403,
      );
      expect((await api('patch', `/admin/shipments/${id}`, undefined, { status: 'in_transit' })).status).toBe(
        401,
      );
      expect((await api('post', `/admin/orders/${o.id}/cancel`, o.tok, {})).status).toBe(403);
      expect((await orderRow(o.id)).status).toBe('shipping');
    });
  });
});
