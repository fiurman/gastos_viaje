/** En qué se fue la plata.
 *
 *  Tres cortes, y uno por pantalla a la vez: por moneda, por quién puso y en
 *  qué. Tres graficos apilados compitiendo entre si no se leen; de a uno, cada
 *  uno contesta una pregunta.
 *
 *  Se puede ver en barras o en rosca. Las barras comparan mejor —nadie
 *  distingue un 22% de un 27% mirando dos porciones— pero la rosca muestra de
 *  un golpe como se reparte el total, que es otra pregunta. Las dos sirven, y
 *  cual es mejor depende de lo que uno este mirando, asi que se elige.
 *
 *  La rosca se dibuja con un solo circulo por porcion y el truco del trazo
 *  discontinuo: cada arco es un `stroke-dasharray` del largo que le toca,
 *  corrido por un `stroke-dashoffset`. Sin paths ni trigonometria. */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { plata, sumarPor, type Gasto } from '../datos';
import { CLARA, OSCURA, SERIF, SERIF_MEDIA, useTema, type Paleta } from '../tema';

type Corte = 'moneda' | 'quien' | 'que';

type Forma = 'barras' | 'rosca';

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
  const [forma, setForma] = useState<Forma>('barras');

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

      <View style={e.formas}>
        {([['barras', 'Barras'], ['rosca', 'Rosca']] as const).map(([k, texto]) => (
          <Pressable key={k} onPress={() => setForma(k)} style={e.forma}>
            <Text style={[e.formaTexto, forma === k && e.formaTextoPuesto]}>{texto}</Text>
          </Pressable>
        ))}
      </View>

      {forma === 'rosca' ? (
        <Rosca filas={filas} total={total} />
      ) : (
      <View style={e.barras}>
        {filas.map((f, i) => {
          const parte = total > 0 ? f.total / total : 0;
          const ancho = techo > 0 ? Math.max(2, (f.total / techo) * 100) : 0;
          const color = c.graficos[i % c.graficos.length]!;
          return (
            <View key={`${f.clave}-${f.moneda}`} style={e.barraCaja}>
              <View style={e.barraEncabezado}>
                <View style={[e.muestra, { backgroundColor: color }]} />
                <Text style={e.barraNombre} numberOfLines={1}>{f.clave}</Text>
                <Text style={e.barraMonto}>{plata(f.total, f.moneda)}</Text>
              </View>
              <View style={e.riel}>
                <View style={[e.barra, { width: `${ancho}%`, backgroundColor: color }]} />
              </View>
              <Text style={e.barraParte}>{Math.round(parte * 100)}%</Text>
            </View>
          );
        })}
      </View>
      )}

      {corte === 'que' && filas.length > 2 ? (
        <Text style={e.nota}>
          {filas[0]!.clave} se llevó {Math.round((filas[0]!.total / total) * 100)}% de
          todo lo gastado en {activa}.
        </Text>
      ) : null}
    </ScrollView>
  );
}

/** Una rosca, con el total en el medio.
 *
 *  Un color por porcion, de la paleta del tema. Acá el color si lleva
 *  informacion: es lo que ata cada arco con su referencia de abajo. El orden de
 *  los colores es fijo, asi que la categoria mas grande es siempre del mismo
 *  color y se reconoce de un vistazo al volver a la pantalla. */
