import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('../lib/pagination.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { fetchAllPages } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('reports retrieve all 1205 entries even if server caps pages below requested size', async () => {
  const entries = Array.from({ length: 1205 }, (_, id) => ({ id, durationMinutes: 30 }));
  const result = await fetchAllPages(async (from, to) => ({ data: entries.slice(from, Math.min(to + 1, from + 200)), error: null }));
  assert.deepEqual(result, entries);
  assert.equal(result.reduce((sum, e) => sum + e.durationMinutes, 0), 36150);
});

test('a failed later page rejects the report rather than returning incomplete totals', async () => {
  await assert.rejects(fetchAllPages(async from => from === 0
    ? { data: [{ id: 1 }], error: null }
    : { data: null, error: new Error('Network failed') }), /Network failed/);
});
