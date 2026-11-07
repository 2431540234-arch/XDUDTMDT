/** E2E "DB thật": gọi HTTP vào app Nest + Postgres aurelia_test (đã seed mock). Chạy: node scripts/db-reset.mjs aurelia_test && npm run test:e2e:db */
module.exports = {
  rootDir: '..',
  testRegex: 'test/.*[.]db-spec[.]ts$',
  transform: {
    '^.+[.](ts|mjs|cjs|js)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json', diagnostics: false }],
  },
  transformIgnorePatterns: ['/node_modules/(?!(property-graph|@gltf-transform)/)'],
  moduleNameMapper: {
    '^@aurelia-living/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env-db.ts'],
  // khóa chặn chạy hai bộ test cùng lúc trên aurelia_test (xem scripts/test-lock.cjs)
  globalSetup: '<rootDir>/test/lock-setup.cjs',
  globalTeardown: '<rootDir>/test/lock-teardown.cjs',
  testTimeout: 120000,
};
