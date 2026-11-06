// M08 – Yêu thích: /wishlist (chỉ của chính khách)
import { Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { WishlistService } from './wishlist.service';

@ApiTags('wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser('id') uid: number) {
    return this.wishlist.list(uid);
  }

  @Put(':slug')
  add(@CurrentUser('id') uid: number, @Param('slug') slug: string) {
    return this.wishlist.add(uid, slug);
  }

  @Delete(':slug')
  remove(@CurrentUser('id') uid: number, @Param('slug') slug: string) {
    return this.wishlist.remove(uid, slug);
  }
}
