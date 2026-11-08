/**
 * E2E với MinIO THẬT (bật bằng: docker compose up -d minio minio-init; xem docs/HUONG_DAN_DEMO.md): presign → PUT → confirm.
 * Chạy: npm run test:e2e:minio. Tự bỏ qua (skip, không fail) khi MinIO không chạy. Dùng aurelia_test (cần node scripts/db-reset.mjs
 * aurelia_test trước) + Redis + bucket riêng aurelia-test-public / aurelia-test-private, nên KHÔNG đụng dữ liệu demo/dev.
 */
module.exports = {
  rootDir: '..',
  testRegex: 'test/.*[.]minio-spec[.]ts$',
  transform: {
    '^.+[.](ts|mjs|cjs|js)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json', diagnostics: false }],
  },
  transformIgnorePatterns: ['/node_modules/(?!(property-graph|@gltf-transform)/)'],
  moduleNameMapper: {
    '^@aurelia-living/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env-minio.ts'],
  globalSetup: '<rootDir>/test/global-setup-minio.cjs',
  globalTeardown: '<rootDir>/test/lock-teardown.cjs',
  testTimeout: 120000,
};
