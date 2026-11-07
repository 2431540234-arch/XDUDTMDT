// UC-ADM-03 – Cài đặt hệ thống: /admin/settings (chỉ role admin). Bảng: settings. Cài đặt công khai: GET /settings/public.
import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { SettingsService } from './settings.service';

@ApiTags('Admin – settings')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Cài đặt: { store, payments, shippingZones, general }' })
  get() {
    return this.settings.view();
  }

  // đặt TRƯỚC ":key" để "store" không bị hiểu là khóa đơn
  @Put('store')
  @ApiOperation({ summary: 'Lưu trang Cài đặt: { store?, payments?, shippingZones? }' })
  saveStore(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.settings.saveStore(adminId, body);
  }

  @Put(':key')
  @ApiOperation({
    summary:
      'Sửa một khóa: { value }. Khóa cho phép: site_name, contact_email, contact_phone, currency, default_shipping_fee, free_shipping_threshold, ar_enabled, maintenance_mode, store, payments, shippingZones',
  })
  saveKey(@CurrentUser('id') adminId: number, @Param('key') key: string, @Body() body: unknown) {
    return this.settings.saveKey(adminId, key, body);
  }
}
