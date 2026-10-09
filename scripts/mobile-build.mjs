#!/usr/bin/env node
// Build app Android bằng Gradle wrapper, chạy được trên Windows (cmd, PowerShell) và Linux/macOS/CI.
//   node scripts/mobile-build.mjs                 -> assembleDebug
//   node scripts/mobile-build.mjs testDebugUnitTest --console=plain   (tham số truyền thẳng cho Gradle)
// Cần JDK 21 (JAVA_HOME) và Android SDK (ANDROID_HOME hoặc apps/mobile/local.properties). Xem README mục 6b.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'mobile');
const isWindows = process.platform === 'win32';
const wrapper = resolve(mobileDir, isWindows ? 'gradlew.bat' : 'gradlew');

if (!existsSync(wrapper)) {
  console.error(`[mobile:build] Không thấy ${wrapper}`);
  process.exit(1);
}

const env = { ...process.env };
// Windows: nếu chưa đặt JAVA_HOME, dùng JDK đi kèm Android Studio (JBR 21) khi có
if (isWindows && !env.JAVA_HOME) {
  const jbr = resolve(env.ProgramFiles ?? 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
  if (existsSync(resolve(jbr, 'bin', 'java.exe'))) {
    env.JAVA_HOME = jbr;
    console.log(`[mobile:build] JAVA_HOME chưa đặt, dùng ${jbr}`);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) args.push('assembleDebug');

// .bat phải chạy qua shell trên Windows; trên Linux gọi thẳng tệp thực thi
const child = isWindows
  ? spawn(`"${wrapper}"`, args, { cwd: mobileDir, env, stdio: 'inherit', shell: true })
  : spawn(wrapper, args, { cwd: mobileDir, env, stdio: 'inherit' });

child.on('error', (e) => {
  console.error(`[mobile:build] Không chạy được Gradle wrapper: ${e.message}`);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
