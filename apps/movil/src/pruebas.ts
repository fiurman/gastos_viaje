/** Las cuentas de plata, contra casos a mano.
 *
 *  Corre con `npm run pruebas`, sin telefono ni emulador. Si algo de
 *  `cuentas.ts` cambia, esto tiene que seguir en verde antes de tocar nada
 *  mas: es el unico archivo donde un error se traduce en plata mal repartida. */

import {
  aCentavos, calcularSaldo, correrMes, cuando, fechaValida, limpiarDescripcion,
  MONTO_MAXIMO, nombreDelMes, plata, repartir, semanasDelMes, sumarPor,
} from './cuentas.ts';

let pasaron = 0;
let fallaron = 0;

function es(titulo: string, dio: unknown, esperado: unknown): void {
  const a = JSON.stringify(dio);
  const b = JSON.stringify(esperado);
  if (a === b) {
    pasaron++;
    console.log(`  ✔ ${titulo}`);
  } else {
    fallaron++;
    console.log(`  ✘ ${titulo}\n      dio:      ${a}\n      esperado: ${b}`);
  }
}

function grupo(titulo: string): void {
  console.log(`\n-- ${titulo} --`);
}

const YO = 'yo';
const OTRO = 'otro';

grupo('lo que se tipea se convierte a centavos enteros');
es('entero', aCentavos('40'), 4000);
es('con coma', aCentavos('23,50'), 2350);
es('con punto decimal, que tambien se escribe asi', aCentavos('23.50'), 2350);
es('con separador de miles', aCentavos('1.250,50'), 125050);
es('mil doscientos cincuenta, con punto de miles', aCentavos('1.250'), 125000);
es('mil, con punto de miles', aCentavos('1.000'), 100000);
es('dos puntos, los dos de miles', aCentavos('1.250.500'), 125050000);
es('un decimal solo', aCentavos('1.5'), 150);
es('un centavo', aCentavos('0,01'), 1);
es('con espacios', aCentavos('  12,30  '), 1230);
es('tres decimales se redondean', aCentavos('10,005'), 1001);
es('cero no es un gasto', aCentavos('0'), null);
es('negativo no es un gasto', aCentavos('-5'), null);
es('vacio', aCentavos(''), null);
es('texto', aCentavos('pizza'), null);
es('infinito', aCentavos('1e400'), null);
es('el maximo entra', aCentavos('10000000'), MONTO_MAXIMO);
es('pasarse del maximo no', aCentavos('10000001'), null);
es('un numero absurdo no', aCentavos('999999999999'), null);
es('solo simbolos', aCentavos(',,,'), null);
es('solo un punto', aCentavos('.'), null);

grupo('fechas que existen de verdad');
es('una normal', fechaValida('2026-10-11'), true);
es('29 de febrero bisiesto', fechaValida('2024-02-29'), true);
es('29 de febrero comun', fechaValida('2026-02-29'), false);
es('31 de febrero', fechaValida('2026-02-31'), false);
es('mes 13', fechaValida('2026-13-01'), false);
es('dia 0', fechaValida('2026-10-00'), false);
es('sin ceros adelante', fechaValida('2026-1-1'), false);
es('vacio', fechaValida(''), false);
es('cualquier cosa', fechaValida('manana'), false);

grupo('descripciones');
es('saca espacios de mas', limpiarDescripcion('  Pizza   grande  '), 'Pizza grande');
es('saca saltos de linea', limpiarDescripcion('Pizza\n\ngrande'), 'Pizza grande');
es('recorta lo muy largo', limpiarDescripcion('x'.repeat(200)).length, 80);
es('vacio queda vacio', limpiarDescripcion('   '), '');

grupo('el que paga se come el centavo que sobra');
es('par', repartir(4000, YO, OTRO), [
  { usuarioId: OTRO, monto: 2000 }, { usuarioId: YO, monto: 2000 },
]);
es('impar: el otro paga de menos', repartir(2351, YO, OTRO), [
  { usuarioId: OTRO, monto: 1175 }, { usuarioId: YO, monto: 1176 },
]);
es('un centavo', repartir(1, YO, OTRO), [
  { usuarioId: OTRO, monto: 0 }, { usuarioId: YO, monto: 1 },
]);
es('solo', repartir(4000, YO, null), [{ usuarioId: YO, monto: 4000 }]);