function Rosca({
  filas, total,
}: { filas: { clave: string; total: number; moneda: string }[]; total: number }) {
  const { c } = useTema();
  const e = c.claro ? HOJAS.claro : HOJAS.oscuro;

  const LADO = 190;
  const GROSOR = 26;
  const radio = (LADO - GROSOR) / 2;
  const vuelta = 2 * Math.PI * radio;

  // Como maximo seis porciones y el resto junto: con mas, los arcos quedan
  // mas finos que la linea que los separa y no se distingue ninguno.
  const visibles = filas.slice(0, 6);
  const resto = filas.slice(6).reduce((s, f) => s + f.total, 0);
  const porciones = resto > 0
    ? [...visibles, { clave: 'Otros', total: resto, moneda: filas[0]?.moneda ?? '' }]
    : visibles;

  let acumulado = 0;
  const arcos = porciones.map((f, i) => {
    const parte = total > 0 ? f.total / total : 0;
    const arco = {
      f,
      // Un pelito menos para que quede una ranura entre porciones.
      largo: Math.max(0, parte * vuelta - 2),
      corrimiento: -acumulado * vuelta,
      color: c.graficos[i % c.graficos.length]!,
    };
    acumulado += parte;
    return arco;
  });

  return (
    <View style={e.roscaCaja}>
      <View>
        <Svg width={LADO} height={LADO}>
          {/* Girado para que la primera porcion arranque arriba y no a la
              derecha, que es donde empieza un circulo en SVG. */}
          <G rotation={-90} origin={`${LADO / 2}, ${LADO / 2}`}>
            <Circle
              cx={LADO / 2} cy={LADO / 2} r={radio}
              stroke={c.fondo} strokeWidth={GROSOR} fill="none"
            />
            {arcos.map((a) => (
              <Circle
                key={a.f.clave}
                cx={LADO / 2} cy={LADO / 2} r={radio}
                stroke={a.color}
                strokeWidth={GROSOR}
                strokeDasharray={`${a.largo} ${vuelta}`}
                strokeDashoffset={a.corrimiento}
                fill="none"
              />
            ))}
          </G>
        </Svg>
        <View style={e.roscaCentro} pointerEvents="none">
          <Text style={e.roscaTotal}>{plata(total, filas[0]?.moneda ?? '')}</Text>
          <Text style={e.roscaPie}>en total</Text>
        </View>
      </View>

      <View style={e.referencias}>
        {arcos.map((a) => (
          <View key={a.f.clave} style={e.referencia}>
            <View style={[e.muestra, { backgroundColor: a.color }]} />
            <Text style={e.referenciaNombre} numberOfLines={1}>{a.f.clave}</Text>
            <Text style={e.referenciaValor}>
              {Math.round((a.f.total / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const crear = (c: Paleta) => StyleSheet.create({
  cuerpo: { padding: 20, paddingBottom: 40 },

  cortes: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  corte: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: c.linea, borderRadius: 2,
  },
  cortePuesto: { backgroundColor: c.graficos[0], borderColor: c.graficos[0] },
  corteTexto: { fontSize: 13, fontWeight: '600', color: c.suave },
  // Siempre blanco: los colores de grafico son oscuros en claro y en oscuro
  // son lo bastante saturados como para que el blanco siga leyendose.
  corteTextoPuesto: { color: '#ffffff' },

  monedas: { flexDirection: 'row', gap: 18, marginBottom: 14 },
  moneda: { paddingVertical: 4 },
  monedaTexto: {
    fontSize: 12.5, fontWeight: '700', color: c.suave, letterSpacing: .8,
  },
  monedaTextoPuesto: { color: c.graficos[0], textDecorationLine: 'underline' },

  cabecera: { marginBottom: 20 },
  cabeceraMonto: {
    fontFamily: SERIF, fontSize: 38, color: c.graficos[0],
    letterSpacing: -1.2, fontVariant: ['tabular-nums'],
  },
  cabeceraPie: { fontSize: 13, color: c.suave, marginTop: 2 },

  formas: { flexDirection: 'row', gap: 18, marginBottom: 16 },
  forma: { paddingVertical: 2 },
  formaTexto: { fontSize: 13, color: c.suave, fontWeight: '600' },
  formaTextoPuesto: { color: c.graficos[0], textDecorationLine: 'underline' },

  roscaCaja: { alignItems: 'center', gap: 20 },
  roscaCentro: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  roscaTotal: {
    fontFamily: SERIF, fontSize: 22, color: c.tinta,
    letterSpacing: -.5, fontVariant: ['tabular-nums'],
  },
  roscaPie: { fontSize: 11.5, color: c.suave, marginTop: 1 },
  referencias: { alignSelf: 'stretch', gap: 9 },
  referencia: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muestra: { width: 11, height: 11, borderRadius: 3 },
  referenciaNombre: { flex: 1, fontSize: 14, color: c.tinta },
  referenciaValor: {
    fontSize: 13.5, color: c.suave, fontVariant: ['tabular-nums'],
  },

  barras: { gap: 18 },
  barraCaja: { gap: 6 },
  barraEncabezado: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9,
  },
  barraNombre: { flex: 1, fontSize: 14.5, color: c.tinta },
  barraMonto: {
    fontFamily: SERIF_MEDIA, fontSize: 14.5, color: c.tinta, fontVariant: ['tabular-nums'],
  },
  riel: { height: 8, backgroundColor: c.fondo, borderRadius: 4, overflow: 'hidden' },
  barra: { height: '100%', borderRadius: 4 },
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
