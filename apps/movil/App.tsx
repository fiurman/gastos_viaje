import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import {
  useFonts, Fraunces_600SemiBold, Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Entrar } from './src/pantallas/Entrar';
import { Viaje } from './src/pantallas/Viaje';
import { guardarPreferencia, preferencia } from './src/local';
import { useSesion } from './src/sesion';
import { CLARA, OSCURA, TemaContexto, type Modo } from './src/tema';

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

  const delSistema = useColorScheme();
  const [modo, setModo] = useState<Modo>('sistema');
  const [temaListo, setTemaListo] = useState(false);

  useEffect(() => {
    preferencia('tema')
      .then((x) => { if (x === 'claro' || x === 'oscuro') setModo(x); })
      .catch(() => {})
      .finally(() => setTemaListo(true));
  }, []);

  const cambiarModo = useCallback((m: Modo) => {
    setModo(m);
    void guardarPreferencia('tema', m).catch(() => {});
  }, []);

  const oscuro = modo === 'oscuro' || (modo === 'sistema' && delSistema === 'dark');
  const c = oscuro ? OSCURA : CLARA;

  // Mientras se lee el almacenamiento no se sabe ni si hay sesion ni que tema
  // va. Sin esto, a quien ya entro le parpadea el login, y a quien tiene el
  // oscuro puesto le parpadea una pantalla blanca.
  if (!listo || !tipografia || !temaListo) {
    return (
      <View style={{ flex: 1, backgroundColor: c.papel, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={c.tinta} />
      </View>
    );
  }

  return (
    <TemaContexto.Provider value={{ c, modo, cambiarModo }}>
      <View
        style={{
          flex: 1, backgroundColor: c.papel,
          paddingTop: bordes.top, paddingBottom: bordes.bottom,
        }}
      >
        <StatusBar style={oscuro ? 'light' : 'dark'} />
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
    </TemaContexto.Provider>
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
