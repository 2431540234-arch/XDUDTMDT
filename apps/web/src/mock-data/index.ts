// Điểm vào của mock-data: gom tất cả bảng. Component KHÔNG import file này – phải gọi API qua src/services.
export * from './tables/addresses';
export * from './tables/attributes';
export * from './tables/brands';
export * from './tables/categories';
export * from './tables/coupons';
export * from './tables/media';
export * from './tables/roles';
export * from './tables/role_permissions';
export * from './tables/user_roles';
export * from './tables/users';
export * from './tables/_products_gen';
export * from './tables/_spaces_gen';
export * from './tables/_orders_gen';
export * from './tables/_social_gen';
export * from './tables/_content_gen';
export { buildSeed, getDb, resetDb, saveDb, getConfig, setConfig } from './db';