grupo('repartos que no son mitad y mitad');
es('70 para el que paga', repartir(10000, YO, OTRO, 70), [
  { usuarioId: OTRO, monto: 3000 }, { usuarioId: YO, monto: 7000 },
]);
es('30 para el que paga', repartir(10000, YO, OTRO, 30), [
  { usuarioId: OTRO, monto: 7000 }, { usuarioId: YO, monto: 3000 },
]);
es('100: es todo de quien lo pago', repartir(10000, YO, OTRO, 100), [
  { usuarioId: OTRO, monto: 0 }, { usuarioId: YO, monto: 10000 },
]);
es('0: no le toca nada a quien pago', repartir(10000, YO, OTRO, 0), [
  { usuarioId: OTRO, monto: 10000 }, { usuarioId: YO, monto: 0 },
]);
es('un tercio de un monto que no divide justo', repartir(1000, YO, OTRO, 33), [
  { usuarioId: OTRO, monto: 670 }, { usuarioId: YO, monto: 330 },
]);
es('un porcentaje fuera de rango se acota', repartir(1000, YO, OTRO, 150), [
  { usuarioId: OTRO, monto: 0 }, { usuarioId: YO, monto: 1000 },
]);

{
  // La misma propiedad de antes, ahora con todos los porcentajes.
  let mal = 0;
  for (let pct = 0; pct <= 100; pct++) {
    for (let total = 1; total <= 400; total++) {
      const partes = repartir(total, YO, OTRO, pct);
      const suma = partes.reduce((s, x) => s + x.monto, 0);
      if (suma !== total) mal++;
      if (partes.some((x) => x.monto < 0)) mal++;
    }
  }
  es('con cualquier porcentaje, las partes suman el total y ninguna es negativa', mal, 0);
}

{
  // La propiedad que tiene que valer siempre: las partes suman el total. Si no,
  // hay plata inventada o desaparecida.
  let mal = 0;
  for (let total = 1; total <= 2000; total++) {
    const suma = repartir(total, YO, OTRO).reduce((s, p) => s + p.monto, 0);
    if (suma !== total) mal++;
  }
  es('las partes suman el total, probado de 1 a 2000 centavos', mal, 0);
}

grupo('el saldo');
const gastos = [
  // Pizza de 40, la pago yo, mitad y mitad.
  { pagadoPor: YO, monto: 4000, moneda: 'EUR',
    partes: [{ usuarioId: YO, monto: 2000 }, { usuarioId: OTRO, monto: 2000 }] },
  // Museo de 30, lo pago el otro, mitad y mitad.
  { pagadoPor: OTRO, monto: 3000, moneda: 'EUR',
    partes: [{ usuarioId: YO, monto: 1500 }, { usuarioId: OTRO, monto: 1500 }] },
];
es('puse 40, me toca 35, me deben 5', calcularSaldo(gastos, YO),
  [{ moneda: 'EUR', puso: 4000, leToca: 3500, neto: 500 }]);
es('el otro puso 30, le toca 35, debe 5', calcularSaldo(gastos, OTRO),
  [{ moneda: 'EUR', puso: 3000, leToca: 3500, neto: -500 }]);

{
  const mio = calcularSaldo(gastos, YO)[0]!.neto;
  const suyo = calcularSaldo(gastos, OTRO)[0]!.neto;
  es('los dos netos suman cero, no hay plata inventada', mio + suyo, 0);
}

grupo('las monedas no se mezclan');
const mezcla = [
  { pagadoPor: YO, monto: 4000, moneda: 'EUR',
    partes: [{ usuarioId: YO, monto: 2000 }, { usuarioId: OTRO, monto: 2000 }] },
  { pagadoPor: YO, monto: 1000000, moneda: 'ARS',
    partes: [{ usuarioId: YO, monto: 500000 }, { usuarioId: OTRO, monto: 500000 }] },
];
es('dos monedas, dos lineas', calcularSaldo(mezcla, YO), [
  { moneda: 'ARS', puso: 1000000, leToca: 500000, neto: 500000 },
  { moneda: 'EUR', puso: 4000, leToca: 2000, neto: 2000 },
]);

grupo('casos que pasan de verdad');
es('un gasto que no se divide no mueve el saldo de nadie',
  calcularSaldo([
    { pagadoPor: YO, monto: 2500, moneda: 'EUR', partes: [{ usuarioId: YO, monto: 2500 }] },
  ], YO),
  [{ moneda: 'EUR', puso: 2500, leToca: 2500, neto: 0 }]);

es('el que no pago nada debe su parte entera',
  calcularSaldo([
    { pagadoPor: YO, monto: 2500, moneda: 'EUR',
      partes: [{ usuarioId: YO, monto: 1250 }, { usuarioId: OTRO, monto: 1250 }] },
  ], OTRO),
  [{ moneda: 'EUR', puso: 0, leToca: 1250, neto: -1250 }]);

