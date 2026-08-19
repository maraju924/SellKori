// Simulates how @vercel/node prepares the /var/task lambda tree:
// each .ts file is transpiled individually (ts.transpileModule with the
// project tsconfig, module: ESNext) and written under the SAME relative
// path but with a .js extension. Import specifiers are NOT rewritten.
// Then we boot api/index.js with plain Node ESM, exactly like the lambda.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = process.argv[2] || '/tmp/vercel-sim/task';

const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
  esModuleInterop: true,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  isolatedModules: true,
};

const sources = [
  'api/index.ts',
  'api/webhook.ts',
  'src/lib/featureFlags.ts',
  'src/lib/outreach.ts',
  'src/lib/orderIdentity.ts',
  'src/types.ts',
];

fs.rmSync(outDir, { recursive: true, force: true });
for (const rel of sources) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions,
    fileName: rel,
  });
  const outPath = path.join(outDir, rel.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outputText);
}

for (const staticFile of ['firebase-applet-config.json']) {
  fs.copyFileSync(path.join(root, staticFile), path.join(outDir, staticFile));
}
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'module' }));
fs.symlinkSync(path.join(root, 'node_modules'), path.join(outDir, 'node_modules'));

process.chdir(outDir);
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

try {
  const mod = await import(path.join(outDir, 'api/index.js'));
  console.log('BOOT_OK typeof default =', typeof mod.default);
  process.exit(0);
} catch (err) {
  console.error('BOOT_FAILED:', err.message);
  process.exit(1);
}
