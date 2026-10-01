/** La sesion de este telefono.
 *
 *  El token vive en el almacenamiento seguro del sistema (Keystore en Android),
 *  no en AsyncStorage. Es la llave de la cuenta y dura un año: si alguien saca
 *  una copia de los datos de la app, con AsyncStorage se la lleva en texto
 *  plano. */

import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const CLAVE = 'sesion';

export interface Guardada {
  token: string;
  usuarioId: string;
  email: string;
}

export function useSesion() {
  const [sesion, setSesion] = useState<Guardada | null>(null);
  /** Hasta que no se leyo el almacenamiento no se sabe si hay sesion. Sin esto
   *  la app muestra la pantalla de login un instante a quien ya entro. */
  const [listo, setListo] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(CLAVE)
      .then((crudo) => {
        if (crudo) setSesion(JSON.parse(crudo) as Guardada);
      })
      .catch(() => {})
      .finally(() => setListo(true));
  }, []);

  const entrar = useCallback(async (nueva: Guardada) => {
    await SecureStore.setItemAsync(CLAVE, JSON.stringify(nueva)).catch(() => {});
    setSesion(nueva);
  }, []);

  const salir = useCallback(async () => {
    await SecureStore.deleteItemAsync(CLAVE).catch(() => {});
    setSesion(null);
  }, []);

  return { sesion, listo, entrar, salir };
}
