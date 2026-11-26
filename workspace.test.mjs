import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('./workspace.js', import.meta.url), 'utf8');
const workspace = runInNewContext(script + '\nWorkspaceStorage');

test('reloads a saved topology and an intentionally cleared workspace', () => {
    const entries = new Map();
    const storage = { setItem: (key, value) => entries.set(key, value), getItem: key => entries.get(key) ?? null };
    const saved = { devices: [{ id: 'dev_1', typeStr: 'pc', x: 0, y: 1, interfaces: [] }], links: [] };
    assert.equal(workspace.load(storage), null);
    workspace.save(storage, JSON.stringify(saved));
    assert.equal(JSON.stringify(workspace.load(storage)), JSON.stringify(saved));
    const cleared = { devices: [], links: [], zones: [] };
    workspace.save(storage, JSON.stringify(cleared));
    assert.equal(JSON.stringify(workspace.load(storage)), JSON.stringify(cleared));
});

test('rejects invalid JSON, unknown devices and dangling links before restoration', () => {
    for (const saved of ['{', '{"devices":[]}', '{"devices":[{"typeStr":"unknown"}],"links":[]}',
        '{"devices":[],"links":[{"sourceId":"dev_1","targetId":"dev_2"}]}']) {
        assert.throws(() => workspace.load({ getItem: () => saved }));
    }
});
