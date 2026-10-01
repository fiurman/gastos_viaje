/** La pantalla principal: cuanto se debe, y todo lo que se gasto.
 *
 *  Lo que manda es el saldo. Es el numero que se mira veinte veces por dia y
 *  por el que existe la app, asi que ocupa la parte de arriba y en grande. La
 *  lista es el respaldo de ese numero, no al reves. */

import { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
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

  if (v.cargando) {
    return (
      <View style={[e.todo, e.centrado]}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

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
        <Pressable
          style={{ flex: 1 }}
          onPress={() => v.todos.length > 1 && setEligiendo(true)}
          disabled={v.todos.length <= 1}
        >
          <Text style={e.nombreViaje} numberOfLines={1}>
            {v.viaje?.nombre ?? 'Viaje'}{v.todos.length > 1 ? '  ▾' : ''}
          </Text>
          <Text style={e.quien} numberOfLines={1}>
            {v.otro ? `con ${v.otro.email.split('@')[0]}` : email}
          </Text>
        </Pressable>

        <Pressable onPress={() => setSumando(true)} hitSlop={10} style={e.accion}>
          <Text style={e.accionTexto}>Sumar</Text>
        </Pressable>
        <Pressable
          onPress={async () => { await v.salir(); onSalir(); }}
          hitSlop={10}
          style={e.accion}
        >
          <Text style={e.accionTexto}>Salir</Text>
        </Pressable>
      </View>

      <Saldo monedas={v.miSaldo} otro={v.otro} />

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
        data={v.gastos}
        keyExtractor={(g) => g.id}
        contentContainerStyle={v.gastos.length === 0 ? e.vacioCaja : e.lista}
        ListHeaderComponent={
          v.gastos.length > 0 ? <Text style={e.encabezadoLista}>Gastos</Text> : null
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
          <Fila
            gasto={item}
            yo={usuarioId}
            otro={v.otro}
            onBorrar={() => confirmarBorrado(item)}
          />
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
            <Text style={e.tituloElegir}>Tus viajes</Text>
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
        </View>
      </Modal>

      {sumando && v.viaje ? (
        <Sumar
          token={token}
          viaje={v.viaje.id}
          onCerrar={() => setSumando(false)}
          onSumado={v.traer}
        />
      ) : null}

      {abierto && v.viaje ? (
        <NuevoGasto
          yo={usuarioId}
          otro={v.otro}
          onCerrar={() => setAbierto(false)}
          onGuardar={v.agregar}
        />
      ) : null}
    </View>
  );
}

/** Lo que te deben o debés, una linea por moneda.
 *
 *  Separado por moneda a proposito: sumar euros con pesos seria mas comodo y
 *  estaria mal. */
function Saldo({
  monedas, otro,
}: { monedas: { moneda: string; neto: number }[]; otro: Miembro | null }) {
  const conMovimiento = monedas.filter((m) => m.neto !== 0);
  const nombre = otro ? otro.email.split('@')[0]! : 'el otro';

  if (conMovimiento.length === 0) {
    return (
      <View style={[e.saldo, e.saldoVacio]}>
        <Text style={e.saldoParejo}>Están a mano</Text>
      </View>
    );
  }

  return (
    <View style={e.saldo}>
      {conMovimiento.map((m, i) => (
        <View key={m.moneda}>
          {i > 0 ? <View style={e.separador} /> : null}
          <Text style={e.saldoEtiqueta}>
            {m.neto > 0 ? `${nombre} te debe` : `Le debés a ${nombre}`}
          </Text>
          <Text style={[e.saldoMonto, m.neto > 0 ? e.aFavor : e.enContra]}>
            {plata(m.neto, m.moneda)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Fila({
  gasto, yo, otro, onBorrar,
}: { gasto: Gasto; yo: string; otro: Miembro | null; onBorrar: () => void }) {
  const loPagueYo = gasto.pagadoPor === yo;
  const miParte = gasto.partes.find((p) => p.usuarioId === yo)?.monto ?? 0;
  const mitad = Math.abs(miParte * 2 - gasto.monto) <= 1;

  return (
    <Pressable
      style={({ pressed }) => [e.fila, pressed && e.filaApretada]}
      onLongPress={onBorrar}
      delayLongPress={400}
    >
      <View style={e.inicial}>
        <Text style={e.inicialTexto}>
          {(loPagueYo ? 'vos' : otro?.email ?? '?')[0]!.toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={e.descripcion} numberOfLines={1}>{gasto.descripcion}</Text>
        <Text style={e.detalle}>
          {loPagueYo ? 'Pagaste vos' : `Pagó ${otro?.email.split('@')[0] ?? 'el otro'}`}
          {!mitad ? ` · tu parte ${plata(miParte, gasto.moneda)}` : ''}
          {gasto.pendiente ? ' · sin subir' : ''}
        </Text>
      </View>

      <Text style={e.monto}>{plata(gasto.monto, gasto.moneda)}</Text>
    </Pressable>
  );
}

const e = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#fff' },
  centrado: { alignItems: 'center', justifyContent: 'center' },

  cabecera: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 6,
  },
  nombreViaje: { fontSize: 24, fontWeight: '700', color: '#15181c' },
  quien: { fontSize: 13, color: '#80868b', marginTop: 2 },
  accion: { paddingHorizontal: 8, paddingVertical: 4 },
  accionTexto: { color: '#1a73e8', fontSize: 15 },

  saldo: {
    marginHorizontal: 20, marginBottom: 10, padding: 20,
    backgroundColor: '#f8f9fa', borderRadius: 18,
    borderWidth: 1, borderColor: '#eceff1',
  },
  saldoVacio: { alignItems: 'center', paddingVertical: 26 },
  separador: { height: 1, backgroundColor: '#e4e7ea', marginVertical: 14 },
  saldoEtiqueta: { fontSize: 14, color: '#5f6368', marginBottom: 4 },
  saldoMonto: { fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'] },
  aFavor: { color: '#1e8e3e' },
  enContra: { color: '#c5221f' },
  saldoParejo: { fontSize: 18, color: '#5f6368' },

  avisoCaja: {
    marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#fef7e0', borderRadius: 12,
  },
  aviso: { color: '#9a6700', fontSize: 13, lineHeight: 18 },

  encabezadoLista: {
    fontSize: 13, fontWeight: '600', color: '#80868b',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  lista: { paddingHorizontal: 20, paddingBottom: 110 },
  vacioCaja: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  vacioTitulo: { fontSize: 19, fontWeight: '600', color: '#5f6368' },
  vacio: { fontSize: 15, color: '#9aa0a6', textAlign: 'center', lineHeight: 22 },

  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#eceff1',
  },
  filaApretada: { backgroundColor: '#f8f9fa' },
  inicial: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#e8f0fe',
    alignItems: 'center', justifyContent: 'center',
  },
  inicialTexto: { color: '#1a73e8', fontSize: 15, fontWeight: '700' },
  descripcion: { fontSize: 16, color: '#15181c' },
  detalle: { fontSize: 13, color: '#80868b', marginTop: 3 },
  monto: { fontSize: 16, fontWeight: '600', color: '#15181c', fontVariant: ['tabular-nums'] },

  fab: {
    position: 'absolute', right: 22, bottom: 26,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#1a73e8', alignItems: 'center', justifyContent: 'center',
    // boxShadow y no shadow*: las props viejas estan deprecadas y avisan en
    // cada render.
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
    elevation: 6,
  },
  fabApretado: { backgroundColor: '#1557b0' },
  fabTexto: { color: '#fff', fontSize: 34, lineHeight: 38, fontWeight: '300' },

  error: { color: '#c5221f', fontSize: 14, paddingHorizontal: 20, paddingBottom: 8 },

  barraElegir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#eceff1',
  },
  tituloElegir: { fontSize: 17, fontWeight: '600', color: '#15181c' },
  opcionViaje: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#eceff1',
  },
  opcionNombre: { fontSize: 17, color: '#15181c' },
  marcado: { fontSize: 18, color: '#1a73e8', fontWeight: '700' },
});
