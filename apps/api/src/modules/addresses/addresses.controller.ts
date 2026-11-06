// M03 – Sổ địa chỉ: /addresses (chỉ của chính khách). Bảng: addresses
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { AddressesService } from './addresses.service';

@ApiTags('addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser('id') uid: number) {
    return this.addresses.list(uid);
  }

  @Post()
  create(@CurrentUser('id') uid: number, @Body() body: unknown) {
    return this.addresses.create(uid, body);
  }

  // /:id/default phải khai báo trước /:id
  @Patch(':id/default')
  setDefault(@CurrentUser('id') uid: number, @Param('id', ParseIntPipe) id: number) {
    return this.addresses.setDefault(uid, id);
  }

  @Patch(':id')
  update(@CurrentUser('id') uid: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.addresses.update(uid, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser('id') uid: number, @Param('id', ParseIntPipe) id: number) {
    return this.addresses.remove(uid, id);
  }
}
