/** Cargar un gasto.
 *
 *  Pensada para usarse parado en una caja, con una mano y apurado. De ahi las
 *  tres decisiones de la pantalla:
 *
 *  - **El monto manda.** Ocupa un bloque oscuro arriba, a pantalla completa de
 *    ancho, con el simbolo de la moneda pegado. Es lo primero que se tipea y lo
 *    unico que no tiene valor por defecto.
 *  - **La descripcion se toca, no se escribe.** Seis atajos cubren casi todo lo
 *    que se gasta en un viaje. Tipear en un teclado de telefono con la fila
 *    atras es la fricción de verdad, no los porcentajes.
 *  - **El reparto se elige en porcentajes y se muestra en plata**, con el
 *    saldo resultante escrito en castellano. Nadie discute un 70/30; se discute
 *    quien pone cuanto. */

import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { ErrorApi } from '../api';
import { CLARA, OSCURA, useTema, type Paleta } from '../tema';
import {
  aCentavos, cuando, DESCRIPCION_MAXIMA, limpiarDescripcion, MONEDAS, plata,
  repartir, type Miembro,
} from '../datos';
import { ElegirFecha } from './ElegirFecha';

/** Lo que se gasta en un viaje, en el orden en que se gasta. Llenan la
 *  descripcion y se pueden seguir editando: son un punto de partida, no una
 *  categoria cerrada. */
const ATAJOS_TEXTO = ['Comida', 'Transporte', 'Hotel', 'Súper', 'Entradas'];

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

const SIMBOLO: Record<string, string> = { EUR: '€', ARS: '$', USD: 'US$' };

