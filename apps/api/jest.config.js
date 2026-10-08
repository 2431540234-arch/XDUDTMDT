/** Unit test: *.spec.ts cạnh code, không cần DB. */
module.exports = {
  rootDir: 'src',
  testRegex: '.*[.]spec[.]ts$',
  transform: { '^.+[.]ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json', diagnostics: true }] },
  moduleNameMapper: {
    '^@aurelia-living/shared-types$': '<rootDir>/../../../packages/shared-types/src/index.ts',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/../test/setup-env.ts'],
};
