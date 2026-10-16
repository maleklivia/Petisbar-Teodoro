import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStorefrontHours, storefrontAcceptance, storefrontHoursStatus } from '../src/services/storefront-hours.js';

const date = value => new Date(value);
const hours = 'Terça à Domingo - 18h até 23h';

test('interpreta o horário configurado e os dias da semana', () => {
  assert.deepEqual(parseStorefrontHours(hours), { days: [2, 3, 4, 5, 6, 0], opensAt: 1080, closesAt: 1380 });
  assert.equal(storefrontHoursStatus(hours, date('2026-10-13T21:00:00-03:00')).open, true); // terça 21h
  assert.equal(storefrontHoursStatus(hours, date('2026-10-18T21:00:00-03:00')).open, true); // domingo 21h
  assert.equal(storefrontHoursStatus(hours, date('2026-10-12T21:00:00-03:00')).open, false); // segunda
});

test('fecha antes de abrir e no minuto de encerramento', () => {
  assert.equal(storefrontHoursStatus(hours, date('2026-10-13T17:59:00-03:00')).open, false);
  assert.equal(storefrontHoursStatus(hours, date('2026-10-13T18:00:00-03:00')).open, true);
  assert.equal(storefrontHoursStatus(hours, date('2026-10-13T22:59:00-03:00')).open, true);
  assert.equal(storefrontHoursStatus(hours, date('2026-10-13T23:00:00-03:00')).open, false);
});

test('horários vazios, ambíguos ou inválidos fecham a loja', () => {
  for (const invalid of ['', 'Horários definidos no ERP', 'Terça à Domingo - 18h até 25h', 'Terça à Domingo - 23h até 18h']) {
    assert.equal(storefrontHoursStatus(invalid, date('2026-10-13T20:00:00-03:00')).open, false, invalid);
  }
});

test('o fechamento manual prevalece mesmo dentro do horário', () => {
  assert.deepEqual(storefrontAcceptance(false, hours, date('2026-10-13T20:00:00-03:00')), { open: false, reason: 'manually_closed' });
  assert.deepEqual(storefrontAcceptance(true, hours, date('2026-10-13T20:00:00-03:00')), { open: true, reason: null });
});