export function NuevoGasto({
  yo, otro, hoy, onCerrar, onGuardar,
}: {
  yo: string;
  otro: Miembro | null;
  hoy: string;
  onCerrar: () => void;
  onGuardar: (g: {
    monto: number; moneda: string; descripcion: string; pagadoPor: string;
    fecha: string; partes: { usuarioId: string; monto: number }[];
  }) => Promise<void>;
}) {
  const { c } = useTema();
  const e = c.claro ? HOJAS.claro : HOJAS.oscuro;

  const [montoTexto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [moneda, setMoneda] = useState<string>(MONEDAS[0]);
  const [pagadoPor, setPagadoPor] = useState(yo);
  const [miPct, setMiPct] = useState(50);
  const [aMano, setAMano] = useState(false);
  const [pctTexto, setPctTexto] = useState('50');
  const [fecha, setFecha] = useState(hoy);
  const [eligiendoFecha, setEligiendoFecha] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const centavos = aCentavos(montoTexto);
  const texto = limpiarDescripcion(descripcion);
  const puede = centavos !== null && texto.length > 0 && !guardando;

  // El monto se avisa apenas se escribe, no recien al guardar: si el boton
  // queda apagado y nadie dice por que, la unica pista es que no pasa nada.
  const avisoMonto = montoTexto.trim() !== '' && centavos === null
    ? 'Ese monto no se entiende. Probá con algo como 23,50.'
    : null;
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
        monto: centavos, moneda, descripcion: texto, pagadoPor, fecha,
        partes: partes(centavos),
      });
      onCerrar();
    } catch (e) {
      // Con la causa real: un "no se pudo guardar" pelado no deja arreglar
      // nada ni decir que paso.
      setError(e instanceof ErrorApi ? `${e.message} (${e.codigo})` : `${e}`);
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
        {/* El monto sobre fondo oscuro: separa lo que se tipea primero de todo
            lo demas, que ya viene decidido. */}
        <View style={e.tapa}>
          <View style={e.barra}>
            <Pressable onPress={onCerrar} hitSlop={12} disabled={guardando}>
              <Text style={e.cancelar}>Cancelar</Text>
            </Pressable>
            <Text style={e.tituloBarra}>Nuevo gasto</Text>
            <View style={{ width: 66 }} />
          </View>

          <View style={e.montoFila}>
            <Text style={[e.simbolo, centavos === null && e.simboloApagado]}>
              {SIMBOLO[moneda] ?? moneda}
            </Text>
            <TextInput
              style={e.monto}
              value={montoTexto}
              onChangeText={setMonto}
              placeholder="0,00"
              placeholderTextColor={c.suave}
              keyboardType="decimal-pad"
              inputMode="decimal"
              autoFocus
              editable={!guardando}
              selectionColor={c.sobreColor}
            />
          </View>

          <View style={e.monedas}>
            {MONEDAS.map((m) => {
              const puesta = m === moneda;
              return (
                <Pressable
                  key={m}
                  style={[e.moneda, puesta && e.monedaPuesta]}
                  onPress={() => setMoneda(m)}
                >
                  <Text style={[e.monedaTexto, puesta && e.monedaTextoPuesto]}>{m}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          style={e.hoja}
          contentContainerStyle={e.cuerpo}
          keyboardShouldPersistTaps="handled"
        >
          <View style={e.bloque}>
            {/* La fecha va en la fila de la etiqueta y no en su propio bloque.
                Casi siempre es hoy y no se toca; ocupar un bloque entero con
                algo que rara vez se cambia empujaba el reparto fuera de la
                pantalla, que si se toca siempre. */}
            <View style={e.filaEtiqueta}>
              <Text style={e.etiqueta}>¿Qué fue?</Text>
              <Pressable
                style={e.pildoraFecha}
                onPress={() => setEligiendoFecha(true)}
                disabled={guardando}
                hitSlop={8}
              >
                <Text style={e.pildoraFechaTexto}>{cuando(fecha, hoy)} ▾</Text>
              </Pressable>
            </View>
            <View style={e.chips}>
              {ATAJOS_TEXTO.map((x) => {
                const puesto = descripcion.trim() === x;
                return (
                  <Pressable
                    key={x}
                    style={[e.chip, puesto && e.chipPuesto]}
                    onPress={() => setDescripcion(puesto ? '' : x)}
                  >
                    <Text style={[e.chipTexto, puesto && e.chipTextoPuesto]}>{x}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={e.campo}
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="o escribilo vos"
              placeholderTextColor={c.suave}
              editable={!guardando}
              returnKeyType="done"
              maxLength={DESCRIPCION_MAXIMA}
            />
          </View>


          {otro ? (
            <>
              <View style={e.bloque}>
                <Text style={e.etiqueta}>Pagó</Text>
                <View style={e.segmentos}>
                  {[{ clave: yo, texto: 'Yo' }, { clave: otro.usuarioId, texto: nombreOtro }]
                    .map((o) => {
                      const puesto = o.clave === pagadoPor;
                      return (
                        <Pressable
                          key={o.clave}
                          style={[e.segmento, puesto && e.segmentoPuesto]}
                          onPress={() => setPagadoPor(o.clave)}
                        >
                          <Text
                            style={[e.segmentoTexto, puesto && e.segmentoTextoPuesto]}
                            numberOfLines={1}
                          >
                            {o.texto}
                          </Text>
                        </Pressable>
                      );
                    })}
                </View>
              </View>

              <View style={e.bloque}>
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
              </View>

              {/* En plata, que es lo que se discute de verdad. Y debajo, en
                  quien queda la deuda: un 0 / 100 se lee mal al apuro. */}
              {vistaPrevia ? (
                <View style={e.previa}>
                  <View style={e.previaFila}>
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
            <View style={e.bloque}>
              <Text style={e.aviso}>
                Todavía estás solo en el viaje. Sumá a la otra persona para que
                los gastos se repartan.
              </Text>
            </View>
          )}

          {avisoMonto ? <Text style={e.error}>{avisoMonto}</Text> : null}
          {error ? <Text style={e.error}>{error}</Text> : null}
        </ScrollView>

        {eligiendoFecha ? (
          <ElegirFecha
            fecha={fecha} hoy={hoy}
            onElegir={setFecha}
            onCerrar={() => setEligiendoFecha(false)}
          />
        ) : null}

        <View style={e.pie}>
          <Pressable
            style={({ pressed }) => [
              e.guardar, !puede && e.guardarApagado, pressed && puede && e.guardarApretado,
            ]}
            onPress={guardar}
            disabled={!puede}
          >
            {guardando
              ? <ActivityIndicator color={c.sobreTinta} />
              : (
                <Text style={e.guardarTexto}>
                  {centavos === null ? 'Guardar' : `Guardar ${plata(centavos, moneda)}`}
                </Text>
              )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const crear = (c: Paleta) => StyleSheet.create({
  // En claro la tapa es tinta sobre blanco y contrasta sola. En oscuro, tinta
  // sobre tinta serian dos negros pegados, asi que la tapa usa el fondo
  // levantado y el texto va en tinta, no en blanco.
  todo: { flex: 1, backgroundColor: c.claro ? c.tinta : c.fondo },

  tapa: { backgroundColor: c.claro ? c.tinta : c.fondo, paddingBottom: 16 },
  barra: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 10,
  },
  tituloBarra: { fontSize: 16, fontWeight: '600', color: c.claro ? 'rgba(255,255,255,.9)' : c.tinta },
  cancelar: { color: c.claro ? c.sobreColor : c.tinta, fontSize: 16, width: 66 },

  montoFila: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center',
    gap: 8, paddingHorizontal: 20, paddingTop: 10,
  },
  simbolo: { fontSize: 30, fontWeight: '600', color: c.claro ? c.sobreColor : c.suave },
  simboloApagado: { color: c.suave, opacity: .5 },
  monto: {
    fontSize: 56, fontWeight: '700', color: c.claro ? c.sobreColor : c.tinta, letterSpacing: -2,
    minWidth: 120, maxWidth: 260, textAlign: 'left', padding: 0,
    fontVariant: ['tabular-nums'],
  },

  monedas: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  moneda: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.08)',
  },
  monedaPuesta: { backgroundColor: c.papel },
  monedaTexto: { fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,.62)', letterSpacing: .4 },
  monedaTextoPuesto: { color: c.tinta },

  // Se monta sobre el bloque oscuro: la pantalla se lee como dos capas y no
  // como un formulario largo.
  hoja: {
    flex: 1, backgroundColor: c.papel,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  cuerpo: { padding: 20, paddingBottom: 28, gap: 20 },

  bloque: { gap: 9 },
  etiqueta: {
    fontSize: 11.5, fontWeight: '700', color: c.suave,
    textTransform: 'uppercase', letterSpacing: .7,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: c.fondo,
  },
  chipPuesto: { backgroundColor: c.tinta },
  chipTexto: { fontSize: 13.5, fontWeight: '600', color: c.suave },
  chipTextoPuesto: { color: c.sobreTinta },

  campo: {
    borderWidth: 1, borderColor: c.linea, borderRadius: 12,
    paddingHorizontal: 15, paddingVertical: 13, fontSize: 16, color: c.tinta,
  },
  filaEtiqueta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pildoraFecha: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999,
    backgroundColor: c.fondo,
  },
  pildoraFechaTexto: {
    fontSize: 12.5, fontWeight: '600', color: c.tinta, textTransform: 'capitalize',
  },

  segmentos: {
    flexDirection: 'row', backgroundColor: c.fondo, borderRadius: 12, padding: 3,
  },
  segmento: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: 'center' },
  segmentoPuesto: {
    backgroundColor: c.papel,
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.14)',
  },
  segmentoTexto: { fontSize: 14.5, fontWeight: '600', color: c.suave },
  segmentoTextoPuesto: { color: c.tinta },

  pctFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pctEtiqueta: { fontSize: 14.5, color: c.suave },
  pctCampo: {
    borderWidth: 1, borderColor: c.linea, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 17, minWidth: 72,
    textAlign: 'center', color: c.tinta, fontVariant: ['tabular-nums'],
  },

  previa: { backgroundColor: c.fondo, borderRadius: 16, padding: 14, gap: 8 },
  previaFila: { flexDirection: 'row', alignItems: 'center' },
  previaLado: { flex: 1, alignItems: 'center', gap: 3 },
  previaLinea: { width: 1, alignSelf: 'stretch', backgroundColor: c.linea },
  previaQuien: { fontSize: 12, color: c.suave },
  previaMonto: {
    fontSize: 19, fontWeight: '700', color: c.tinta, fontVariant: ['tabular-nums'],
  },
  consecuencia: { fontSize: 13.5, color: c.suave, textAlign: 'center' },

  aviso: { fontSize: 14.5, color: c.suave, lineHeight: 21 },
  error: { color: c.rojo, fontSize: 15, lineHeight: 21 },

  pie: { backgroundColor: c.papel, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 22 },
  guardar: {
    backgroundColor: c.tinta, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', minHeight: 54,
  },
  guardarApagado: { backgroundColor: c.linea },
  guardarApretado: { backgroundColor: c.tinta },
  guardarTexto: { color: c.sobreTinta, fontSize: 16.5, fontWeight: '600' },
});

const HOJAS = { claro: crear(CLARA), oscuro: crear(OSCURA) };
