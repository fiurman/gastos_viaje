/** La pantalla principal: cuanto se debe, y todo lo que se gasto.
 *
 *  Manda el saldo: es el numero que se mira veinte veces por dia y por el que
 *  existe la app, asi que va arriba, en una tarjeta que cambia de color segun
 *  debas o te deban. Se entiende sin leer.
 *
 *  Cada seccion se achica por su cuenta, con su propio boton. Son decisiones
 *  distintas: quien tiene tres monedas quiere verlas todas y puede querer la
 *  lista chiquita, y quien tiene una sola moneda no gana nada achicando el
 *  saldo pero si la lista.
 *
 *  - **Saldo en detalle**: pestañas por moneda y la tarjeta grande de la que
 *    se elige. La lista se filtra a esa moneda, asi que es una cuenta cerrada
 *    en si misma. Es lo que hace falta para saldar una moneda sola.
 *  - **Saldo compacto**: una tira con todas las monedas y la lista entera, sin
 *    filtrar. Ninguna queda escondida atras de una pestaña.
 *  - **Gastos en detalle o compactos**: solo cambia el tamaño del renglon.
 *
 *  Los dos modos se recuerdan entre aperturas. */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { ErrorApi } from '../api';
import { guardarPreferencia, preferencia } from '../local';
import { plata, useViaje, type Gasto, type Miembro } from '../datos';
import { NuevoGasto } from './NuevoGasto';
import { Sumar } from './Sumar';

