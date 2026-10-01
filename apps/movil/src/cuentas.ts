/** Las cuentas de plata.
 *
 *  Vive aparte de React y de Expo a proposito: es lo unico de la app que no
 *  puede estar mal, asi que tiene que poder probarse sin un telefono ni un
 *  emulador. `src/pruebas.ts` lo corre con `npm run pruebas`. */

export const MONEDAS = ['EUR', 'ARS', 'USD'] as const;

export interface ParteDeGasto { usuarioId: string; monto: number }

export interface GastoParaCuentas {
  pagadoPor: string;
  /** Centavos, entero. */
  monto: number;
  moneda: string;
  partes: ParteDeGasto[];
  borradoEn?: string | null;
}

export interface NetoPorMoneda {
  moneda: string;
  /** Positivo: a esta persona le deben. */
  neto: number;
  puso: number;
  leToca: number;
}

/** Centavos a texto. Se formatea acá y no en cada pantalla para que un cambio
 *  de criterio no haya que buscarlo en cinco lugares. */
export function plata(centavos: number, moneda: string): string {
  const signo = moneda === 'EUR' ? '€' : moneda === 'USD' ? 'US$' : '$';
  const n = Math.abs(centavos) / 100;
  return `${signo} ${n.toLocaleString('es-AR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

/** Texto tipeado a centavos enteros.
 *
 *  Nunca se guarda un decimal: `0.1 + 0.2` en punto flotante da
 *  `0.30000000000004`, y el unico trabajo de esta app es decir cuanto debe cada
 *  uno.
 *
 *  La parte dificil es que el punto significa dos cosas distintas. Acá "1.250"
 *  son mil doscientos cincuenta, pero "23.50" son veintitres con cincuenta, y
 *  el teclado de Android da punto o coma segun el idioma del telefono. Reglas,
 *  en orden:
 *
 *    1. Si hay coma, la coma es el decimal y los puntos son miles.
 *    2. Si hay mas de un punto, todos son miles.
 *    3. Con un solo punto, decide cuantos digitos lo siguen: tres son miles
 *       ("1.250"), cualquier otra cantidad es decimal ("23.50", "1.5").
 *
 *  Se equivoca con quien escriba "1.500" queriendo decir un peso con medio,
 *  que no le pasa a nadie. Antes se equivocaba con "23.50" y cargaba un gasto
 *  cien veces mas grande, que le pasa a cualquiera. */
export function aCentavos(texto: string): number | null {
  const crudo = texto.trim();
  if (crudo === '') return null;

  let normal: string;
  if (crudo.includes(',')) {
    normal = crudo.replace(/\./g, '').replace(',', '.');
  } else {
    const partes = crudo.split('.');
    normal = partes.length === 2 && partes[1]!.length !== 3
      ? crudo
      : crudo.replace(/\./g, '');
  }

  const n = Number.parseFloat(normal);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** Como se parte un gasto entre dos.
 *
 *  `pctQuienPaga` es que porcentaje del gasto le corresponde a quien lo pago.
 *  50 es mitad y mitad; 100 es "esto es solo mio".
 *
 *  La parte del otro se calcula redondeando para abajo y la de quien paga es
 *  **lo que sobra**, nunca un segundo redondeo. Dos motivos:
 *
 *  - Garantiza que las partes sumen exactamente el total. Redondeando los dos
 *    lados por separado, un gasto de 0,01 terminaria con partes que suman 0,02:
 *    plata inventada.
 *  - El centavo de mas se lo come quien ya puso la plata, que es lo justo. */
export function repartir(
  total: number, quienPaga: string, elOtro: string | null, pctQuienPaga = 50,
): ParteDeGasto[] {
  if (!elOtro) return [{ usuarioId: quienPaga, monto: total }];

  const pct = Math.min(100, Math.max(0, pctQuienPaga));
  const delOtro = Math.floor((total * (100 - pct)) / 100);
  return [
    { usuarioId: elOtro, monto: delOtro },
    { usuarioId: quienPaga, monto: total - delOtro },
  ];
}

/** Quien debe cuanto, por moneda y por separado.
 *
 *  Un euro y un peso no se suman: el saldo correcto es "te debe 47,50 EUR y
 *  12.300 ARS". Convertir a una sola moneda seria mas comodo y obligaria a
 *  elegir un tipo de cambio que va a estar mal para alguno de los dos.
 *
 *      puso      lo que pago de su bolsillo
 *    - le toca   su parte de todo lo que se gasto
 *    = neto      positivo: le deben. negativo: debe.
 */
export function calcularSaldo(
  gastos: GastoParaCuentas[], usuarioId: string,
): NetoPorMoneda[] {
  const puso = new Map<string, number>();
  const leToca = new Map<string, number>();
  const monedas = new Set<string>();

  for (const g of gastos) {
    if (g.borradoEn) continue;
    monedas.add(g.moneda);
    if (g.pagadoPor === usuarioId) {
      puso.set(g.moneda, (puso.get(g.moneda) ?? 0) + g.monto);
    }
    for (const p of g.partes) {
      if (p.usuarioId !== usuarioId) continue;
      leToca.set(g.moneda, (leToca.get(g.moneda) ?? 0) + p.monto);
    }
  }

  return [...monedas]
    .map((m) => {
      const p = puso.get(m) ?? 0;
      const t = leToca.get(m) ?? 0;
      return { moneda: m, puso: p, leToca: t, neto: p - t };
    })
    .sort((a, b) => a.moneda.localeCompare(b.moneda));
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
               'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Una fecha `AAAA-MM-DD` dicha como la diria una persona.
 *
 *  "hoy" y "ayer" en vez del numero porque es lo que se mira: en un viaje de
 *  dos semanas, lo que importa de un gasto es si fue recien o hace unos dias,
 *  no la fecha exacta. Mas atras si va el dia y el mes.
 *
 *  `hoyISO` se pasa en vez de leer el reloj adentro para que se pueda probar. */
export function cuando(fecha: string, hoyISO: string): string {
  const dia = (s: string) => Date.parse(`${s}T00:00:00Z`);
  const diff = Math.round((dia(hoyISO) - dia(fecha)) / 86_400_000);

  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';

  const partes = fecha.split('-');
  const mes = MESES[Number(partes[1]) - 1];
  if (!mes) return fecha;
  return `${Number(partes[2])} ${mes}`;
}
