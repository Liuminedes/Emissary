import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWaVersion, versionText } from './waVersion.js';

const FALLBACK = [2, 3000, 1];
const ok = (n) => async () => ({ version: [2, 3000, n], isLatest: true });
const stale = async () => ({ version: [2, 3000, 5], isLatest: false, error: { message: 'sin red' } });
const boom = async () => { throw new Error('timeout'); };

test('usa WhatsApp Web si responde', async () => {
  assert.deepEqual(await resolveWaVersion({ fetchWeb: ok(100), fetchGithub: ok(90), fallback: FALLBACK }), { version: [2, 3000, 100], source: 'whatsapp-web' });
});

test('si WhatsApp Web falla (aunque no lance error), prueba GitHub', async () => {
  assert.equal((await resolveWaVersion({ fetchWeb: stale, fetchGithub: ok(90), fallback: FALLBACK })).source, 'github');
  assert.equal((await resolveWaVersion({ fetchWeb: boom, fetchGithub: ok(90), fallback: FALLBACK })).source, 'github');
});

test('si ninguna fuente responde, usa el respaldo y lo dice', async () => {
  assert.deepEqual(await resolveWaVersion({ fetchWeb: stale, fetchGithub: boom, fallback: FALLBACK }), { version: FALLBACK, source: 'respaldo' });
});

test('descarta respuestas con una versión mal formada', async () => {
  const mala = async () => ({ version: ['x'], isLatest: true });
  assert.equal((await resolveWaVersion({ fetchWeb: mala, fetchGithub: mala, fallback: FALLBACK })).source, 'respaldo');
});

test('versionText', () => assert.equal(versionText([2, 3000, 1053070940]), '2.3000.1053070940'));
