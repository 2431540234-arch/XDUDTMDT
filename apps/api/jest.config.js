/** Unit test: *.spec.ts cạnh code, không cần DB. */
module.exports = {
  rootDir: 'src',
  testRegex: '.*[.]spec[.]ts$',
  transform: {
    '^.+[.]ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json', diagnostics: true }],
    // gói ESM của glTF-Transform (property-graph...) cần được biên dịch sang CJS
    '^.+[.](mjs|cjs|js)$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.jest.json', diagnostics: false }],
  },
  transformIgnorePatterns: ['/node_modules/(?!(property-graph|@gltf-transform)/)'],
  moduleNameMapper: {
    '^@aurelia-living/shared-types$': '<rootDir>/../../../packages/shared-types/src/index.ts',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/../test/setup-env.ts'],
};
