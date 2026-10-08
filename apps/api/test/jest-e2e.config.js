/** E2E test: gọi HTTP thật vào app Nest + DB test riêng + MinIO/Redis thật (docker compose up -d redis minio minio-init). */
module.exports = {
  rootDir: '..',
  testRegex: 'test/.*[.]e2e-spec[.]ts$',
  // glTF-Transform và property-graph (ESM, có import() động) phải được ts-jest dịch sang CommonJS
  transform: {
    '^.+[.](ts|mjs|cjs|js)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json', diagnostics: false }],
  },
  transformIgnorePatterns: ['/node_modules/(?!(property-graph|@gltf-transform)/)'],
  moduleNameMapper: {
    '^@aurelia-living/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  testTimeout: 60000,
};
