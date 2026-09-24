// Pipe validate dữ liệu đầu vào dựa trên class-validator
import { ValidationPipe } from "@nestjs/common";

export const AppValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
