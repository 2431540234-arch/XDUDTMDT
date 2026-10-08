import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../exceptions/app.exception';
import { createValidationPipe } from '../pipes/validation.pipe';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
}

describe('AllExceptionsFilter', () => {
  it('AppException -> mã lỗi và HTTP status theo bảng', () => {
    const { status, body } = run(new AppException(ErrorCode.OUT_OF_STOCK, 'Hết hàng.', { variantId: 7 }));
    expect(status).toBe(409);
    expect(body).toEqual({
      success: false,
      error: { code: 'OUT_OF_STOCK', message: 'Hết hàng.', details: { variantId: 7 } },
    });
  });

  it('Prisma P2002 (trùng unique) -> 409 CONFLICT kèm danh sách trường', () => {
    const e = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { target: ['slug'] },
    });
    const { status, body } = run(e);
    expect(status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.details).toEqual({ fields: ['slug'] });
  });

  it('Prisma P2025 (không tìm thấy) -> 404 RESOURCE_NOT_FOUND', () => {
    const e = new Prisma.PrismaClientKnownRequestError('nf', { code: 'P2025', clientVersion: 'x' });
    const { status, body } = run(e);
    expect(status).toBe(404);
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('Route không tồn tại của Nest -> 404 RESOURCE_NOT_FOUND', () => {
    const { status, body } = run(new NotFoundException('Cannot GET /nope'));
    expect(status).toBe(404);
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('HttpException 400 dạng mảng thông báo -> VALIDATION_FAILED', () => {
    const { status, body } = run(new BadRequestException(['a sai', 'b sai']));
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('Lỗi lạ -> 500 INTERNAL_ERROR và không lộ nội dung lỗi', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { status, body } = run(new Error('mật khẩu db là abc'));
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('mật khẩu');
  });

  it('ValidationPipe gom lỗi theo từng trường', async () => {
    class Dto {
      email!: string;
    }
    const pipe = createValidationPipe();
    await expect(pipe.transform({ x: 1 }, { type: 'body', metatype: Dto })).rejects.toBeInstanceOf(
      AppException,
    );
  });
});
