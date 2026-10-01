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
import { MaterialIcons } from '@expo/vector-icons';
import { Fab } from '../Fab';
import { CLARA, MODOS, OSCURA, SERIF, SERIF_MEDIA, useTema, type Paleta } from '../tema';
import { ErrorApi } from '../api';
import { guardarPreferencia, preferencia } from '../local';
import { cuando, plata, useViaje, type Gasto, type Miembro } from '../datos';
import { NuevoGasto } from './NuevoGasto';
import { Sumar } from './Sumar';

export function Viaje({
  token, usuarioId, email, onSalir,
}: { token: string; usuarioId: string; email: string; onSalir: () => void }) {
  const { c, modo, cambiarModo } = useTema();
  const e = c.claro ? HOJAS.claro : HOJAS.oscuro;
  const v = useViaje(token, usuarioId);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [sumando, setSumando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const [moneda, setMoneda] = useState<string | null>(null);
  // El tamaño real de la pantalla, para que el boton no se pueda arrastrar
  // fuera de ella.
  const [caja, setCaja] = useState({ ancho: 0, alto: 0 });
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
        <ActivityIndicator size="large" color={c.tinta} />
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
  // Lo que llevan gastado entre los dos, por moneda. Es el numero del que se
  // habla de verdad en un viaje, y hasta ahora no estaba en ningun lado.
  const gastado: Record<string, number> = {};
  for (const g of v.gastos) {
    gastado[g.moneda] = (gastado[g.moneda] ?? 0) + g.monto;
  }
  const nombreOtro = v.otro ? v.otro.email.split('@')[0]! : 'el otro';

  const hoy = new Date().toISOString().slice(0, 10);

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
    <View
      style={e.todo}
      onLayout={(ev) => {
        const { width, height } = ev.nativeEvent.layout;
        setCaja({ ancho: width, alto: height });
      }}
    >
      <View style={e.cabecera}>
        <Pressable style={{ flex: 1 }} onPress={() => setEligiendo(true)}>
          <Text style={e.nombreViaje} numberOfLines={1}>
            {v.viaje?.nombre ?? 'Viaje'}  ▾
          </Text>
          <Text style={e.quien} numberOfLines={1}>
            {v.otro ? `con ${nombreOtro}` : email}
          </Text>
        </Pressable>

        {/* Cambiar el tema esta donde se mira, no escondido en un menu: es de
            las pocas cosas que se tocan por el momento del dia y no por lo que
            se quiere hacer. El icono dice en que modo esta. */}
        <Pressable
          onPress={() => {
            const i = MODOS.findIndex((m) => m.clave === modo);
            cambiarModo(MODOS[(i + 1) % MODOS.length]!.clave);
          }}
          hitSlop={10}
          style={e.accion}
          accessibilityLabel={`Apariencia: ${MODOS.find((m) => m.clave === modo)?.texto}`}
        >
          <MaterialIcons
            name={modo === 'claro' ? 'light-mode' : modo === 'oscuro' ? 'dark-mode' : 'brightness-auto'}
            size={20}
            color={c.suave}
          />
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
        ? <SaldoTira monedas={v.miSaldo} otro={nombreOtro} gastado={gastado} />
        : <Saldo
            saldo={saldo} moneda={activa} otro={nombreOtro}
            total={activa ? gastado[activa] ?? 0 : 0}
          />}

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
        renderItem={({ item }) => {
          // El tacho solo esta si se puede borrar. Un boton que al tocarlo
          // explica por que no funciona es peor que no tenerlo.
          const mio = item.creadoPor === null || item.creadoPor === usuarioId;
          const borrar = mio ? () => confirmarBorrado(item) : null;
          return gastosCortos
            ? <FilaCompacta gasto={item} yo={usuarioId} hoy={hoy} onBorrar={borrar} />
            : <Fila gasto={item} yo={usuarioId} otro={nombreOtro} hoy={hoy} onBorrar={borrar} />;
        }}
        refreshControl={
          <RefreshControl
            refreshing={cargandoMas}
            onRefresh={async () => {
              setCargandoMas(true);
              await v.traer();
              setCargandoMas(false);
            }}
            colors={[c.tinta]}
          />
        }
      />

      {/* Redondo, con un + y arrastrable, como el del changuito: el gesto ya
          esta aprendido, y donde estorba menos lo decide quien lo usa. */}
      <Fab
        onPress={() => setAbierto(true)} caja={caja}
        color={c.tinta} colorSigno={c.sobreTinta}
      />

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

          <View style={e.apariencia}>
            <Text style={e.etiqueta}>Apariencia</Text>
            <View style={e.modos}>
              {MODOS.map((m) => {
                const puesto = m.clave === modo;
                return (
                  <Pressable
                    key={m.clave}
                    style={[e.modo, puesto && e.modoPuesto]}
                    onPress={() => cambiarModo(m.clave)}
                  >
                    <Text style={[e.modoTexto, puesto && e.modoTextoPuesto]}>
                      {m.texto}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

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
/** El saldo, a sangre de borde a borde.
 *
 *  Una banda y no una tarjeta flotando sobre gris: la tarjeta con sombra y
 *  esquinas redondeadas es la forma en que se ve cualquier app de Android, y la
 *  pantalla terminaba pareciendose a todas. Llegando al borde, el color es la
 *  pantalla y no un objeto apoyado encima.
 *
 *  El monto va en serif. En una app de gastos nadie lo hace, y es la decision
 *  que mas separa esta pantalla de las demas. */
function Saldo({
  saldo, moneda, otro, total,
}: {
  saldo: { neto: number; puso: number; leToca: number } | null;
  moneda: string | null;
  otro: string;
  total: number;
}) {
  const { c } = useTema();
  const e = c.claro ? HOJAS.claro : HOJAS.oscuro;

  if (!saldo || saldo.neto === 0 || !moneda) {
    return (
      <View style={[e.banda, e.bandaParejo]}>
        <Text style={e.parejoEtiqueta}>
          {moneda ? `En ${moneda}` : 'Por ahora'}
        </Text>
        <Text style={e.parejoMonto}>Están a mano</Text>
      </View>
    );
  }

  const aFavor = saldo.neto > 0;
  return (
    <View style={[e.banda, aFavor ? e.verde : e.rojo]}>
      <Text style={e.bandaEtiqueta}>
        {aFavor ? `${otro} te debe` : `Le debés a ${otro}`}
      </Text>
      <Text style={e.bandaMonto}>{plata(saldo.neto, moneda)}</Text>

      <View style={e.bandaPie}>
        <View style={e.bandaDato}>
          <Text style={e.bandaDatoEtiqueta}>Pusiste</Text>
          <Text style={e.bandaDatoValor}>{plata(saldo.puso, moneda)}</Text>
        </View>
        <View style={e.bandaSeparador} />
        <View style={e.bandaDato}>
          <Text style={e.bandaDatoEtiqueta}>Te toca</Text>
          <Text style={e.bandaDatoValor}>{plata(saldo.leToca, moneda)}</Text>
        </View>
        <View style={e.bandaSeparador} />
        <View style={e.bandaDato}>
          <Text style={e.bandaDatoEtiqueta}>Gastaron</Text>
          <Text style={e.bandaDatoValor}>{plata(total, moneda)}</Text>
        </View>
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
  monedas, otro, gastado,
}: {
  monedas: { moneda: string; neto: number }[];
  otro: string;
  gastado: Record<string, number>;
}) {
  const { c } = useTema();
  const e = c.claro ? HOJAS.claro : HOJAS.oscuro;

  const conMovimiento = monedas.filter((m) => m.neto !== 0);

  if (conMovimiento.length === 0) {
    return (
      <View style={e.tiraVacia}>
        <Text style={e.parejoMonto}>Están a mano</Text>
      </View>
    );
  }

  return (
    <View style={e.tira}>
      {conMovimiento.map((m) => {
        const aFavor = m.neto > 0;
        return (
          <View key={m.moneda} style={[e.celda, aFavor ? e.celdaVerde : e.celdaRoja]}>
            <View style={e.celdaTexto}>
              <Text style={e.celdaEtiqueta} numberOfLines={1}>
                {m.moneda} · {aFavor ? `${otro} te debe` : 'le debés'}
              </Text>
              {/* El total, chiquito. Es contexto: sin el, un saldo de 15 no
                  dice si gastaron poco o si ya se emparejaron casi todo. */}
              <Text style={e.celdaGastado} numberOfLines={1}>
                gastaron {plata(gastado[m.moneda] ?? 0, m.moneda)}
              </Text>
            </View>
            {/* El monto no se achica ni se corta: es el dato. Lo que cede
                cuando falta ancho es el texto, que se puede adivinar. */}
            <Text style={e.celdaMonto}>{plata(m.neto, m.moneda)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Fila({
  gasto, yo, otro, hoy, onBorrar,
}: {
  gasto: Gasto; yo: string; otro: string; hoy: string; onBorrar: (() => void) | null;
}) {
  const { c } = useTema();
  const e = c.claro ? HOJAS.claro : HOJAS.oscuro;

  const loPagueYo = gasto.pagadoPor === yo;
  const miParte = gasto.partes.find((p) => p.usuarioId === yo)?.monto ?? 0;
  const mitad = Math.abs(miParte * 2 - gasto.monto) <= 1;

  return (
    <View style={e.fila}>
      <View style={e.inicial}>
        <Text style={e.inicialTexto}>{(loPagueYo ? 'V' : otro[0] ?? '?').toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={e.descripcion} numberOfLines={1}>{gasto.descripcion}</Text>
        <Text style={e.detalle}>
          {cuando(gasto.fecha, hoy)} · {loPagueYo ? 'pagaste vos' : `pagó ${otro}`}
          {!mitad ? ` · tu parte ${plata(miParte, gasto.moneda)}` : ''}
          {gasto.pendiente ? ' · sin subir' : ''}
        </Text>
      </View>
      <Text style={e.monto}>{plata(gasto.monto, gasto.moneda)}</Text>
      {onBorrar ? (
        <Pressable style={e.tacho} onPress={onBorrar} hitSlop={10}>
          <MaterialIcons name="delete-outline" size={20} color={c.suave} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** La misma informacion en un renglon. Con veinte gastos cargados, entran el
 *  doble en pantalla y se recorre la lista de una mirada. */
function FilaCompacta({
  gasto, yo, hoy, onBorrar,
}: { gasto: Gasto; yo: string; hoy: string; onBorrar: (() => void) | null }) {
  const { c } = useTema();
  const e = c.claro ? HOJAS.claro : HOJAS.oscuro;

  const loPagueYo = gasto.pagadoPor === yo;
  return (
    <View style={e.filaCorta}>
      <View style={[e.punto, loPagueYo ? e.puntoMio : e.puntoSuyo]} />
      <Text style={e.descripcionCorta} numberOfLines={1}>{gasto.descripcion}</Text>
      <Text style={e.fechaCorta}>{cuando(gasto.fecha, hoy)}</Text>
      {gasto.pendiente ? <Text style={e.pendiente}>↑</Text> : null}
      <Text style={e.montoCorto}>{plata(gasto.monto, gasto.moneda)}</Text>
      {onBorrar ? (
        <Pressable style={e.tachoChico} onPress={onBorrar} hitSlop={10}>
          <MaterialIcons name="delete-outline" size={17} color={c.suave} />
        </Pressable>
      ) : null}
    </View>
  );
}

const crear = (c: Paleta) => StyleSheet.create({
  todo: { flex: 1, backgroundColor: c.papel },
  centrado: { alignItems: 'center', justifyContent: 'center' },

  cabecera: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 16, gap: 8,
  },
  nombreViaje: { fontFamily: SERIF, fontSize: 30, color: c.tinta, letterSpacing: -.5 },
  quien: { fontSize: 13, color: c.suave, marginTop: 3 },
  accion: { paddingHorizontal: 7, paddingVertical: 4 },
  accionTexto: { color: c.tinta, fontSize: 14, fontWeight: '500' },

  pestanas: { flexDirection: 'row', gap: 0, paddingHorizontal: 22, paddingBottom: 14 },
  pestana: {
    paddingHorizontal: 2, paddingVertical: 4, marginRight: 18,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  pestanaPuesta: { borderBottomColor: c.tinta },
  pestanaTexto: { fontSize: 13, fontWeight: '600', color: c.suave, letterSpacing: .8 },
  pestanaTextoPuesto: { color: c.tinta },

  // A sangre, sin esquinas redondeadas ni sombra: el color es la pantalla, no
  // un objeto apoyado encima.
  banda: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18, marginBottom: 4 },
  verde: { backgroundColor: c.verde },
  rojo: { backgroundColor: c.rojo },
  bandaEtiqueta: {
    fontSize: 12, color: 'rgba(255,255,255,.78)',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  bandaMonto: {
    fontFamily: SERIF, fontSize: 46, color: c.sobreColor,
    letterSpacing: -1.5, marginTop: 6, fontVariant: ['tabular-nums'],
  },
  bandaPie: {
    flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.2)',
  },
  bandaDato: { flex: 1, gap: 2 },
  bandaSeparador: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,.2)' },
  bandaDatoEtiqueta: { fontSize: 10.5, color: 'rgba(255,255,255,.65)', letterSpacing: .5 },
  bandaDatoValor: {
    fontSize: 14, color: c.sobreColor, fontWeight: '600', fontVariant: ['tabular-nums'],
  },

  bandaParejo: { backgroundColor: c.fondo },
  parejoEtiqueta: {
    fontSize: 11.5, color: c.suave, textTransform: 'uppercase', letterSpacing: 1,
  },
  parejoMonto: { fontFamily: SERIF_MEDIA, fontSize: 30, color: c.tinta, marginTop: 4 },

  tira: { gap: 1, marginBottom: 4 },
  celda: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingHorizontal: 22, paddingVertical: 14,
  },
  celdaVerde: { backgroundColor: c.verde },
  celdaRoja: { backgroundColor: c.rojo },
  celdaTexto: { flexShrink: 1, gap: 2 },
  celdaEtiqueta: {
    fontSize: 11.5, color: 'rgba(255,255,255,.82)',
    textTransform: 'uppercase', letterSpacing: .8,
  },
  celdaGastado: { fontSize: 11.5, color: 'rgba(255,255,255,.62)' },
  celdaMonto: {
    fontFamily: SERIF, fontSize: 22, color: c.sobreColor, letterSpacing: -.5,
    fontVariant: ['tabular-nums'], flexShrink: 0,
  },
  tiraVacia: {
    marginBottom: 4, paddingVertical: 18, backgroundColor: c.fondo, alignItems: 'center',
  },

  avisoCaja: { paddingHorizontal: 22, paddingVertical: 9, backgroundColor: c.avisoFondo },
  aviso: { color: c.avisoTinta, fontSize: 12.5, lineHeight: 17 },

  filaSeccion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingBottom: 8, paddingTop: 2,
  },
  filaEtiqueta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 10, paddingTop: 18,
  },
  etiqueta: {
    fontSize: 11, fontWeight: '700', color: c.suave,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  lista: { paddingHorizontal: 22, paddingBottom: 110 },
  vacioCaja: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  vacioTitulo: { fontFamily: SERIF_MEDIA, fontSize: 22, color: c.tinta },
  vacio: { fontSize: 14.5, color: c.suave, textAlign: 'center', lineHeight: 21 },

  // Hairlines y no tarjetas: una lista de renglones se lee mas rapido y no
  // compite con la banda de arriba, que es lo unico que tiene que destacar.
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.linea,
  },
  filaApretada: { backgroundColor: c.fondo },
  inicial: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.linea,
    alignItems: 'center', justifyContent: 'center',
  },
  inicialTexto: { fontFamily: SERIF_MEDIA, color: c.suave, fontSize: 14 },
  descripcion: { fontSize: 15.5, color: c.tinta },
  detalle: { fontSize: 12.5, color: c.suave, marginTop: 3 },
  monto: {
    fontFamily: SERIF_MEDIA, fontSize: 16, color: c.tinta, fontVariant: ['tabular-nums'],
  },
  tacho: { paddingLeft: 12, paddingVertical: 6 },
  tachoChico: { paddingLeft: 10, paddingVertical: 4 },

  filaCorta: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.linea,
  },
  punto: { width: 7, height: 7, borderRadius: 4 },
  puntoMio: { backgroundColor: c.tinta },
  puntoSuyo: { backgroundColor: c.suave },
  descripcionCorta: { flex: 1, fontSize: 14.5, color: c.tinta },
  fechaCorta: { fontSize: 11.5, color: c.suave },
  pendiente: { fontSize: 12, color: c.avisoTinta, fontWeight: '700' },
  montoCorto: {
    fontFamily: SERIF_MEDIA, fontSize: 14.5, color: c.tinta, fontVariant: ['tabular-nums'],
  },

  error: { color: c.rojo, fontSize: 13.5, paddingHorizontal: 22, paddingBottom: 8 },

  barraElegir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 52, paddingBottom: 14,
    backgroundColor: c.papel, borderBottomWidth: 1, borderBottomColor: c.linea,
  },
  tituloElegir: { fontFamily: SERIF_MEDIA, fontSize: 18, color: c.tinta },
  opcionViaje: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 22, paddingVertical: 16, backgroundColor: c.papel,
    borderBottomWidth: 1, borderBottomColor: c.linea,
  },
  opcionNombre: { fontSize: 16.5, color: c.tinta },
  marcado: { fontSize: 17, color: c.tinta, fontWeight: '700' },

  apariencia: { paddingHorizontal: 22, paddingTop: 28, gap: 10 },
  modos: { flexDirection: 'row', gap: 7 },
  modo: {
    flex: 1, paddingVertical: 11, alignItems: 'center',
    borderWidth: 1, borderColor: c.linea, borderRadius: 2,
  },
  modoPuesto: { backgroundColor: c.tinta, borderColor: c.tinta },
  modoTexto: { fontSize: 13.5, fontWeight: '600', color: c.suave },
  modoTextoPuesto: { color: c.sobreTinta },

  peligro: { padding: 22, paddingTop: 34, gap: 8 },
  peligroTitulo: { fontFamily: SERIF_MEDIA, fontSize: 17, color: c.tinta },
  peligroAyuda: { fontSize: 13.5, color: c.suave, lineHeight: 19 },
  botonPeligro: {
    marginTop: 6, borderWidth: 1, borderColor: c.rojo,
    borderRadius: 2, paddingVertical: 14, alignItems: 'center',
  },
  botonPeligroApretado: { backgroundColor: c.fondo },
  botonPeligroTexto: { color: c.rojo, fontSize: 15, fontWeight: '600' },
});

/** Las dos hojas se construyen una vez al cargar el modulo. Armarlas en cada
 *  render seria recrear decenas de objetos de estilo por cada toque. */
const HOJAS = { claro: crear(CLARA), oscuro: crear(OSCURA) };
