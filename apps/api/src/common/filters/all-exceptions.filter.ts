// Bộ lọc lỗi toàn cục: mọi lỗi (AppException, HttpException, validation, Prisma, lỗi lạ) -> { success:false, error }.
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_HTTP_STATUS, ErrorCode, type ApiError } from '@aurelia-living/shared-types';
import type { Response } from 'express';
import { AppException } from '../exceptions/app.exception';

const MESSAGES: Record<string, string> = {
  [ErrorCode.VALIDATION_FAILED]: 'Dữ liệu không hợp lệ.',
  [ErrorCode.BAD_REQUEST]: 'Yêu cầu không hợp lệ.',
  [ErrorCode.AUTH_UNAUTHENTICATED]: 'Bạn chưa đăng nhập hoặc phiên đã hết hạn.',
  [ErrorCode.FORBIDDEN]: 'Bạn không có quyền thực hiện thao tác này.',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Không tìm thấy tài nguyên yêu cầu.',
  [ErrorCode.CONFLICT]: 'Dữ liệu bị xung đột với dữ liệu hiện có.',
  [ErrorCode.RESOURCE_IN_USE]: 'Không thể thực hiện vì dữ liệu đang được sử dụng.',
  [ErrorCode.PAYLOAD_TOO_LARGE]: 'Dữ liệu gửi lên quá lớn.',
  [ErrorCode.UNSUPPORTED_MEDIA_TYPE]: 'Định dạng dữ liệu không được hỗ trợ.',
  [ErrorCode.RATE_LIMITED]: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.',
  [ErrorCode.INTERNAL_ERROR]: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
  [ErrorCode.BAD_GATEWAY]: 'Dịch vụ bên ngoài đang gặp sự cố.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Dịch vụ tạm thời không khả dụng.',
};

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.AUTH_UNAUTHENTICATED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.RESOURCE_NOT_FOUND,
  409: ErrorCode.CONFLICT,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  415: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  429: ErrorCode.RATE_LIMITED,
  502: ErrorCode.BAD_GATEWAY,
  503: ErrorCode.SERVICE_UNAVAILABLE,
};

interface Mapped {
  status: number;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const mapped = this.map(exception);

    if (mapped.status >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }

    const body: ApiError = {
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.details ? { details: mapped.details } : {}),
      },
    };
    res.status(mapped.status).json(body);
  }

  private map(e: unknown): Mapped {
    if (e instanceof AppException) {
      return { status: e.status, code: e.code, message: e.message, details: e.details };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) return this.mapPrisma(e);
    if (e instanceof Prisma.PrismaClientValidationError) return this.of(ErrorCode.BAD_REQUEST);
    if (e instanceof Prisma.PrismaClientInitializationError) return this.of(ErrorCode.SERVICE_UNAVAILABLE);
    if (e instanceof HttpException) return this.mapHttp(e);
    return this.of(ErrorCode.INTERNAL_ERROR);
  }

  private mapPrisma(e: Prisma.PrismaClientKnownRequestError): Mapped {
    switch (e.code) {
      case 'P2002': {
        const target = e.meta?.target;
        const fields = Array.isArray(target) ? target.map(String) : target ? [String(target)] : [];
        return {
          status: 409,
          code: ErrorCode.CONFLICT,
          message: 'Dữ liệu đã tồn tại, vui lòng kiểm tra lại.',
          details: fields.length ? { fields } : undefined,
        };
      }
      case 'P2025':
      case 'P2001':
        return this.of(ErrorCode.RESOURCE_NOT_FOUND);
      case 'P2003':
        return this.of(ErrorCode.RESOURCE_IN_USE);
      default:
        return this.of(ErrorCode.INTERNAL_ERROR);
    }
  }

  private mapHttp(e: HttpException): Mapped {
    const status = e.getStatus();
    const resp = e.getResponse();
    const raw = typeof resp === 'string' ? resp : (resp as { message?: unknown }).message;

    if (status === 400 && Array.isArray(raw)) {
      return { ...this.of(ErrorCode.VALIDATION_FAILED), details: { _errors: raw } };
    }
    if (status === 404 && typeof raw === 'string' && raw.startsWith('Cannot ')) {
      return { status: 404, code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Đường dẫn không tồn tại.' };
    }
    const code = STATUS_TO_CODE[status] ?? (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST);
    return { status, code, message: MESSAGES[code] };
  }

  private of(code: ErrorCode): Mapped {
    return { status: ERROR_HTTP_STATUS[code], code, message: MESSAGES[code] };
  }
}
