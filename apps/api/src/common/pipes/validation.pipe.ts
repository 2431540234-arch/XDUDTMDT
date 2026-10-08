import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../exceptions/app.exception';

/** Gộp lỗi class-validator (kể cả lồng nhau) thành { "a.b.c": ["thông báo", ...] } */
export function flattenValidationErrors(errors: ValidationError[], prefix = ''): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const err of errors) {
    const path = prefix ? `${prefix}.${err.property}` : err.property;
    if (err.constraints) out[path] = Object.values(err.constraints);
    if (err.children?.length) Object.assign(out, flattenValidationErrors(err.children, path));
  }
  return out;
}

export function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors) =>
      new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', flattenValidationErrors(errors)),
  });
}
