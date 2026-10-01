/** Elegir el día de un gasto.
 *
 *  Casi siempre es hoy, asi que hoy viene puesto y no hay que tocar nada. Pero
 *  los gastos se olvidan y se cargan al otro dia, o se anota por adelantado lo
 *  que se va a pagar, asi que se puede mover en las dos direcciones.
 *
 *  Reusa la misma grilla que la pestaña del calendario en vez de sumar una
 *  libreria de fechas: ya esta escrita, ya esta probada, y asi las dos
 *  pantallas se ven iguales. */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { correrMes, nombreDelMes, semanasDelMes } from '../datos';
import { CLARA, OSCURA, SERIF_MEDIA, useTema, type Paleta } from '../tema';

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function ElegirFecha({
  fecha, hoy, onElegir, onCerrar,
}: {
  fecha: string;
  hoy: string;
  onElegir: (f: string) => void;
  onCerrar: () => void;
}) {
  const { c } = useTema();
  const e = c.claro ? HOJAS.claro : HOJAS.oscuro;
  const [mes, setMes] = useState(fecha.slice(0, 7));

  const ayer = new Date(Date.parse(`${hoy}T00:00:00Z`) - 86_400_000)
    .toISOString().slice(0, 10);

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onCerrar}>
      <Pressable style={e.telon} onPress={onCerrar}>
        {/* El toque adentro de la hoja no cierra: solo el de afuera. */}
        <Pressable style={e.hoja} onPress={() => {}}>
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
            {DIAS.map((d, i) => <Text key={i} style={e.encabezadoDia}>{d}</Text>)}
          </View>

          <ScrollView>
            {semanasDelMes(mes).map((semana, i) => (
              <View key={i} style={e.semana}>
                {semana.map((f, j) => {
                  if (!f) return <View key={j} style={e.celda} />;
                  const elegida = f === fecha;
                  return (
                    <Pressable key={j} style={e.celda} onPress={() => { onElegir(f); onCerrar(); }}>
                      <View style={[e.dia, elegida && e.diaElegido]} />
                      <Text style={[e.numero, elegida && e.numeroElegido, f === hoy && e.numeroHoy]}>
                        {Number(f.slice(8))}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={e.atajos}>
            {[{ f: hoy, t: 'Hoy' }, { f: ayer, t: 'Ayer' }].map((a) => (
              <Pressable
                key={a.t}
                style={e.atajo}
                onPress={() => { setMes(a.f.slice(0, 7)); onElegir(a.f); onCerrar(); }}
              >
                <Text style={e.atajoTexto}>{a.t}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const crear = (c: Paleta) => StyleSheet.create({
  telon: {
    flex: 1, backgroundColor: 'rgba(0,0,0,.45)',
    alignItems: 'center', justifyContent: 'center', padding: 22,
  },
  hoja: {
    width: '100%', maxWidth: 400, maxHeight: '80%',
    backgroundColor: c.papel, borderRadius: 18, padding: 16,
  },
  barraMes: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 10,
  },
  mes: {
    fontFamily: SERIF_MEDIA, fontSize: 18, color: c.tinta, textTransform: 'capitalize',
  },
  flecha: { paddingHorizontal: 12 },
  flechaTexto: { fontSize: 26, color: c.suave, lineHeight: 30 },

  encabezadoDias: { flexDirection: 'row', paddingBottom: 4 },
  encabezadoDia: {
    flex: 1, textAlign: 'center', fontSize: 10.5, fontWeight: '700', color: c.suave,
  },

  semana: { flexDirection: 'row' },
  celda: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dia: { position: 'absolute', top: 3, right: 3, bottom: 3, left: 3, borderRadius: 8 },
  diaElegido: { backgroundColor: c.graficos[0] },
  numero: { fontSize: 14, color: c.tinta, fontVariant: ['tabular-nums'] },
  numeroElegido: { color: '#ffffff', fontWeight: '700' },
  numeroHoy: { fontWeight: '900' },

  atajos: {
    flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: c.linea,
  },
  atajo: {
    flex: 1, paddingVertical: 11, alignItems: 'center',
    borderWidth: 1, borderColor: c.linea, borderRadius: 2,
  },
  atajoTexto: { fontSize: 13.5, fontWeight: '600', color: c.tinta },
});

const HOJAS = { claro: crear(CLARA), oscuro: crear(OSCURA) };
