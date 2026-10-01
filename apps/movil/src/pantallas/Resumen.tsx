/** En qué se fue la plata.
 *
 *  Tres cortes, y uno por pantalla a la vez: por moneda, por quién puso y en
 *  qué. Tres graficos apilados compitiendo entre si no se leen; de a uno, cada
 *  uno contesta una pregunta.
 *
 *  Barras y no torta. Una torta se ve linda y se compara mal: nadie distingue
 *  un 22% de un 27% mirando dos porciones. Con barras alineadas a la izquierda
 *  la comparacion la hace el ojo solo.
 *
 *  Dibujadas con Views y no con una libreria de graficos: son rectangulos de
 *  ancho proporcional, y una dependencia entera para eso no se paga. */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { plata, sumarPor, type Gasto } from '../datos';
import { CLARA, OSCURA, SERIF, SERIF_MEDIA, useTema, type Paleta } from '../tema';

type Corte = 'moneda' | 'quien' | 'que';

const CORTES: { clave: Corte; texto: string }[] = [
  { clave: 'que', texto: 'En qué' },
  { clave: 'quien', texto: 'Quién puso' },
  { clave: 'moneda', texto: 'Monedas' },
];

export function Resumen({
  gastos, yo, otro,
}: { gastos: Gasto[]; yo: string; otro: string }) {
  const { c } = useTema();
  const e = c.claro ? HOJAS.claro : HOJAS.oscuro;
  const [corte, setCorte] = useState<Corte>('que');

  const monedas = useMemo(
    () => [...new Set(gastos.map((g) => g.moneda))].sort(),
    [gastos],
  );
  const [moneda, setMoneda] = useState<string | null>(null);
  const activa = moneda && monedas.includes(moneda) ? moneda : monedas[0] ?? null;

  // Los cortes por quién y por qué se miran dentro de una moneda. Mezclarlas
  // daria barras que suman euros con pesos, que es un numero que no existe.
  const deLaMoneda = useMemo(
    () => (activa ? gastos.filter((g) => g.moneda === activa) : []),
    [gastos, activa],
  );

  const filas = useMemo(() => {
    if (corte === 'moneda') {
      return sumarPor(gastos, (g) => g.moneda, (g) => g.monto)
        .map((x) => ({ ...x, moneda: x.clave }));
    }
    const base = corte === 'quien'
      ? sumarPor(deLaMoneda, (g) => (g.pagadoPor === yo ? 'Vos' : otro), (g) => g.monto)
      : sumarPor(deLaMoneda, (g) => g.descripcion.trim() || 'Sin nombre', (g) => g.monto);
    return base.map((x) => ({ ...x, moneda: activa ?? '' }));
  }, [corte, gastos, deLaMoneda, activa, yo, otro]);

  const total = filas.reduce((s, f) => s + f.total, 0);
  const techo = filas[0]?.total ?? 0;

  if (gastos.length === 0) {
    return (
      <View style={e.vacioCaja}>
        <Text style={e.vacioTitulo}>Todavía no hay nada que resumir</Text>
        <Text style={e.vacio}>Cargá algunos gastos y acá vas a ver en qué se fue.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={e.cuerpo}>
      <View style={e.cortes}>
        {CORTES.map((x) => {
          const puesto = x.clave === corte;
          return (
            <Pressable
              key={x.clave}
              style={[e.corte, puesto && e.cortePuesto]}
              onPress={() => setCorte(x.clave)}
            >
              <Text style={[e.corteTexto, puesto && e.corteTextoPuesto]}>{x.texto}</Text>
            </Pressable>
          );
        })}
      </View>

      {corte !== 'moneda' && monedas.length > 1 ? (
        <View style={e.monedas}>
          {monedas.map((m) => {
            const puesta = m === activa;
            return (
              <Pressable key={m} onPress={() => setMoneda(m)} style={e.moneda}>
                <Text style={[e.monedaTexto, puesta && e.monedaTextoPuesto]}>{m}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {corte !== 'moneda' && activa ? (
        <View style={e.cabecera}>
          <Text style={e.cabeceraMonto}>{plata(total, activa)}</Text>
          <Text style={e.cabeceraPie}>
            en {deLaMoneda.length} {deLaMoneda.length === 1 ? 'gasto' : 'gastos'}
            {deLaMoneda.length > 0
              ? ` · ${plata(Math.round(total / deLaMoneda.length), activa)} cada uno`
              : ''}
          </Text>
        </View>
      ) : null}

      <View style={e.barras}>
        {filas.map((f) => {
          const parte = total > 0 ? f.total / total : 0;
          const ancho = techo > 0 ? Math.max(2, (f.total / techo) * 100) : 0;
          return (
            <View key={`${f.clave}-${f.moneda}`} style={e.barraCaja}>
              <View style={e.barraEncabezado}>
                <Text style={e.barraNombre} numberOfLines={1}>{f.clave}</Text>
                <Text style={e.barraMonto}>{plata(f.total, f.moneda)}</Text>
              </View>
              <View style={e.riel}>
                <View style={[e.barra, { width: `${ancho}%` }]} />
              </View>
              <Text style={e.barraParte}>{Math.round(parte * 100)}%</Text>
            </View>
          );
        })}
      </View>

      {corte === 'que' && filas.length > 2 ? (
        <Text style={e.nota}>
          {filas[0]!.clave} se llevó {Math.round((filas[0]!.total / total) * 100)}% de
          todo lo gastado en {activa}.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const crear = (c: Paleta) => StyleSheet.create({
  cuerpo: { padding: 20, paddingBottom: 40 },

  cortes: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  corte: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: c.linea, borderRadius: 2,
  },
  cortePuesto: { backgroundColor: c.tinta, borderColor: c.tinta },
  corteTexto: { fontSize: 13, fontWeight: '600', color: c.suave },
  corteTextoPuesto: { color: c.sobreTinta },

  monedas: { flexDirection: 'row', gap: 18, marginBottom: 14 },
  moneda: { paddingVertical: 4 },
  monedaTexto: {
    fontSize: 12.5, fontWeight: '700', color: c.suave, letterSpacing: .8,
  },
  monedaTextoPuesto: { color: c.tinta, textDecorationLine: 'underline' },

  cabecera: { marginBottom: 20 },
  cabeceraMonto: {
    fontFamily: SERIF, fontSize: 38, color: c.tinta,
    letterSpacing: -1.2, fontVariant: ['tabular-nums'],
  },
  cabeceraPie: { fontSize: 13, color: c.suave, marginTop: 2 },

  barras: { gap: 18 },
  barraCaja: { gap: 6 },
  barraEncabezado: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
  },
  barraNombre: { flex: 1, fontSize: 14.5, color: c.tinta },
  barraMonto: {
    fontFamily: SERIF_MEDIA, fontSize: 14.5, color: c.tinta, fontVariant: ['tabular-nums'],
  },
  riel: { height: 8, backgroundColor: c.fondo, borderRadius: 4, overflow: 'hidden' },
  barra: { height: '100%', backgroundColor: c.tinta, borderRadius: 4 },
  barraParte: { fontSize: 11.5, color: c.suave, fontVariant: ['tabular-nums'] },

  nota: {
    marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.linea,
    fontSize: 14, color: c.suave, lineHeight: 21,
  },

  vacioCaja: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  vacioTitulo: { fontFamily: SERIF_MEDIA, fontSize: 20, color: c.tinta, textAlign: 'center' },
  vacio: { fontSize: 14.5, color: c.suave, textAlign: 'center', lineHeight: 21 },
});

const HOJAS = { claro: crear(CLARA), oscuro: crear(OSCURA) };
