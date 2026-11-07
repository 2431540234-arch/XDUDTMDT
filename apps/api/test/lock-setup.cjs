// Jest globalSetup (supertest trên aurelia_test): giữ khóa cho tới globalTeardown
const { acquire } = require('../../../scripts/test-lock.cjs');

module.exports = async () => {
  globalThis.__releaseTestLock = acquire('supertest (npm run test:e2e:db)');
};
