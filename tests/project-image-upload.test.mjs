import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../lib/project-image-upload.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
const { prepareProjectImageUpload } = await import(moduleUrl);

function imageFile({ type = 'image/jpeg', size = 3, bytes = [1, 2, 3], fails = false } = {}) {
  return {
    type,
    size,
    arrayBuffer: async () => {
      if (fails) throw new Error('file handle lost');
      return Uint8Array.from(bytes).buffer;
    },
  };
}

test('project image upload snapshots non-empty bytes before sending them to storage', async () => {
  const prepared = await prepareProjectImageUpload(imageFile());
  assert.equal(prepared.contentType, 'image/jpeg');
  assert.equal(prepared.extension, 'jpg');
  assert.deepEqual([...new Uint8Array(prepared.body)], [1, 2, 3]);
});

test('project image upload rejects empty or unreadable browser files with a useful message', async () => {
  await assert.rejects(prepareProjectImageUpload(imageFile({ size: 0, bytes: [] })), /Bilddatei ist leer/);
  await assert.rejects(prepareProjectImageUpload(imageFile({ size: 3, bytes: [] })), /keine lesbaren Daten/);
  await assert.rejects(prepareProjectImageUpload(imageFile({ fails: true })), /konnte nicht gelesen werden/);
});
