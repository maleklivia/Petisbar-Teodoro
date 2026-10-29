import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('Caddy permite a consulta de CEP ao ViaCEP sem abrir connect-src para outros domínios', () => {
  for (const file of ['ops/Caddyfile', 'ops/Caddyfile.vps']) {
    const config = readFileSync(resolve(root, file), 'utf8');
    assert.match(config, /connect-src 'self' https:\/\/viacep\.com\.br;/, file);
    assert.doesNotMatch(config, /connect-src[^\n]*\*/i, file);
  }
});
