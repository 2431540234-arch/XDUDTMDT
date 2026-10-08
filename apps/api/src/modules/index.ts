// Danh sách module nghiệp vụ (M01–M14). Ánh xạ: docs/MODULE_ENV_REPORT.md mục 3.
// Module ai, ar-overlay: NGOÀI phạm vi đồ án. Module jobs: không dùng trong phạm vi đồ án (docs/DECISIONS.md).
import { SettingsModule } from './settings/settings.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AdminRolesModule } from './admin-roles/admin-roles.module';
import { MediaModule } from './media/media.module';
import { CategoriesModule } from './categories/categories.module';
import { BrandsModule } from './brands/brands.module';
import { AttributesModule } from './attributes/attributes.module';
import { PagesModule } from './pages/pages.module';
import { ProductsModule } from './products/products.module';
import { VariantsModule } from './variants/variants.module';
import { ProductImagesModule } from './product-images/product-images.module';
import { InventoryModule } from './inventory/inventory.module';
import { CartModule } from './cart/cart.module';
import { CouponsModule } from './coupons/coupons.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ProductModelsModule } from './product-models/product-models.module';
import { ArSnapshotsModule } from './ar-snapshots/ar-snapshots.module';
import { ArSessionsModule } from './ar-sessions/ar-sessions.module';
import { SpacesModule } from './spaces/spaces.module';
import { PanoramasModule } from './panoramas/panoramas.module';
import { HotspotsModule } from './hotspots/hotspots.module';
import { AdminNotificationsModule } from './admin-notifications/admin-notifications.module';
import { AdminStatsModule } from './admin-stats/admin-stats.module';

export const FEATURE_MODULES = [
  SettingsModule,
  ActivityLogsModule,
  AuthModule,
  UsersModule,
  AddressesModule,
  WishlistModule,
  NotificationsModule,
  AdminUsersModule,
  AdminRolesModule,
  MediaModule,
  CategoriesModule,
  BrandsModule,
  AttributesModule,
  PagesModule,
  ProductsModule,
  VariantsModule,
  ProductImagesModule,
  InventoryModule,
  CartModule,
  CouponsModule,
  OrdersModule,
  PaymentsModule,
  ShipmentsModule,
  ReviewsModule,
  ProductModelsModule,
  ArSnapshotsModule,
  ArSessionsModule,
  SpacesModule,
  PanoramasModule,
  HotspotsModule,
  AdminNotificationsModule,
  AdminStatsModule,
];
