/** E2E test: gọi HTTP thật vào app Nest + DB test riêng (docker compose --profile test up -d postgres-test). */
module.exports = {
  rootDir: '..',
  testRegex: 'test/.*[.]e2e-spec[.]ts$',
  transform: { '^.+[.]ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: true }] },
  moduleNameMapper: {
    '^@aurelia-living/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  testTimeout: 30000,
};
