#!/usr/bin/env node
// Sinh enum và entity cho packages/shared-types từ apps/api/prisma/schema.prisma.
//   node scripts/generate-shared-types.mjs          ghi file
//   node scripts/generate-shared-types.mjs --check  chỉ kiểm tra file đã đồng bộ chưa (dùng ở CI)
// Không phụ thuộc Prisma Client nên frontend dùng được mà không kéo Prisma vào bundle.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = resolve(root, 'apps/api/prisma/schema.prisma');
const outDir = resolve(root, 'packages/shared-types/src');
const check = process.argv.includes('--check');

// Trường nhạy cảm KHÔNG được đưa vào kiểu dùng chung (không bao giờ trả ra API)
const SENSITIVE = {
  User: ['passwordHash'],
  UserSession: ['refreshTokenHash'],
  PasswordReset: ['tokenHash'],
};

const HEADER = `// FILE SINH TỰ ĐỘNG từ apps/api/prisma/schema.prisma bằng scripts/generate-shared-types.mjs
// KHÔNG SỬA TAY. Sửa schema.prisma rồi chạy: npm run types:generate
`;

const text = readFileSync(schemaPath, 'utf8');

// ---- enum ----
const enums = [];
for (const m of text.matchAll(/^enum (\w+) \{\n([\s\S]*?)^\}/gm)) {
  const values = m[2]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('@@') && !l.startsWith('//'));
  enums.push({ name: m[1], values });
}
const enumNames = new Set(enums.map((e) => e.name));

// ---- model ----
const models = [];
for (const m of text.matchAll(/^model (\w+) \{\n([\s\S]*?)^\}/gm)) {
  const name = m[1];
  const modelNames = [...text.matchAll(/^model (\w+) \{/gm)].map((x) => x[1]);
  const fields = [];
  for (const raw of m[2].split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('@@') || l.startsWith('//')) continue;
    const fm = l.match(/^(\w+)\s+(\w+)(\[\]|\?)?\s*(.*)$/);
    if (!fm) continue;
    const [, fname, ftype, mod] = fm;
    if (modelNames.includes(ftype)) continue; // bỏ quan hệ
    if ((SENSITIVE[name] ?? []).includes(fname)) continue;
    fields.push({ name: fname, type: ftype, optional: mod === '?' });
  }
  models.push({ name, fields });
}

const SCALAR = {
  String: 'string',
  Int: 'number',
  Boolean: 'boolean',
  DateTime: 'string', // ISO 8601 UTC khi qua JSON
  Decimal: 'number', // API trả number (serialize), tiền là số nguyên VND
  Float: 'number',
  BigInt: 'string',
  Json: 'JsonValue',
};

const enumsOut =
  HEADER +
  '\n' +
  enums
    .map(
      (e) =>
        `export const ${e.name} = {\n${e.values.map((v) => `  ${v}: '${v}',`).join('\n')}\n} as const;\n` +
        `export type ${e.name} = (typeof ${e.name})[keyof typeof ${e.name}];\n`,
    )
    .join('\n');

const usedEnums = new Set();
const body = models
  .map((mo) => {
    const lines = mo.fields.map((f) => {
      let t = SCALAR[f.type];
      if (!t) {
        if (!enumNames.has(f.type)) throw new Error(`Kiểu lạ ${mo.name}.${f.name}: ${f.type}`);
        t = f.type;
        usedEnums.add(f.type);
      }
      return `  ${f.name}: ${t}${f.optional ? ' | null' : ''};`;
    });
    return `export interface ${mo.name} {\n${lines.join('\n')}\n}\n`;
  })
  .join('\n');

const entitiesOut =
  HEADER +
  `\nimport type { ${[...usedEnums].sort().join(', ')} } from './enums.generated';\n\n` +
  `export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };\n\n` +
  body;

const targets = [
  [resolve(outDir, 'enums.generated.ts'), enumsOut],
  [resolve(outDir, 'entities.generated.ts'), entitiesOut],
];

let drift = false;
for (const [file, content] of targets) {
  // So sánh không phân biệt kiểu xuống dòng (Windows có thể chuyển LF thành CRLF khi checkout)
  const current = existsSync(file) ? readFileSync(file, 'utf8').split('\r\n').join('\n') : '';
  if (current !== content) {
    drift = true;
    if (!check) writeFileSync(file, content);
  }
}
if (check && drift) {
  console.error('shared-types chưa đồng bộ với schema.prisma. Chạy: npm run types:generate');
  process.exit(1);
}
console.log(
  `${check ? 'Đã đồng bộ' : drift ? 'Đã ghi' : 'Không thay đổi'}: ${enums.length} enum, ${models.length} entity`,
);
