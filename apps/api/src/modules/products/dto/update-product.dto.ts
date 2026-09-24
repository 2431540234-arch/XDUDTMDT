// DTO validate dữ liệu đầu vào khi cập nhật sản phẩm (partial update)
import { PartialType } from "@nestjs/mapped-types";
import { CreateProductDto } from "./create-product.dto";

export class UpdateProductDto extends PartialType(CreateProductDto) {}
