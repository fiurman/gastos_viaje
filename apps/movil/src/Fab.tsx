/** Boton flotante que se puede arrastrar.
 *
 *  Cargar un gasto es la accion que se repite, asi que el boton vive encima del
 *  contenido. Pero encima del contenido tapa algo, y cual es ese algo depende
 *  de la pantalla y de si sos zurdo o diestro. En vez de adivinar la mejor
 *  posicion, que la elija quien lo usa: se arrastra y se queda donde lo dejes,
 *  tambien entre aperturas. */

import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text } from 'react-native';
import { guardarPreferencia, preferencia } from './local';

const CLAVE = 'fab';
const LADO = 58;
const MARGEN = 18;

/** Cuanto puede moverse el dedo y seguir contando como toque y no arrastre. */
const TOLERANCIA = 6;

interface Caja { ancho: number; alto: number }

export function Fab({
  onPress, caja, color, colorSigno,
}: { onPress: () => void; caja: Caja; color: string; colorSigno: string }) {
  const [listo, setListo] = useState(false);
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const actual = useRef({ x: 0, y: 0 });

  // Dentro de la caja: si la pantalla cambia de tamaño, o el boton quedo
  // guardado fuera de rango, se lo trae de vuelta.
  const encajar = (x: number, y: number) => ({
    x: Math.max(MARGEN, Math.min(x, caja.ancho - LADO - MARGEN)),
    y: Math.max(MARGEN, Math.min(y, caja.alto - LADO - MARGEN)),
  });

  useEffect(() => {
    if (caja.ancho === 0 || caja.alto === 0) return;
    preferencia(CLAVE)
      .then((crudo) => {
        let guardada: { x: number; y: number } | null = null;
        try {
          guardada = crudo ? (JSON.parse(crudo) as { x: number; y: number }) : null;
        } catch {
          guardada = null;
        }
        // Por defecto, abajo a la derecha: donde cae el pulgar de un diestro.
        const inicial = guardada ?? {
          x: caja.ancho - LADO - MARGEN,
          y: caja.alto - LADO - MARGEN,
        };
        const dentro = encajar(inicial.x, inicial.y);
        actual.current = dentro;
        pos.setValue(dentro);
      })
      .catch(() => {})
      .finally(() => setListo(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caja.ancho, caja.alto]);

  // El PanResponder se crea una sola vez, asi que lo que usa adentro tiene que
  // leerse por referencia o quedaria congelado en el primer render.
  const onPressRef = useRef(onPress);
  const encajarRef = useRef(encajar);
  onPressRef.current = onPress;
  encajarRef.current = encajar;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Recien tomamos el gesto cuando el dedo se movio: si no, cada toque
      // quedaria atrapado aca y el boton no abriria nunca la pantalla.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > TOLERANCIA || Math.abs(g.dy) > TOLERANCIA,
      onPanResponderGrant: () => {
        pos.setOffset(actual.current);
        pos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_e, g) => {
        pos.flattenOffset();
        const movio = Math.abs(g.dx) > TOLERANCIA || Math.abs(g.dy) > TOLERANCIA;
        if (!movio) {
          onPressRef.current();
          return;
        }
        const dentro = encajarRef.current(
          actual.current.x + g.dx,
          actual.current.y + g.dy,
        );
        actual.current = dentro;
        Animated.spring(pos, { toValue: dentro, useNativeDriver: false, friction: 7 }).start();
        void guardarPreferencia(CLAVE, JSON.stringify(dentro)).catch(() => {});
      },
    }),
  ).current;

  if (!listo || caja.ancho === 0) return null;

  return (
    <Animated.View
      style={[
        e.fab,
        { backgroundColor: color },
        { transform: pos.getTranslateTransform() },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Cargar un gasto"
      {...responder.panHandlers}
    >
      <Text style={[e.texto, { color: colorSigno }]}>+</Text>
    </Animated.View>
  );
}

const e = StyleSheet.create({
  fab: {
    position: 'absolute', top: 0, left: 0,
    width: LADO, height: LADO, borderRadius: LADO / 2,
    alignItems: 'center', justifyContent: 'center',
    // boxShadow y no shadow*: las props viejas estan deprecadas y avisan en
    // cada render.
    boxShadow: '0px 4px 14px rgba(26, 24, 21, 0.32)',
    elevation: 6,
  },
  // El color lo pone quien lo usa: en oscuro el circulo es claro, asi que un
  // signo blanco fijo quedaria invisible.
  texto: { fontSize: 32, lineHeight: 36, fontWeight: '300' },
});