es('un gasto borrado no cuenta',
  calcularSaldo([
    { pagadoPor: YO, monto: 4000, moneda: 'EUR', borradoEn: '2026-10-11T10:00:00Z',
      partes: [{ usuarioId: YO, monto: 2000 }, { usuarioId: OTRO, monto: 2000 }] },
  ], YO),
  []);

es('sin gastos no hay saldo', calcularSaldo([], YO), []);

{
  // Muchos gastos impares: el caso donde un redondeo mal hecho se acumula.
  const muchos = [];
  for (let i = 0; i < 500; i++) {
    const total = 101 + i * 3;
    muchos.push({
      pagadoPor: i % 2 === 0 ? YO : OTRO, monto: total, moneda: 'EUR',
      partes: repartir(total, i % 2 === 0 ? YO : OTRO, i % 2 === 0 ? OTRO : YO),
    });
  }
  const a = calcularSaldo(muchos, YO)[0]!.neto;
  const b = calcularSaldo(muchos, OTRO)[0]!.neto;
  es('500 gastos impares y los netos siguen sumando cero', a + b, 0);
}

grupo('como se muestra');
es('euros', plata(2350, 'EUR'), '€ 23,50');
es('pesos', plata(125050, 'ARS'), '$ 1.250,50');
es('dolares', plata(100, 'USD'), 'US$ 1,00');
es('negativo se muestra sin signo, el signo lo pone la pantalla',
  plata(-500, 'EUR'), '€ 5,00');

grupo('como se dice una fecha');
es('mismo dia', cuando('2026-10-11', '2026-10-11'), 'hoy');
es('el dia anterior', cuando('2026-10-10', '2026-10-11'), 'ayer');
es('hace unos dias', cuando('2026-10-05', '2026-10-11'), '5 oct');
es('cruzando el mes', cuando('2026-09-30', '2026-10-01'), 'ayer');
es('cruzando el año', cuando('2025-12-31', '2026-01-01'), 'ayer');
es('el año pasado', cuando('2025-12-25', '2026-01-10'), '25 dic');
es('sin cero adelante', cuando('2026-10-03', '2026-10-20'), '3 oct');
es('una fecha rota se muestra tal cual', cuando('cualquiera', '2026-10-11'), 'cualquiera');

grupo('el calendario');
{
  const oct = semanasDelMes('2026-10');
  // Octubre de 2026 arranca jueves.
  es('la primera semana tiene 3 huecos adelante',
    oct[0]!.slice(0, 4), [null, null, null, '2026-10-01']);
  es('todas las semanas tienen 7 dias',
    oct.every((s) => s.length === 7), true);
  es('estan los 31 dias',
    oct.flat().filter(Boolean).length, 31);
  es('el ultimo es el 31', oct.flat().filter(Boolean).at(-1), '2026-10-31');
}
{
  // Febrero bisiesto: el caso donde un calendario hecho a mano se rompe.
  const feb = semanasDelMes('2024-02');
  es('febrero de un bisiesto tiene 29', feb.flat().filter(Boolean).length, 29);
  es('febrero de uno comun tiene 28',
    semanasDelMes('2026-02').flat().filter(Boolean).length, 28);
}
{
  // Un mes que arranca lunes no lleva huecos adelante.
  const jun = semanasDelMes('2026-06');
  es('sin huecos si arranca lunes', jun[0]![0], '2026-06-01');
}
es('mes invalido no rompe', semanasDelMes('cualquiera'), []);

es('mes siguiente', correrMes('2026-10', 1), '2026-11');
es('mes anterior', correrMes('2026-10', -1), '2026-09');
es('cruzando el año para adelante', correrMes('2026-12', 1), '2027-01');
es('cruzando el año para atras', correrMes('2026-01', -1), '2025-12');
es('nombre del mes', nombreDelMes('2026-10'), 'octubre 2026');

grupo('sumar por');
{
  const gastos = [
    { quien: 'a', monto: 100 }, { quien: 'b', monto: 300 }, { quien: 'a', monto: 50 },
  ];
  es('agrupa y ordena de mayor a menor',
    sumarPor(gastos, (g) => g.quien, (g) => g.monto),
    [{ clave: 'b', total: 300 }, { clave: 'a', total: 150 }]);
  es('sin nada da vacio', sumarPor([], () => 'x', () => 1), []);
}

console.log(`\n  ${pasaron} pasaron, ${fallaron} fallaron\n`);
if (fallaron > 0) process.exitCode = 1;
