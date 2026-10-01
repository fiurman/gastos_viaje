/** Cargar un gasto.
 *
 *  Pensada para usarse parado en una caja con una mano: monto, qué fue, y el
 *  resto con valores por defecto razonables.
 *
 *  El reparto se elige en porcentajes pero **se muestra en plata**. Nadie
 *  discute un 70/30; se discute quien pone cuanto. Ver los dos numeros antes de
 *  guardar evita la mitad de los malentendidos. */

import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { ErrorApi } from '../api';
import { aCentavos, MONEDAS, plata, repartir, type Miembro } from '../datos';

/** Repartos de un toque. El numero es **tu** parte, no la del otro.
 *
 *  Los dos extremos se llaman por su nombre y no "100 / 0" porque son los que
 *  mas se usan y los que peor se leen en porcentajes: lo que se piensa es "esto
 *  es mio" o "esto me lo tiene que pagar entero", no un numero. */
const atajos = (suyo: string) => [
  { pct: 50, texto: 'Mitad' },
  { pct: 70, texto: '70 / 30' },
  { pct: 30, texto: '30 / 70' },
  { pct: 100, texto: 'Solo mío' },
  { pct: 0, texto: `Solo de ${suyo}` },
];

export function NuevoGasto({
  yo, otro, onCerrar, onGuardar,
}: {
  yo: string;
  otro: Miembro | null;
  onCerrar: () => void;
  onGuardar: (g: {
    monto: number; moneda: string; descripcion: string; pagadoPor: string;
    partes: { usuarioId: string; monto: number }[];
  }) => Promise<void>;
}) {
  const [montoTexto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [moneda, setMoneda] = useState<string>(MONEDAS[0]);
  const [pagadoPor, setPagadoPor] = useState(yo);
  const [miPct, setMiPct] = useState(50);
  const [aMano, setAMano] = useState(false);
  const [pctTexto, setPctTexto] = useState('50');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const centavos = aCentavos(montoTexto);
  const puede = centavos !== null && descripcion.trim().length > 0 && !guardando;
  const nombreOtro = otro ? otro.email.split('@')[0]! : '';

  /** El porcentaje se elige desde tu punto de vista, pero `repartir` lo quiere
   *  desde el de quien pago. Si pago el otro, se da vuelta. */
  const partes = (total: number) => repartir(
    total, pagadoPor, otro ? (pagadoPor === yo ? otro.usuarioId : yo) : null,
    pagadoPor === yo ? miPct : 100 - miPct,
  );

  const vistaPrevia = centavos !== null && otro ? partes(centavos) : null;
  const miParte = vistaPrevia?.find((p) => p.usuarioId === yo)?.monto ?? 0;
  const suParte = vistaPrevia?.find((p) => p.usuarioId !== yo)?.monto ?? 0;

  /** Lo que este gasto le mueve al saldo, dicho en castellano. Quien paga queda
   *  a favor por lo que puso de mas que su parte. */
  const mueve = pagadoPor === yo ? suParte : miParte;
  const consecuencia = mueve === 0
    ? 'Este gasto no cambia el saldo'
    : pagadoPor === yo
      ? `${nombreOtro} te queda debiendo ${plata(mueve, moneda)}`
      : `Le quedás debiendo ${plata(mueve, moneda)}`;

  async function guardar() {
    if (centavos === null) return;
    setError(null);
    setGuardando(true);
    try {
      await onGuardar({
        monto: centavos, moneda, descripcion: descripcion.trim(), pagadoPor,
        partes: partes(centavos),
      });
      onCerrar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  function elegirPct(pct: number) {
    setMiPct(pct);
    setPctTexto(String(pct));
    setAMano(false);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        style={e.todo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={e.barra}>
          <Pressable onPress={onCerrar} hitSlop={10} disabled={guardando}>
            <Text style={e.cancelar}>Cancelar</Text>
          </Pressable>
          <Text style={e.tituloBarra}>Nuevo gasto</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView contentContainerStyle={e.cuerpo} keyboardShouldPersistTaps="handled">
          <View style={e.montoCaja}>
            <TextInput
              style={e.monto}
              value={montoTexto}
              onChangeText={setMonto}
              placeholder="0,00"
              placeholderTextColor="#c5c9ce"
              keyboardType="decimal-pad"
              inputMode="decimal"
              autoFocus
              editable={!guardando}
            />
          </View>

          <Opciones
            valor={moneda}
            opciones={MONEDAS.map((m) => ({ clave: m, texto: m }))}
            onElegir={setMoneda}
          />

          <TextInput
            style={e.campo}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="¿Qué fue? Pizza, museo, taxi…"
            placeholderTextColor="#9aa0a6"
            editable={!guardando}
            returnKeyType="done"
          />

          {otro ? (
            <>
              <Text style={e.etiqueta}>Pagó</Text>
              <Opciones
                valor={pagadoPor}
                opciones={[
                  { clave: yo, texto: 'Yo' },
                  { clave: otro.usuarioId, texto: nombreOtro },
                ]}
                onElegir={setPagadoPor}
              />

              <Text style={e.etiqueta}>Cómo se divide</Text>
              <View style={e.chips}>
                {atajos(nombreOtro).map((a) => {
                  const puesto = !aMano && miPct === a.pct;
                  return (
                    <Pressable
                      key={a.pct}
                      style={[e.chip, puesto && e.chipPuesto]}
                      onPress={() => elegirPct(a.pct)}
                    >
                      <Text style={[e.chipTexto, puesto && e.chipTextoPuesto]}>
                        {a.texto}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[e.chip, aMano && e.chipPuesto]}
                  onPress={() => setAMano(true)}
                >
                  <Text style={[e.chipTexto, aMano && e.chipTextoPuesto]}>Otro %</Text>
                </Pressable>
              </View>

              {aMano ? (
                <View style={e.pctFila}>
                  <Text style={e.pctEtiqueta}>Tu parte</Text>
                  <TextInput
                    style={e.pctCampo}
                    value={pctTexto}
                    onChangeText={(t) => {
                      const limpio = t.replace(/\D/g, '').slice(0, 3);
                      setPctTexto(limpio);
                      const n = Number.parseInt(limpio, 10);
                      if (Number.isFinite(n)) setMiPct(Math.min(100, n));
                    }}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={3}
                    editable={!guardando}
                  />
                  <Text style={e.pctEtiqueta}>%</Text>
                </View>
              ) : null}

              {/* En plata, que es lo que se discute de verdad. Y debajo, en
                  quien queda la deuda: un 0 / 100 se lee mal al apuro. */}
              {vistaPrevia ? (
                <View>
                  <View style={e.previa}>
                    <View style={e.previaLado}>
                      <Text style={e.previaQuien}>Vos</Text>
                      <Text style={e.previaMonto}>{plata(miParte, moneda)}</Text>
                    </View>
                    <View style={e.previaLinea} />
                    <View style={e.previaLado}>
                      <Text style={e.previaQuien}>{nombreOtro}</Text>
                      <Text style={e.previaMonto}>{plata(suParte, moneda)}</Text>
                    </View>
                  </View>
                  <Text style={e.consecuencia}>{consecuencia}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={e.aviso}>
              Todavía estás solo en el viaje. Sumá a la otra persona para que los
              gastos se repartan.
            </Text>
          )}

          {error ? <Text style={e.error}>{error}</Text> : null}
        </ScrollView>

        <Pressable
          style={({ pressed }) => [
            e.guardar, !puede && e.guardarApagado, pressed && puede && e.guardarApretado,
          ]}
          onPress={guardar}
          disabled={!puede}
        >
          {guardando
            ? <ActivityIndicator color="#fff" />
            : <Text style={e.guardarTexto}>Guardar</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Opciones({
  valor, opciones, onElegir,
}: {
  valor: string;
  opciones: { clave: string; texto: string }[];
  onElegir: (v: string) => void;
}) {
  return (
    <View style={e.opciones}>
      {opciones.map((o) => {
        const elegida = o.clave === valor;
        return (
          <Pressable
            key={o.clave}
            style={[e.opcion, elegida && e.opcionElegida]}
            onPress={() => onElegir(o.clave)}
          >
            <Text style={[e.opcionTexto, elegida && e.opcionTextoElegido]} numberOfLines={1}>
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const e = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#fff' },
  barra: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#eceff1',
  },
  tituloBarra: { fontSize: 17, fontWeight: '600', color: '#15181c' },
  cancelar: { color: '#1a73e8', fontSize: 16, width: 64 },

  cuerpo: { padding: 20, gap: 14, paddingBottom: 40 },
  montoCaja: { alignItems: 'center', paddingVertical: 4 },
  monto: {
    fontSize: 54, fontWeight: '700', color: '#15181c',
    textAlign: 'center', minWidth: 180, fontVariant: ['tabular-nums'],
  },
  campo: {
    borderWidth: 1, borderColor: '#dadce0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: '#15181c',
  },
  etiqueta: { fontSize: 14, color: '#5f6368', marginTop: 4 },

  opciones: { flexDirection: 'row', gap: 8 },
  opcion: {
    flex: 1, paddingVertical: 13, borderRadius: 11, alignItems: 'center',
    backgroundColor: '#f1f3f4',
  },
  opcionElegida: { backgroundColor: '#1a73e8' },
  opcionTexto: { fontSize: 15, fontWeight: '600', color: '#5f6368' },
  opcionTextoElegido: { color: '#fff' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#f1f3f4',
  },
  chipPuesto: { backgroundColor: '#1a73e8' },
  chipTexto: { fontSize: 14, fontWeight: '600', color: '#5f6368' },
  chipTextoPuesto: { color: '#fff' },

  pctFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pctEtiqueta: { fontSize: 15, color: '#5f6368' },
  pctCampo: {
    borderWidth: 1, borderColor: '#dadce0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 18, minWidth: 74,
    textAlign: 'center', color: '#15181c', fontVariant: ['tabular-nums'],
  },

  previa: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f1f3f4', borderRadius: 14, padding: 16, marginTop: 4,
  },
  previaLado: { flex: 1, alignItems: 'center', gap: 4 },
  previaLinea: { width: 1, alignSelf: 'stretch', backgroundColor: '#dadce0' },
  previaQuien: { fontSize: 13, color: '#80868b' },
  previaMonto: {
    fontSize: 19, fontWeight: '700', color: '#15181c', fontVariant: ['tabular-nums'],
  },
  consecuencia: { fontSize: 13.5, color: '#5f6368', textAlign: 'center', marginTop: 9 },

  aviso: { fontSize: 14, color: '#80868b', lineHeight: 20 },
  error: { color: '#c5221f', fontSize: 15, lineHeight: 21 },

  guardar: {
    margin: 20, backgroundColor: '#1a73e8', borderRadius: 14,
    paddingVertical: 17, alignItems: 'center', justifyContent: 'center', minHeight: 56,
  },
  guardarApagado: { backgroundColor: '#c5c9ce' },
  guardarApretado: { backgroundColor: '#1557b0' },
  guardarTexto: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
