/** Los datos del viaje.
 *
 *  La base del telefono manda. La pantalla lee de ahi siempre, y el servidor es
 *  algo que pasa por atras cuando hay red. Por eso cargar un gasto sin señal
 *  funciona igual y el saldo se ve igual: las dos cosas salen de lo local.
 *
 *  El saldo se calcula acá y tambien en el servidor. Es duplicacion a
 *  proposito: un saldo que necesita internet no sirve justo cuando mas lo
 *  necesitas, parado en la caja decidiendo quien paga. */

import { useCallback, useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { api, ErrorApi, type SaldoUsuario } from './api';
import { calcularSaldo } from './cuentas';
import {
  cursor, elegirViaje, guardarBajados, guardarCursor, guardarLocal, guardarViaje,
  leerGastos, leerViaje, limpiar, pendientes, viajeElegido, type GastoLocal,
} from './local';

export type Gasto = GastoLocal;

export interface Miembro { usuarioId: string; email: string }

export { MONEDAS, plata, aCentavos, repartir, calcularSaldo, cuando } from './cuentas';
export type { NetoPorMoneda } from './cuentas';

export function useViaje(token: string, usuarioId: string) {
  const [viaje, setViaje] = useState<{ id: string; nombre: string } | null>(null);
  const [todos, setTodos] = useState<{ id: string; nombre: string; miembros: number }[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinRed, setSinRed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescarPantalla = useCallback(async (viajeId: string) => {
    setGastos(await leerGastos(viajeId));
  }, []);

  /** Sube lo pendiente y baja lo nuevo. Si no hay red no pasa nada malo: queda
   *  todo guardado y se reintenta la proxima vez. */
  const sincronizar = useCallback(async (viajeId: string) => {
    const porSubir = await pendientes(viajeId);
    const desde = await cursor(viajeId);
    const r = await api.sincronizar(token, viajeId, desde, porSubir);
    await guardarBajados(r.gastos, r.partes, porSubir.map((g) => g.id));
    await guardarCursor(viajeId, r.hasta);
    await refrescarPantalla(viajeId);
  }, [token, refrescarPantalla]);

  const traer = useCallback(async () => {
    setError(null);
    try {
      // Primero lo guardado: la pantalla se dibuja al instante y con datos,
      // haya red o no.
      const guardado = await leerViaje();
      if (guardado) {
        setViaje({ id: guardado.id, nombre: guardado.nombre });
        setMiembros(guardado.miembros);
        await refrescarPantalla(guardado.id);
        setCargando(false);
      }

      const lista = await api.viajes(token);
      setTodos(lista.map((x) => ({ id: x.id, nombre: x.nombre, miembros: x.miembros })));

      // El que la persona venia mirando gana siempre. Si no hay ninguno
      // elegido, el servidor ya los manda con el mas probable primero: el
      // compartido y con gastos, no el vacio que se pudo haber creado solo.
      const guardadoId = await viajeElegido();
      const elegido = lista.find((x) => x.id === guardadoId) ?? lista[0];
      const v = elegido
        ? { id: elegido.id, nombre: elegido.nombre }
        : { id: (await api.crearViaje(token, 'Nuestro viaje')).id, nombre: 'Nuestro viaje' };
      setViaje(v);
      await elegirViaje(v.id);

      const saldoServidor: SaldoUsuario[] = await api.saldo(token, v.id);
      const gente = saldoServidor.map((s) => ({ usuarioId: s.usuarioId, email: s.email }));
      setMiembros(gente);
      await guardarViaje(v.id, v.nombre, gente);

      await sincronizar(v.id);
      setSinRed(false);
    } catch (e) {
      // Sin red no es un error que haya que mostrar en rojo si ya tenemos datos
      // guardados: la app funciona igual, solo que no esta al dia.
      if (e instanceof ErrorApi && e.codigo === 'sin_red') setSinRed(true);
      else setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar.');
    } finally {
      setCargando(false);
    }
  }, [token, refrescarPantalla, sincronizar]);

  useEffect(() => { void traer();
    // Solo al abrir. `traer` cambia de identidad en cada render y volveria a
    // dispararse en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agregar = useCallback(async (nuevo: {
    monto: number; moneda: string; descripcion: string; pagadoPor: string;
    partes: { usuarioId: string; monto: number }[];
  }) => {
    if (!viaje) return;

    const gasto = {
      id: Crypto.randomUUID(),
      viajeId: viaje.id,
      pagadoPor: nuevo.pagadoPor,
      monto: nuevo.monto,
      moneda: nuevo.moneda,
      descripcion: nuevo.descripcion,
      fecha: new Date().toISOString().slice(0, 10),
      // Quien lo carga es quien despues lo puede borrar. El servidor tambien
      // lo exige: esconder el boton no alcanza.
      creadoPor: usuarioId,
      editadoEn: new Date().toISOString(),
      borradoEn: null,
      partes: nuevo.partes,
    };

    // Primero local. La pantalla muestra el gasto antes de que el servidor se
    // entere, que es lo que hace que cargar sin señal se sienta igual que con
    // señal.
    await guardarLocal(gasto);
    await refrescarPantalla(viaje.id);

    try {
      await sincronizar(viaje.id);
      setSinRed(false);
    } catch (e) {
      // Queda pendiente y se sube solo la proxima vez. No hay nada que avisar
      // ni nada que reintentar a mano.
      if (e instanceof ErrorApi && e.codigo === 'sin_red') setSinRed(true);
    }
  }, [viaje, usuarioId, refrescarPantalla, sincronizar]);

  /** Borra un gasto.
   *
   *  Se marca borrado, no se saca de la base: el otro telefono tiene que poder
   *  enterarse de que ya no esta. Si se borrara de verdad, el que estuvo sin
   *  señal lo volveria a subir como si fuera nuevo. */
  const borrar = useCallback(async (gasto: Gasto) => {
    if (!viaje) return;
    await guardarLocal({
      ...gasto,
      borradoEn: new Date().toISOString(),
      editadoEn: new Date().toISOString(),
    });
    await refrescarPantalla(viaje.id);
    try {
      await sincronizar(viaje.id);
      setSinRed(false);
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'sin_red') setSinRed(true);
    }
  }, [viaje, refrescarPantalla, sincronizar]);

  /** Borra todos los gastos, en el servidor y en los dos telefonos.
   *
   *  El servidor los marca borrados y la sincronizacion siguiente los hace
   *  desaparecer de cada telefono. No se tocan las bases locales a mano: si se
   *  vaciara solo la de acá, el otro telefono los seguiria viendo. */
  const vaciar = useCallback(async () => {
    if (!viaje) return;
    await api.vaciar(token, viaje.id, viaje.nombre);
    await sincronizar(viaje.id);
  }, [token, viaje, sincronizar]);

  /** Cambiar de viaje. Queda recordado. */
  const cambiar = useCallback(async (id: string, nombre: string) => {
    setViaje({ id, nombre });
    await elegirViaje(id);
    setGastos(await leerGastos(id));
    try { await sincronizar(id); } catch { /* sin red: se vera lo local */ }
  }, [sincronizar]);

  const salir = useCallback(async () => {
    // Los gastos de una cuenta no tienen por que quedar visibles para la
    // siguiente que entre en este telefono.
    await limpiar();
  }, []);

  const otro = miembros.find((m) => m.usuarioId !== usuarioId) ?? null;
  const miSaldo = calcularSaldo(gastos, usuarioId);
  const porSubir = gastos.filter((g) => g.pendiente).length;

  return {
    viaje, todos, gastos, miembros, otro, miSaldo, porSubir,
    cargando, sinRed, error, traer, agregar, borrar, vaciar, salir, cambiar,
  };
}