export function Viaje({
  token, usuarioId, email, onSalir,
}: { token: string; usuarioId: string; email: string; onSalir: () => void }) {
  const v = useViaje(token, usuarioId);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [sumando, setSumando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const [moneda, setMoneda] = useState<string | null>(null);
  const [monedasCortas, setMonedasCortas] = useState(false);
  const [gastosCortos, setGastosCortos] = useState(false);

  // Se recuerdan: una preferencia que se reinicia en cada apertura molesta
  // todos los dias.
  useEffect(() => {
    void preferencia('monedas').then((x) => setMonedasCortas(x === '1'));
    void preferencia('gastos').then((x) => setGastosCortos(x === '1'));
  }, []);

  const alternar = (
    valor: boolean,
    poner: (v: boolean) => void,
    clave: string,
  ) => () => {
    poner(!valor);
    void guardarPreferencia(clave, valor ? '0' : '1');
  };

  if (v.cargando) {
    return (
      <View style={[e.todo, e.centrado]}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  // Las monedas que existen de verdad, en el saldo o en algun gasto.
  const monedas = [...new Set([
    ...v.miSaldo.map((m) => m.moneda),
    ...v.gastos.map((g) => g.moneda),
  ])].sort();

  const activa = moneda && monedas.includes(moneda) ? moneda : monedas[0] ?? null;
  // El filtro lo manda la seccion de monedas: las pestañas SON el filtro, asi
  // que con el saldo compacto no hay nada filtrando y se ve todo.
  const gastos = monedasCortas || !activa
    ? v.gastos
    : v.gastos.filter((g) => g.moneda === activa);
  const saldo = v.miSaldo.find((m) => m.moneda === activa) ?? null;
  const nombreOtro = v.otro ? v.otro.email.split('@')[0]! : 'el otro';

  function confirmarBorrado(g: Gasto) {
    Alert.alert(
      'Borrar gasto',
      `«${g.descripcion}» por ${plata(g.monto, g.moneda)}.\n\nSe borra para los dos.`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => void v.borrar(g) },
      ],
    );
  }

  return (
    <View style={e.todo}>
      <View style={e.cabecera}>
        <Pressable style={{ flex: 1 }} onPress={() => setEligiendo(true)}>
          <Text style={e.nombreViaje} numberOfLines={1}>
            {v.viaje?.nombre ?? 'Viaje'}  ▾
          </Text>
          <Text style={e.quien} numberOfLines={1}>
            {v.otro ? `con ${nombreOtro}` : email}
          </Text>
        </Pressable>

        <Pressable onPress={() => setSumando(true)} hitSlop={10} style={e.accion}>
          <Text style={e.accionTexto}>Sumar</Text>
        </Pressable>
        <Pressable
          onPress={async () => { await v.salir(); onSalir(); }}
          hitSlop={10} style={e.accion}
        >
          <Text style={e.accionTexto}>Salir</Text>
        </Pressable>
      </View>

      {/* La fila de arriba solo aparece si hay algo que decidir: con una moneda
          sola, achicar el saldo no cambia nada. */}
      {monedas.length > 1 ? (
        <View style={e.filaSeccion}>
          <Text style={e.etiqueta}>Saldo</Text>
          <Pressable onPress={alternar(monedasCortas, setMonedasCortas, 'monedas')} hitSlop={10}>
            <Text style={e.accionTexto}>{monedasCortas ? 'Detalle' : 'Compacta'}</Text>
          </Pressable>
        </View>
      ) : null}

      {monedas.length > 1 && !monedasCortas ? (
        <View style={e.pestanas}>
          {monedas.map((m) => {
            const puesta = m === activa;
            return (
              <Pressable
                key={m}
                style={[e.pestana, puesta && e.pestanaPuesta]}
                onPress={() => setMoneda(m)}
              >
                <Text style={[e.pestanaTexto, puesta && e.pestanaTextoPuesto]}>{m}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {monedasCortas && monedas.length > 1
        ? <SaldoTira monedas={v.miSaldo} otro={nombreOtro} />
        : <Saldo saldo={saldo} moneda={activa} otro={nombreOtro} />}

      {v.sinRed || v.porSubir > 0 ? (
        <View style={e.avisoCaja}>
          <Text style={e.aviso}>
            {v.porSubir > 0
              ? `${v.porSubir} ${v.porSubir === 1 ? 'gasto' : 'gastos'} sin subir. Se suben solos cuando haya señal.`
              : 'Sin conexión. Podés seguir cargando igual.'}
          </Text>
        </View>
      ) : null}

      {v.error ? <Text style={e.error}>{v.error}</Text> : null}

      <FlatList
        data={gastos}
        keyExtractor={(g) => g.id}
        contentContainerStyle={gastos.length === 0 ? e.vacioCaja : e.lista}
        ListHeaderComponent={
          gastos.length > 0 ? (
            <View style={e.filaEtiqueta}>
              <Text style={e.etiqueta}>
                {gastos.length} {gastos.length === 1 ? 'gasto' : 'gastos'}
                {!monedasCortas && monedas.length > 1 ? ` en ${activa}` : ''}
              </Text>
              <Pressable onPress={alternar(gastosCortos, setGastosCortos, 'gastos')} hitSlop={10}>
                <Text style={e.accionTexto}>{gastosCortos ? 'Detalle' : 'Compacta'}</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <>
            <Text style={e.vacioTitulo}>
              {v.otro ? 'Todavía no hay gastos' : 'Todavía estás solo'}
            </Text>
            <Text style={e.vacio}>
              {v.otro
                ? 'Tocá el + de abajo para cargar el primero.'
                : 'Tocá «Sumar» arriba para agregar a la otra persona.'}
            </Text>
          </>
        }
        renderItem={({ item }) => (
          gastosCortos
            ? <FilaCompacta gasto={item} yo={usuarioId} onBorrar={() => confirmarBorrado(item)} />
            : <Fila gasto={item} yo={usuarioId} otro={nombreOtro} onBorrar={() => confirmarBorrado(item)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={cargandoMas}
            onRefresh={async () => {
              setCargandoMas(true);
              await v.traer();
              setCargandoMas(false);
            }}
            colors={['#1a73e8']}
          />
        }
      />

      {/* Redondo y con un +, como el del changuito: el gesto ya esta aprendido. */}
      <Pressable
        style={({ pressed }) => [e.fab, pressed && e.fabApretado]}
        onPress={() => setAbierto(true)}
        accessibilityLabel="Cargar un gasto"
      >
        <Text style={e.fabTexto}>+</Text>
      </Pressable>

      <Modal visible={eligiendo} animationType="slide" onRequestClose={() => setEligiendo(false)}>
        <View style={e.todo}>
          <View style={e.barraElegir}>
            <Pressable onPress={() => setEligiendo(false)} hitSlop={10}>
              <Text style={e.accionTexto}>Cerrar</Text>
            </Pressable>
            <Text style={e.tituloElegir}>{v.todos.length > 1 ? 'Tus viajes' : 'El viaje'}</Text>
            <View style={{ width: 52 }} />
          </View>
          {v.todos.map((x) => (
            <Pressable
              key={x.id}
              style={e.opcionViaje}
              onPress={async () => { setEligiendo(false); await v.cambiar(x.id, x.nombre); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={e.opcionNombre}>{x.nombre}</Text>
                <Text style={e.detalle}>
                  {x.miembros === 1 ? 'solo vos' : `${x.miembros} personas`}
                </Text>
              </View>
              {x.id === v.viaje?.id ? <Text style={e.marcado}>✓</Text> : null}
            </Pressable>
          ))}

          {/* Separado del resto y en rojo: no se toca por accidente mientras
              se cambia de viaje. */}
          <View style={e.peligro}>
            <Text style={e.peligroTitulo}>Empezar de cero</Text>
            <Text style={e.peligroAyuda}>
              Borra todos los gastos del viaje, en los dos teléfonos. No se puede
              deshacer.
            </Text>
            <Pressable
              style={({ pressed }) => [e.botonPeligro, pressed && e.botonPeligroApretado]}
              onPress={() => {
                Alert.alert(
                  'Borrar todos los gastos',
                  `Se van a borrar los ${v.gastos.length} gastos de «${v.viaje?.nombre}», para vos y para la otra persona.\n\nNo se puede deshacer.`,
                  [
                    { text: 'No', style: 'cancel' },
                    {
                      text: 'Borrar todo',
                      style: 'destructive',
                      onPress: async () => {
                        setEligiendo(false);
                        try {
                          await v.vaciar();
                        } catch (err) {
                          // El mensaje real y no una suposicion. Decir "falta
                          // conexion" ante cualquier error manda a buscar el
                          // problema donde no esta.
                          Alert.alert(
                            'No se pudo borrar',
                            err instanceof ErrorApi
                              ? `${err.message}\n\n(${err.codigo})`
                              : String(err),
                          );
                        }
                      },
                    },
                  ],
                );
              }}
            >
              <Text style={e.botonPeligroTexto}>Borrar todos los gastos</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {sumando && v.viaje ? (
        <Sumar
          token={token} viaje={v.viaje.id}
          onCerrar={() => setSumando(false)} onSumado={v.traer}
        />
      ) : null}

      {abierto && v.viaje ? (
        <NuevoGasto
          yo={usuarioId} otro={v.otro}
          onCerrar={() => setAbierto(false)} onGuardar={v.agregar}
        />
      ) : null}
    </View>
  );
}

/** El saldo de la moneda que se esta mirando, en una tarjeta que cambia de
 *  color. Verde si te deben, rojo si debés: se entiende sin leer. */
function Saldo({
  saldo, moneda, otro,
}: {
  saldo: { neto: number; puso: number; leToca: number } | null;
  moneda: string | null;
  otro: string;
}) {
  if (!saldo || saldo.neto === 0 || !moneda) {
    return (
      <View style={[e.tarjeta, e.tarjetaParejo]}>
        <Text style={e.parejo}>
          {moneda ? `Están a mano en ${moneda}` : 'Están a mano'}
        </Text>
      </View>
    );
  }

  const aFavor = saldo.neto > 0;
  return (
    <View style={[e.tarjeta, aFavor ? e.verde : e.rojo]}>
      <Text style={e.tarjetaEtiqueta}>
        {aFavor ? `${otro} te debe` : `Le debés a ${otro}`}
      </Text>
      <Text style={e.tarjetaMonto}>{plata(saldo.neto, moneda)}</Text>
      <View style={e.tarjetaPie}>
        <Text style={e.tarjetaPieTexto}>
          Pusiste {plata(saldo.puso, moneda)} · te toca {plata(saldo.leToca, moneda)}
        </Text>
      </View>
    </View>
  );
}

/** Todas las monedas de un vistazo, una debajo de otra.
 *
 *  Es el saldo del modo compacto. Ninguna queda escondida atras de una pestaña:
 *  con dos o tres monedas, lo que importa es ver si hay algo pendiente en
 *  alguna, no estudiar una por vez.
 *
 *  Apiladas y no lado a lado: en una pantalla de telefono dos columnas dejan
 *  unos 150 puntos para cada monto, y "$ 1.250.000,00" no entra. Un renglon
 *  por moneda ocupa menos alto que dos cajas y ademas nunca corta un numero. */
function SaldoTira({
  monedas, otro,
}: { monedas: { moneda: string; neto: number }[]; otro: string }) {
  const conMovimiento = monedas.filter((m) => m.neto !== 0);

  if (conMovimiento.length === 0) {
    return (
      <View style={e.tiraVacia}>
        <Text style={e.parejo}>Están a mano</Text>
      </View>
    );
  }

  return (
    <View style={e.tira}>
      {conMovimiento.map((m) => {
        const aFavor = m.neto > 0;
        return (
          <View key={m.moneda} style={[e.celda, aFavor ? e.celdaVerde : e.celdaRoja]}>
            <Text
              style={[e.celdaEtiqueta, aFavor ? e.textoVerde : e.textoRojo]}
              numberOfLines={1}
            >
              {m.moneda} · {aFavor ? `${otro} te debe` : 'le debés'}
            </Text>
            {/* El monto no se achica ni se corta: es el dato. Lo que cede
                cuando falta ancho es la etiqueta, que se puede adivinar. */}
            <Text style={[e.celdaMonto, aFavor ? e.textoVerde : e.textoRojo]}>
              {plata(m.neto, m.moneda)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Fila({
  gasto, yo, otro, onBorrar,
}: { gasto: Gasto; yo: string; otro: string; onBorrar: () => void }) {
  const loPagueYo = gasto.pagadoPor === yo;
  const miParte = gasto.partes.find((p) => p.usuarioId === yo)?.monto ?? 0;
  const mitad = Math.abs(miParte * 2 - gasto.monto) <= 1;

  return (
    <Pressable
      style={({ pressed }) => [e.fila, pressed && e.filaApretada]}
      onLongPress={onBorrar} delayLongPress={400}
    >
      <View style={e.inicial}>
        <Text style={e.inicialTexto}>{(loPagueYo ? 'V' : otro[0] ?? '?').toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={e.descripcion} numberOfLines={1}>{gasto.descripcion}</Text>
        <Text style={e.detalle}>
          {loPagueYo ? 'Pagaste vos' : `Pagó ${otro}`}
          {!mitad ? ` · tu parte ${plata(miParte, gasto.moneda)}` : ''}
          {gasto.pendiente ? ' · sin subir' : ''}
        </Text>
      </View>
      <Text style={e.monto}>{plata(gasto.monto, gasto.moneda)}</Text>
    </Pressable>
  );
}

/** La misma informacion en un renglon. Con veinte gastos cargados, entran el
 *  doble en pantalla y se recorre la lista de una mirada. */
function FilaCompacta({
  gasto, yo, onBorrar,
}: { gasto: Gasto; yo: string; onBorrar: () => void }) {
  const loPagueYo = gasto.pagadoPor === yo;
  return (
    <Pressable
      style={({ pressed }) => [e.filaCorta, pressed && e.filaApretada]}
      onLongPress={onBorrar} delayLongPress={400}
    >
      <View style={[e.punto, loPagueYo ? e.puntoMio : e.puntoSuyo]} />
      <Text style={e.descripcionCorta} numberOfLines={1}>{gasto.descripcion}</Text>
      {gasto.pendiente ? <Text style={e.pendiente}>↑</Text> : null}
      <Text style={e.montoCorto}>{plata(gasto.monto, gasto.moneda)}</Text>
    </Pressable>
  );
}

const e = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#f4f5f7' },
  centrado: { alignItems: 'center', justifyContent: 'center' },

  cabecera: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 6,
  },
  nombreViaje: { fontSize: 24, fontWeight: '700', color: '#15181c' },
  quien: { fontSize: 13, color: '#7a8089', marginTop: 2 },
  accion: { paddingHorizontal: 8, paddingVertical: 4 },
  accionTexto: { color: '#1a73e8', fontSize: 15 },

  pestanas: { flexDirection: 'row', gap: 7, paddingHorizontal: 20, paddingBottom: 12 },
  pestana: {
    paddingHorizontal: 15, paddingVertical: 7, borderRadius: 999,
    backgroundColor: '#e6e8ec',
  },
  pestanaPuesta: { backgroundColor: '#15181c' },
  pestanaTexto: { fontSize: 13, fontWeight: '700', color: '#5f6368', letterSpacing: .3 },
  pestanaTextoPuesto: { color: '#fff' },

  tarjeta: { marginHorizontal: 20, marginBottom: 12, borderRadius: 18, padding: 18 },
  rojo: { backgroundColor: '#a52019' },
  verde: { backgroundColor: '#1a7336' },
  tarjetaParejo: { backgroundColor: '#e6e8ec', alignItems: 'center', paddingVertical: 26 },
  parejo: { fontSize: 17, color: '#5f6368' },
  tarjetaEtiqueta: { fontSize: 13, color: 'rgba(255,255,255,.85)' },
  tarjetaMonto: {
    fontSize: 38, fontWeight: '700', color: '#fff',
    letterSpacing: -1, marginTop: 2, fontVariant: ['tabular-nums'],
  },
  tarjetaPie: {
    marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.22)',
  },
  tarjetaPieTexto: { fontSize: 12, color: 'rgba(255,255,255,.82)' },

  tira: { gap: 6, marginHorizontal: 20, marginBottom: 12 },
  celda: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12,
  },
  celdaVerde: { backgroundColor: '#e3f1e7' },
  celdaRoja: { backgroundColor: '#fbe5e3' },
  textoVerde: { color: '#14612c' },
  textoRojo: { color: '#8c1d18' },
  // `flexShrink` en la etiqueta y no en el monto: cuando falta ancho, lo que
  // se achica es el texto, nunca la cifra.
  celdaEtiqueta: { flexShrink: 1, fontSize: 12.5, fontWeight: '600', letterSpacing: .2 },
  celdaMonto: {
    fontSize: 20, fontWeight: '700', letterSpacing: -.4,
    fontVariant: ['tabular-nums'], flexShrink: 0,
  },
  tiraVacia: {
    marginHorizontal: 20, marginBottom: 12, paddingVertical: 16,
    backgroundColor: '#e6e8ec', borderRadius: 13, alignItems: 'center',
  },

  avisoCaja: {
    marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#fef7e0', borderRadius: 12,
  },
  aviso: { color: '#9a6700', fontSize: 13, lineHeight: 18 },

  filaSeccion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 7,
  },
  filaEtiqueta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 8,
  },
  etiqueta: {
    fontSize: 12, fontWeight: '700', color: '#7a8089',
    textTransform: 'uppercase', letterSpacing: .6,
  },

  lista: { paddingHorizontal: 20, paddingBottom: 110 },
  vacioCaja: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  vacioTitulo: { fontSize: 19, fontWeight: '600', color: '#5f6368' },
  vacio: { fontSize: 15, color: '#9aa0a6', textAlign: 'center', lineHeight: 22 },

  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: '#fff', borderRadius: 13, padding: 12, marginBottom: 7,
  },
  filaApretada: { backgroundColor: '#eceef1' },
  inicial: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#eceef1',
    alignItems: 'center', justifyContent: 'center',
  },
  inicialTexto: { color: '#5f6368', fontSize: 13, fontWeight: '700' },
  descripcion: { fontSize: 15.5, color: '#15181c' },
  detalle: { fontSize: 12.5, color: '#7a8089', marginTop: 2 },
  monto: { fontSize: 15.5, fontWeight: '600', color: '#15181c', fontVariant: ['tabular-nums'] },

  filaCorta: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#eceef1',
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  puntoMio: { backgroundColor: '#1a73e8' },
  puntoSuyo: { backgroundColor: '#c8ccd2' },
  descripcionCorta: { flex: 1, fontSize: 14.5, color: '#15181c' },
  pendiente: { fontSize: 12, color: '#9a6700', fontWeight: '700' },
  montoCorto: { fontSize: 14.5, fontWeight: '600', color: '#15181c', fontVariant: ['tabular-nums'] },

  fab: {
    position: 'absolute', right: 22, bottom: 26,
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#15181c',
    alignItems: 'center', justifyContent: 'center',
    // boxShadow y no shadow*: las props viejas estan deprecadas y avisan en
    // cada render.
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
    elevation: 6,
  },
  fabApretado: { backgroundColor: '#000' },
  fabTexto: { color: '#fff', fontSize: 34, lineHeight: 38, fontWeight: '300' },

  error: { color: '#c5221f', fontSize: 14, paddingHorizontal: 20, paddingBottom: 8 },

  barraElegir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eceff1',
  },
  tituloElegir: { fontSize: 17, fontWeight: '600', color: '#15181c' },
  opcionViaje: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eceff1',
  },
  opcionNombre: { fontSize: 17, color: '#15181c' },
  marcado: { fontSize: 18, color: '#1a73e8', fontWeight: '700' },

  peligro: { padding: 20, paddingTop: 34, gap: 8 },
  peligroTitulo: { fontSize: 16, fontWeight: '600', color: '#15181c' },
  peligroAyuda: { fontSize: 13.5, color: '#7a8089', lineHeight: 19 },
  botonPeligro: {
    marginTop: 6, borderWidth: 1, borderColor: '#e8b5b2', backgroundColor: '#fbe5e3',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  botonPeligroApretado: { backgroundColor: '#f6d2cf' },
  botonPeligroTexto: { color: '#8c1d18', fontSize: 15.5, fontWeight: '600' },
});
