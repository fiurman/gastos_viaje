/** El viaje día por día.
 *
 *  Un calendario y no una lista porque en un viaje la pregunta no es "cuánto
 *  gastamos" sino "qué hicimos el jueves". La grilla deja ver de un vistazo los
 *  dias caros, los baratos y los que no se gasto nada, que en un viaje de dos
 *  semanas es una forma de acordarse de lo que se hizo. */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  correrMes, cuando, nombreDelMes, plata, semanasDelMes, type Gasto,
} from '../datos';
import { CLARA, OSCURA, SERIF, SERIF_MEDIA, useTema, type Paleta } from '../tema';

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function Calendario({
  gastos, yo, otro, hoy,
}: { gastos: Gasto[]; yo: string; otro: string; hoy: string }) {
  const { c } = useTema();
  const e = c.claro ? HOJAS.claro : HOJAS.oscuro;

  const [mes, setMes] = useState(() => hoy.slice(0, 7));
  const [dia, setDia] = useState<string | null>(hoy);

  /** Cuanto se gasto cada dia y en cuantos gastos. Se arma una vez por mes y
   *  no por celda: con 31 celdas, recorrer la lista en cada una es recorrerla
   *  31 veces. */
  const porDia = useMemo(() => {
    const m = new Map<string, { total: number; cuantos: number; monedas: Set<string> }>();
    for (const g of gastos) {
      const x = m.get(g.fecha) ?? { total: 0, cuantos: 0, monedas: new Set<string>() };
      x.total += g.monto;
      x.cuantos += 1;
      x.monedas.add(g.moneda);
      m.set(g.fecha, x);
    }
    return m;
  }, [gastos]);

  const semanas = useMemo(() => semanasDelMes(mes), [mes]);

  /** El dia mas caro del mes, para graduar la intensidad del resto. Relativo y
   *  no absoluto: lo que es un dia caro depende del viaje. */
  const techo = useMemo(() => {
    let max = 0;
    for (const [fecha, x] of porDia) {
      if (fecha.startsWith(mes) && x.total > max) max = x.total;
    }
    return max;
  }, [porDia, mes]);

  const delDia = dia ? gastos.filter((g) => g.fecha === dia) : [];

  return (
    <ScrollView contentContainerStyle={e.cuerpo}>
      <View style={e.barraMes}>
        <Pressable onPress={() => setMes(correrMes(mes, -1))} hitSlop={14} style={e.flecha}>
          <Text style={e.flechaTexto}>‹</Text>
        </Pressable>
        <Text style={e.mes}>{nombreDelMes(mes)}</Text>
        <Pressable onPress={() => setMes(correrMes(mes, 1))} hitSlop={14} style={e.flecha}>
          <Text style={e.flechaTexto}>›</Text>
        </Pressable>
      </View>

      <View style={e.encabezadoDias}>
        {DIAS.map((d, i) => (
          <Text key={i} style={e.encabezadoDia}>{d}</Text>
        ))}
      </View>

      {semanas.map((semana, i) => (
        <View key={i} style={e.semana}>
          {semana.map((fecha, j) => {
            if (!fecha) return <View key={j} style={e.celda} />;

            const x = porDia.get(fecha);
            const elegido = fecha === dia;
            const esHoy = fecha === hoy;
            // La intensidad dice cuanto se gasto ese dia respecto del dia mas
            // caro. Un numero en cada celda seria ilegible en una grilla de 31.
            const fuerza = x && techo > 0 ? 0.18 + (x.total / techo) * 0.82 : 0;

            return (
              <Pressable
                key={j}
                style={e.celda}
                onPress={() => setDia(elegido ? null : fecha)}
              >
                <View
                  style={[
                    e.dia,
                    // El acento de los graficos, no tinta: un calendario todo
                    // gris no deja ver de un vistazo donde se gasto.
                    x ? { backgroundColor: c.graficos[0], opacity: fuerza } : null,
                    elegido && e.diaElegido,
                  ]}
                />
                <Text
                  style={[
                    e.numero,
                    x && fuerza > 0.55 ? { color: '#ffffff' } : null,
                    elegido && { color: '#ffffff' },
                    esHoy && e.numeroHoy,
                  ]}
                >
                  {Number(fecha.slice(8))}
                </Text>

                {/* Un punto y no solo la intensidad. La intensidad dice cuanto
                    se gasto comparado con el dia mas caro, pero el dia mas caro
                    es el unico que se ve bien cuando hay pocos dias cargados.
                    El punto contesta la pregunta anterior: si hubo algo o no. */}
                {x ? (
                  <View
                    style={[
                      e.marca,
                      {
                        backgroundColor: elegido || fuerza > 0.55
                          ? '#ffffff'
                          : c.graficos[0],
                      },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={e.detalleDia}>
        {dia ? (
          <>
            <Text style={e.tituloDia}>
              {cuando(dia, hoy) === 'hoy' || cuando(dia, hoy) === 'ayer'
                ? cuando(dia, hoy)
                : `${Number(dia.slice(8))} de ${nombreDelMes(dia.slice(0, 7)).split(' ')[0]}`}
            </Text>

            {delDia.length === 0 ? (
              <Text style={e.vacio}>No gastaron nada ese día.</Text>
            ) : (
              <>
                {delDia.map((g) => {
                  const loPagueYo = g.pagadoPor === yo;
                  return (
                    <View key={g.id} style={e.fila}>
                      <View
                        style={[
                          e.punto,
                          { backgroundColor: loPagueYo ? c.graficos[0] : c.graficos[1] },
                        ]}
                      />
                      <Text style={e.descripcion} numberOfLines={1}>{g.descripcion}</Text>
                      <Text style={e.quien}>{loPagueYo ? 'vos' : otro}</Text>
                      <Text style={e.monto}>{plata(g.monto, g.moneda)}</Text>
                    </View>
                  );
                })}
                <Totales gastos={delDia} />
              </>
            )}
          </>
        ) : (
          <Text style={e.vacio}>Tocá un día para ver qué gastaron.</Text>
        )}
      </View>
    </ScrollView>
  );
}

/** El total del dia, una linea por moneda. Nunca sumadas entre si. */
function Totales({ gastos }: { gastos: Gasto[] }) {
  const { c } = useTema();
  const e = c.claro ? HOJAS.claro : HOJAS.oscuro;

  const porMoneda = new Map<string, number>();
  for (const g of gastos) porMoneda.set(g.moneda, (porMoneda.get(g.moneda) ?? 0) + g.monto);

  return (
    <View style={e.totales}>
      {[...porMoneda.entries()].map(([moneda, total]) => (
        <View key={moneda} style={e.totalFila}>
          <Text style={e.totalEtiqueta}>Total en {moneda}</Text>
          <Text style={e.totalMonto}>{plata(total, moneda)}</Text>
        </View>
      ))}
    </View>
  );
}

const crear = (c: Paleta) => StyleSheet.create({
  cuerpo: { padding: 20, paddingBottom: 40 },

  barraMes: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 14,
  },
  mes: { fontFamily: SERIF_MEDIA, fontSize: 21, color: c.tinta, textTransform: 'capitalize' },
  flecha: { paddingHorizontal: 12, paddingVertical: 2 },
  flechaTexto: { fontSize: 28, color: c.suave, lineHeight: 32 },

  encabezadoDias: { flexDirection: 'row', paddingBottom: 6 },
  encabezadoDia: {
    flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700',
    color: c.suave, letterSpacing: .5,
  },

  semana: { flexDirection: 'row' },
  celda: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dia: {
    position: 'absolute', top: 3, right: 3, bottom: 3, left: 3, borderRadius: 9,
  },
  diaElegido: { backgroundColor: c.graficos[0], opacity: 1 },
  numero: { fontSize: 14, color: c.tinta, fontVariant: ['tabular-nums'] },
  // Hoy se marca con el peso, no con otro color: el color ya lo esta usando el
  // gasto del dia y dos cosas que compiten por el mismo canal no se leen.
  numeroHoy: { fontWeight: '900' },
  marca: { position: 'absolute', bottom: 7, width: 4, height: 4, borderRadius: 2 },

  detalleDia: {
    marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: c.linea,
  },
  tituloDia: {
    fontFamily: SERIF_MEDIA, fontSize: 18, color: c.tinta,
    textTransform: 'capitalize', marginBottom: 10,
  },
  vacio: { fontSize: 14.5, color: c.suave, lineHeight: 21 },

  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.linea,
  },
  punto: { width: 7, height: 7, borderRadius: 4 },
  descripcion: { flex: 1, fontSize: 15, color: c.tinta },
  quien: { fontSize: 12, color: c.suave },
  monto: {
    fontFamily: SERIF_MEDIA, fontSize: 15, color: c.tinta, fontVariant: ['tabular-nums'],
  },

  totales: { marginTop: 14, gap: 6 },
  totalFila: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalEtiqueta: { fontSize: 12.5, color: c.suave },
  totalMonto: {
    fontFamily: SERIF, fontSize: 19, color: c.graficos[0], fontVariant: ['tabular-nums'],
  },
});

const HOJAS = { claro: crear(CLARA), oscuro: crear(OSCURA) };
