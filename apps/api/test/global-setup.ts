// Chạy một lần trước e2e: áp migration lên DB test.
import { execSync } from 'node:child_process';
import './setup-env';

export default function globalSetup() {
  execSync('npx prisma migrate deploy', {
    cwd: __dirname + '/..',
    stdio: 'inherit',
    env: process.env,
  });
}
