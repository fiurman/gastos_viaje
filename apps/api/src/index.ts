/** La API.
 *
 *  Router a mano, sin framework: son pocas rutas y una dependencia menos es una
 *  dependencia que no hay que auditar ni actualizar. */

import { pedirCodigo, quienEs, verificarCodigo, type Sesion } from './auth.ts';
import { saldoDelViaje } from './saldo.ts';
import type { Env } from './tipos.ts';
import {
  crearViaje, esMiembro, misViajes, sincronizar, sumarMiembro,
  type GastoEntrante,
} from './viajes.ts';

const json = (dato: unknown, estado = 200) =>
  new Response(JSON.stringify(dato), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const error = (mensaje: string, estado = 400) => json({ error: mensaje }, estado);

/** Lee el cuerpo como JSON sin tirar. Un cuerpo roto es un pedido mal hecho,
 *  no un error del servidor. */
async function cuerpo<T>(pedido: Request): Promise<T | null> {
  try {
    return (await pedido.json()) as T;
  } catch {
    return null;
  }
}

type Params = Record<string, string>;

type Manejador = (contexto: {
  pedido: Request;
  env: Env;
  ctx: ExecutionContext;
  quien: Sesion;
  params: Params;
}) => Promise<Response> | Response;

interface Ruta {
  metodo: string;
  /** Con `:nombre` para las partes variables. */
  camino: string;
  /** Si necesita sesion. Se declara acá y no adentro del manejador para que no
   *  se pueda olvidar: una ruta nueva sin este campo no compila. */
  privada: boolean;
  /** Si la ruta lleva `:viajeId`, se comprueba que quien pide sea miembro antes
   *  de llamar al manejador. Sin esto, cualquiera con sesion podria leer el
   *  viaje de otro adivinando el id. */
  manejador: Manejador;
}

/** Compara el camino de una ruta contra el pedido y saca los parametros. */
function calza(camino: string, pathname: string): Params | null {
  const a = camino.split('/');
  const b = pathname.split('/');
  if (a.length !== b.length) return null;

  const params: Params = {};
  for (let i = 0; i < a.length; i++) {
    const trozo = a[i]!;
    if (trozo.startsWith(':')) {
      if (!b[i]) return null;
      params[trozo.slice(1)] = decodeURIComponent(b[i]!);
    } else if (trozo !== b[i]) {
      return null;
    }
  }
  return params;
}

const rutas: Ruta[] = [
  {
    metodo: 'POST', camino: '/entrar', privada: false,
    async manejador({ pedido, env }) {
      const datos = await cuerpo<{ email?: string }>(pedido);
      if (!datos?.email) return error('falta_email');

      const { enviado } = await pedirCodigo(datos.email, env);

      // Se responde lo mismo haya salido o no el mail, y exista o no la
      // cuenta. Responder distinto dejaria averiguar quien tiene cuenta
      // probando direcciones.
      return json({ ok: true, enviado });
    },
  },

  {
    metodo: 'POST', camino: '/verificar', privada: false,
    async manejador({ pedido, env }) {
      const datos = await cuerpo<{ email?: string; codigo?: string; dispositivo?: string }>(pedido);
      if (!datos?.email || !datos.codigo) return error('faltan_datos');

      const r = await verificarCodigo(datos.email, datos.codigo, datos.dispositivo ?? null, env);
      if ('error' in r) return error(r.error, 401);

      return json({ token: r.token, usuarioId: r.usuarioId });
    },
  },

  {
    metodo: 'GET', camino: '/yo', privada: true,
    manejador: ({ quien }) => json(quien),
  },

  {
    metodo: 'POST', camino: '/push', privada: true,
    async manejador({ pedido, env, quien }) {
      const datos = await cuerpo<{ pushToken?: string }>(pedido);
      if (!datos?.pushToken) return error('falta_token');

      // Se guarda en la sesion y no en el usuario: el token es del telefono.
      // La misma persona con dos telefonos recibe el aviso en los dos.
      await env.DB.prepare(`update sesiones set push_token = ? where usuario_id = ?`)
        .bind(datos.pushToken, quien.usuarioId).run();

      return json({ ok: true });
    },
  },

  {
    metodo: 'GET', camino: '/viajes', privada: true,
    async manejador({ env, quien }) {
      return json(await misViajes(quien.usuarioId, env));
    },
  },

  {
    metodo: 'POST', camino: '/viajes', privada: true,
    async manejador({ pedido, env, quien }) {
      const datos = await cuerpo<{ nombre?: string }>(pedido);
      const nombre = datos?.nombre?.trim();
      if (!nombre) return error('falta_nombre');

      return json(await crearViaje(nombre, quien.usuarioId, env), 201);
    },
  },

  {
    metodo: 'POST', camino: '/viajes/:viaje/invitar', privada: true,
    async manejador({ pedido, env, quien, params }) {
      if (!(await esMiembro(params.viaje!, quien.usuarioId, env))) {
        return error('no_es_tuyo', 403);
      }
      const datos = await cuerpo<{ email?: string }>(pedido);
      if (!datos?.email) return error('falta_email');

      return json(await sumarMiembro(params.viaje!, datos.email, env));
    },
  },

  {
    metodo: 'GET', camino: '/viajes/:viaje/saldo', privada: true,
    async manejador({ env, quien, params }) {
      if (!(await esMiembro(params.viaje!, quien.usuarioId, env))) {
        return error('no_es_tuyo', 403);
      }
      return json(await saldoDelViaje(params.viaje!, env));
    },
  },

  {
    metodo: 'POST', camino: '/viajes/:viaje/sync', privada: true,
    async manejador({ pedido, env, quien, params }) {
      if (!(await esMiembro(params.viaje!, quien.usuarioId, env))) {
        return error('no_es_tuyo', 403);
      }
      const datos = await cuerpo<{ desde?: string; gastos?: GastoEntrante[] }>(pedido);

      return json(await sincronizar(
        params.viaje!, datos?.desde ?? null, datos?.gastos ?? [], quien.usuarioId, env,
      ));
    },
  },
];

export default {
  async fetch(pedido: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(pedido.url);

    let elegida: { ruta: Ruta; params: Params } | null = null;
    for (const ruta of rutas) {
      if (ruta.metodo !== pedido.method) continue;
      const params = calza(ruta.camino, url.pathname);
      if (params) { elegida = { ruta, params }; break; }
    }
    if (!elegida) return error('no_existe', 404);

    let quien: Sesion | null = null;
    if (elegida.ruta.privada) {
      quien = await quienEs(pedido, env);
      if (!quien) return error('sin_sesion', 401);
    }

    try {
      return await elegida.ruta.manejador({
        pedido, env, ctx, quien: quien as Sesion, params: elegida.params,
      });
    } catch (e) {
      // El detalle va a los logs, no a la respuesta: un mensaje de error de la
      // base le cuenta a cualquiera como esta armada por dentro.
      console.error(`${pedido.method} ${url.pathname}`, e);
      return error('error_interno', 500);
    }
  },
};
