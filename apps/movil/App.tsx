import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  useFonts, Fraunces_600SemiBold, Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Entrar } from './src/pantallas/Entrar';
import { Viaje } from './src/pantallas/Viaje';
import { useSesion } from './src/sesion';

function App() {
  const { sesion, listo, entrar, salir } = useSesion();
  // Una serif para los montos en una app de gastos no la tiene nadie, y es lo
  // que mas separa esta pantalla de cualquier otra de Android. Los textos de
  // interfaz siguen en la del sistema: la personalidad va en los numeros, no
  // en los botones.
  const [tipografia] = useFonts({ Fraunces_600SemiBold, Fraunces_700Bold });
  // Los margenes del sistema a mano: en Android la barra de navegacion tapa lo
  // de abajo si no se los respeta.
  const bordes = useSafeAreaInsets();

  // Mientras se lee el almacenamiento no se sabe si hay sesion. Sin esto, a
  // quien ya entro le parpadea la pantalla de login cada vez que abre la app.
  if (!listo || !tipografia) {
    return (
      <View style={[e.todo, e.centrado]}>
        <ActivityIndicator size="large" color="#1a1815" />
      </View>
    );
  }

  return (
    <View style={[e.todo, { paddingTop: bordes.top, paddingBottom: bordes.bottom }]}>
      <StatusBar style="dark" />
      {sesion ? (
        <Viaje
          token={sesion.token}
          usuarioId={sesion.usuarioId}
          email={sesion.email}
          onSalir={salir}
        />
      ) : (
        <Entrar onEntro={entrar} />
      )}
    </View>
  );
}

/** El proveedor de margenes tiene que envolver a quien los pide, asi que el
 *  componente de arriba no puede pedirlos el mismo. */
export default function Raiz() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

const e = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#fff' },
  centrado: { alignItems: 'center', justifyContent: 'center' },
});
