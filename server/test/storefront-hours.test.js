import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyHoursText,storefrontAcceptance,storefrontHoursStatus} from '../src/services/storefront-hours.js';

test('horário legado, agenda semanal e fechamento manual compartilham o mesmo predicado',()=>{
  const hours='Terça à Domingo - 15h até 23h';
  const week=weeklyHoursText(hours);
  assert.equal(week.segunda,'Fechado');
  assert.equal(week.terca,'15:00 – 23:00');
  const now=new Date('2026-10-22T19:00:00Z');
  assert.equal(storefrontAcceptance(true,hours,now).open,true);
  assert.equal(storefrontAcceptance(true,week,now).open,true);
  assert.equal(storefrontAcceptance(false,week,now).reason,'manually_closed');
  assert.equal(storefrontHoursStatus(week,new Date('2026-10-22T02:00:00Z')).open,false);
});
test('turno noturno atravessa a meia-noite sem abrir todo o dia seguinte',()=>{
  const week=weeklyHoursText('Sexta - 18h até 02h');
  assert.equal(storefrontHoursStatus(week,new Date('2026-10-24T04:00:00Z')).open,true);
  assert.equal(storefrontHoursStatus(week,new Date('2026-10-24T17:00:00Z')).open,false);
  assert.equal(storefrontHoursStatus(week,new Date('2026-10-24T05:00:00Z')).open,false);
  assert.equal(storefrontHoursStatus('horário inválido').reason,'invalid_hours');
  assert.equal(weeklyHoursText({...week,sexta:'25h – 27h'}),null);
});
