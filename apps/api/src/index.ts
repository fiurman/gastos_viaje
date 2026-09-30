/** La API.
 *
 *  Router a mano, sin framework: son pocas rutas y una dependencia menos es una
 *  dependencia que no hay que auditar ni actualizar. */

import { pedirCodigo, quienEs, verificarCodigo, type Sesion } from './auth.ts';
import type { Env } from './tipos.ts';

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

type Manejador = (
  pedido: Request, env: Env, ctx: ExecutionContext, quien: Sesion | null,
) => Promise<Response> | Response;

interface Ruta {
  metodo: string;
  camino: string;
  /** Si la ruta necesita sesion. Se declara acá y no adentro del manejador
   *  para que no se pueda olvidar: una ruta nueva sin este campo no compila. */
  privada: boolean;
  manejador: Manejador;
}

const rutas: Ruta[] = [
  {
    metodo: 'POST', camino: '/entrar', privada: false,
    async manejador(pedido, env) {
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
    async manejador(pedido, env) {
      const datos = await cuerpo<{ email?: string; codigo?: string; dispositivo?: string }>(pedido);
      if (!datos?.email || !datos.codigo) return error('faltan_datos');

      const r = await verificarCodigo(
        datos.email, datos.codigo, datos.dispositivo ?? null, env,
      );
      if ('error' in r) return error(r.error, 401);

      return json({ token: r.token, usuarioId: r.usuarioId });
    },
  },

  {
    metodo: 'GET', camino: '/yo', privada: true,
    manejador(_pedido, _env, _ctx, quien) {
      return json(quien);
    },
  },

  {
    metodo: 'POST', camino: '/push', privada: true,
    async manejador(pedido, env, _ctx, quien) {
      const datos = await cuerpo<{ pushToken?: string }>(pedido);
      if (!datos?.pushToken) return error('falta_token');

      // Se guarda en la sesion y no en el usuario: el token es del telefono.
      // La misma persona con dos telefonos recibe el aviso en los dos.
      await env.DB
        .prepare(`update sesiones set push_token = ? where usuario_id = ?`)
        .bind(datos.pushToken, quien!.usuarioId)
        .run();

      return json({ ok: true });
    },
  },
];

export default {
  async fetch(pedido: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(pedido.url);

    const ruta = rutas.find(
      (r) => r.metodo === pedido.method && r.camino === url.pathname,
    );
    if (!ruta) return error('no_existe', 404);

    let quien: Sesion | null = null;
    if (ruta.privada) {
      quien = await quienEs(pedido, env);
      if (!quien) return error('sin_sesion', 401);
    }

    try {
      return await ruta.manejador(pedido, env, ctx, quien);
    } catch (e) {
      // El detalle va a los logs, no a la respuesta: un mensaje de error de la
      // base le cuenta a cualquiera como esta armada por dentro.
      console.error(`${pedido.method} ${url.pathname}`, e);
      return error('error_interno', 500);
    }
  },
};
