// ESLint dùng chung cho cả monorepo (TypeScript). Định dạng do Prettier lo; ESLint chỉ bắt lỗi logic.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: { node: true, es2022: true },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-empty-function': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    { files: ['*.d.ts'], rules: { '@typescript-eslint/no-unused-vars': 'off' } },
    {
      files: ['*.js', '*.cjs', '*.mjs'],
      rules: { '@typescript-eslint/no-var-requires': 'off', 'no-console': 'off' },
    },
    {
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'apps/api/prisma/seed.ts'],
      rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
    },
    { files: ['apps/api/src/main.ts'], rules: { 'no-console': 'off' } },
  ],
};
