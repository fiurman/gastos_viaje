/** Hablar con el servidor.
 *
 *  Todo lo que sale de la app pasa por acá. Dos cosas que valen para cada
 *  pedido:
 *
 *  - **Hay timeout.** Sin el, un telefono con una barra de señal se queda
 *    esperando para siempre y la app parece colgada. Es el escenario normal
 *    adentro de un restaurante en otro pais, no el raro.
 *  - **Los errores vienen con un mensaje en castellano.** El codigo que manda
 *    el servidor (`codigo_vencido`) sirve para programar; a la persona que esta
 *    parada en la caja hay que decirle que paso. */

const URL_BASE =
  process.env.EXPO_PUBLIC_API ?? 'https://gastos-viaje.francoiurman.workers.dev';

/** Generoso: una red de celular lenta tarda, y reintentar de mas es peor que
 *  esperar un poco. */
const TIMEOUT_MS = 20_000;

/** Lo que el servidor contesta, traducido.
 *
 *  Un error tecnico en la pantalla no ayuda a nadie: la persona no puede hacer
 *  nada con "codigo_vencido". El detalle queda en `codigo` por si hace falta
 *  distinguirlos al programar. */
const MENSAJES: Record<string, string> = {
  codigo_invalido: 'Ese código no es correcto. Fijate que esté bien copiado.',
  codigo_vencido: 'El código ya venció. Pedí uno nuevo.',
  demasiados_intentos: 'Demasiados intentos. Pedí un código nuevo.',
  sin_sesion: 'Se cerró la sesión. Entrá de nuevo.',
  no_es_tuyo: 'Ese viaje no es tuyo.',
  falta_email: 'Escribí tu dirección de mail.',
  faltan_datos: 'Faltan datos.',
  confirmacion_no_coincide: 'El nombre del viaje no coincide. Volvé a abrir la app y probá de nuevo.',
  no_existe: 'Esa función todavía no está en el servidor. Hay que publicarlo.',
  error_interno: 'Algo falló del lado del servidor. Probá de nuevo en un rato.',
  sin_red: 'No hay conexión. Lo que cargues se va a guardar y subir solo.',
};

export class ErrorApi extends Error {
  constructor(readonly codigo: string, readonly estado: number) {
    super(MENSAJES[codigo] ?? 'No se pudo completar. Probá de nuevo.');
  }
}

async function pedir<T>(
  ruta: string,
  opciones: { metodo?: string; cuerpo?: unknown; token?: string | null } = {},
): Promise<T> {
  const cabeceras: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opciones.token) cabeceras.Authorization = `Bearer ${opciones.token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_BASE}${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: cabeceras,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Sin red, o tardo demasiado. Para la app es lo mismo: no se pudo.
    throw new ErrorApi('sin_red', 0);
  }

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({})) as { error?: string };
    throw new ErrorApi(datos.error ?? 'error_interno', respuesta.status);
  }

  return (await respuesta.json()) as T;
}

export const api = {
  /** Paso 1 del login: pedir el codigo. */
  pedirCodigo: (email: string) =>
    pedir<{ ok: true; enviado: boolean }>('/entrar', {
      metodo: 'POST', cuerpo: { email },
    }),

  /** Paso 2: canjearlo por una sesion. */
  verificar: (email: string, codigo: string, dispositivo: string) =>
    pedir<{ token: string; usuarioId: string }>('/verificar', {
      metodo: 'POST', cuerpo: { email, codigo, dispositivo },
    }),

  yo: (token: string) =>
    pedir<{ usuarioId: string; email: string; nombre: string | null }>('/yo', { token }),

  viajes: (token: string) =>
    pedir<{ id: string; nombre: string; creado_en: string;
            miembros: number; gastos: number }[]>('/viajes', { token }),

  crearViaje: (token: string, nombre: string) =>
    pedir<{ id: string }>('/viajes', { metodo: 'POST', cuerpo: { nombre }, token }),

  invitar: (token: string, viaje: string, email: string) =>
    pedir<{ usuarioId: string; nuevo: boolean }>(`/viajes/${viaje}/invitar`, {
      metodo: 'POST', cuerpo: { email }, token,
    }),

  saldo: (token: string, viaje: string) =>
    pedir<SaldoUsuario[]>(`/viajes/${viaje}/saldo`, { token }),

  /** Borra todos los gastos del viaje, para los dos.
   *
   *  Pide el nombre del viaje como confirmacion. El servidor lo compara y
   *  rechaza si no coincide: una llamada que vacia todo sin confirmar se
   *  dispara sola el dia que algo la invoque por error. */
  vaciar: (token: string, viaje: string, nombre: string) =>
    pedir<{ borrados: number }>(`/viajes/${viaje}/vaciar`, {
      metodo: 'POST', cuerpo: { confirmar: nombre }, token,
    }),

  /** Sube lo que haya pendiente y baja lo que cambio desde `desde`.
   *
   *  Un solo viaje de ida y vuelta: con señal intermitente, dos pedidos
   *  separados tienen el doble de posibilidades de que uno falle y el telefono
   *  quede a medio sincronizar. */
  sincronizar: (token: string, viaje: string, desde: string | null, gastos: GastoSubida[]) =>
    pedir<{ gastos: GastoBajado[]; partes: ParteBajada[]; hasta: string }>(
      `/viajes/${viaje}/sync`, { metodo: 'POST', cuerpo: { desde, gastos }, token },
    ),
};

/** Como sale un gasto de la app hacia el servidor. */
export interface GastoSubida {
  id: string;
  viajeId: string;
  pagadoPor: string;
  /** Centavos, entero. Nunca decimales. */
  monto: number;
  moneda: string;
  descripcion: string;
  fecha: string;
  creadoPor: string | null;
  /** El reloj del telefono. Solo decide quien gana si dos ediciones chocan; el
   *  cursor de la sincronizacion lo lleva el servidor. */
  editadoEn: string;
  borradoEn?: string | null;
  partes: { usuarioId: string; monto: number }[];
}

export interface GastoBajado {
  id: string;
  viaje_id: string;
  pagado_por: string;
  monto: number;
  moneda: string;
  descripcion: string;
  fecha: string;
  creado_por: string | null;
  actualizado_en: string;
  borrado_en: string | null;
}

export interface ParteBajada {
  gasto_id: string;
  usuario_id: string;
  monto: number;
}

export interface SaldoUsuario {
  usuarioId: string;
  email: string;
  nombre: string | null;
  monedas: { moneda: string; neto: number; puso: number; leToca: number }[];
}
