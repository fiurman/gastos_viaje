/** Entrar a la app.
 *
 *  Se escribe el mail, llega un codigo de seis digitos, se tipea y listo. Sin
 *  contraseñas: guardarlas es la parte mas facil de hacer mal, y ademas obliga
 *  a construir recuperacion de contraseña, que termina siendo un mail igual.
 *
 *  Un codigo se tipea; un link que abre la app desde el mail depende de como
 *  este configurado el cliente de correo de cada uno y falla seguido en
 *  Android. Seis digitos siempre funcionan.
 *
 *  La sesion dura un año a proposito: el codigo se pide una vez por telefono y
 *  despues la app abre y ya esta adentro. */

import type { Env } from './tipos.ts';
import { mandarCodigo } from './mail.ts';

/** Cuanto vive un codigo. Corto porque viaja por mail y el mail se queda en la
 *  bandeja de entrada para siempre. */
const VIDA_CODIGO_MIN = 10;

/** Intentos antes de quemar el codigo. Seis digitos son un millon de
 *  combinaciones: sin este limite se prueban todas en minutos. */
const MAX_INTENTOS = 5;

/** Un año. El codigo se pide al instalar y no se vuelve a pedir. */
const VIDA_SESION_DIAS = 365;

/** Entre un pedido de codigo y el siguiente, para el mismo mail. Evita que
 *  alguien use el formulario para llenarle la casilla a otro. */
const ESPERA_ENTRE_CODIGOS_SEG = 60;

const ahora = () => new Date().toISOString();

const enMinutos = (n: number) =>
  new Date(Date.now() + n * 60_000).toISOString();

const enDias = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString();

/** Seis digitos con azar criptografico.
 *
 *  `Math.random()` no sirve para esto: es predecible, y quien pueda predecir el
 *  codigo entra a la cuenta de otro. */
function codigoNuevo(): string {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(b[0]! % 1_000_000).padStart(6, '0');
}

/** Token de sesion: 32 bytes de azar en base64url. */
function tokenNuevo(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function idNuevo(): string {
  return crypto.randomUUID();
}

/** HMAC y no un hash pelado.
 *
 *  Un codigo de seis digitos tiene un millon de posibilidades: con SHA-256 a
 *  secas, cualquiera que lea la tabla las prueba todas en milisegundos y
 *  recupera el codigo. Con HMAC hace falta ademas el secreto, que no esta en la
 *  base. Lo mismo para los tokens de sesion. */
async function firmar(secreto: string, dato: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(dato));
  return [...new Uint8Array(firma)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Compara sin cortar en la primera diferencia, para no filtrar el valor por el
 *  tiempo que tarda. */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const normalizar = (email: string) => email.trim().toLowerCase();

/** Paso 1: pedir el codigo.
 *
 *  Responde lo mismo exista o no el mail. Si respondiera distinto, cualquiera
 *  podria averiguar quien tiene cuenta probando direcciones. */
export async function pedirCodigo(
  email: string, env: Env,
): Promise<{ enviado: boolean }> {
  const dir = normalizar(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dir)) return { enviado: false };

  const reciente = await env.DB
    .prepare(`select creado_en from codigos where email = ?
               order by creado_en desc limit 1`)
    .bind(dir).first<{ creado_en: string }>();

  if (reciente) {
    const pasaron = (Date.now() - Date.parse(reciente.creado_en)) / 1000;
    if (pasaron < ESPERA_ENTRE_CODIGOS_SEG) return { enviado: false };
  }

  const codigo = codigoNuevo();
  const hash = await firmar(env.SECRETO, codigo);

  // Se borran los anteriores: un solo codigo vivo por direccion a la vez. Sin
  // esto se acumulan filas y, peor, quedan codigos viejos que siguen siendo
  // validos hasta que vencen.
  await env.DB.batch([
    env.DB.prepare(`delete from codigos where email = ?`).bind(dir),
    env.DB.prepare(`insert into codigos (email, codigo_hash, expira_en, creado_en)
                    values (?, ?, ?, ?)`)
      .bind(dir, hash, enMinutos(VIDA_CODIGO_MIN), ahora()),
  ]);

  // El codigo en claro existe solo dentro de esta funcion: se manda y se
  // olvida. En la base queda su firma, no el.
  return { enviado: await mandarCodigo(env, dir, codigo) };
}

/** Paso 2: canjear el codigo por una sesion.
 *
 *  Si el mail no tenia cuenta, se crea acá. No hay registro aparte: la primera
 *  vez que alguien entra con su mail, queda creado. */
export async function verificarCodigo(
  email: string, codigo: string, dispositivo: string | null, env: Env,
): Promise<{ token: string; usuarioId: string } | { error: string }> {
  const dir = normalizar(email);
  const hash = await firmar(env.SECRETO, codigo.trim());

  const fila = await env.DB
    .prepare(`select rowid, codigo_hash, expira_en, intentos from codigos
               where email = ? order by creado_en desc limit 1`)
    .bind(dir)
    .first<{ rowid: number; codigo_hash: string; expira_en: string; intentos: number }>();

  if (!fila) return { error: 'codigo_invalido' };
  if (Date.parse(fila.expira_en) < Date.now()) return { error: 'codigo_vencido' };
  if (fila.intentos >= MAX_INTENTOS) return { error: 'demasiados_intentos' };

  if (!igual(fila.codigo_hash, hash)) {
    await env.DB.prepare(`update codigos set intentos = intentos + 1 where rowid = ?`)
      .bind(fila.rowid).run();
    return { error: 'codigo_invalido' };
  }

  // Se quema apenas se usa. Un codigo que sirve dos veces sirve para que otro
  // lo use despues si llega a verlo.
  await env.DB.prepare(`delete from codigos where email = ?`).bind(dir).run();

  let usuario = await env.DB
    .prepare(`select id from usuarios where email = ?`)
    .bind(dir).first<{ id: string }>();

  if (!usuario) {
    const id = idNuevo();
    await env.DB.batch([
      env.DB.prepare(`insert into usuarios (id, email, creado_en) values (?, ?, ?)`)
        .bind(id, dir, ahora()),
      env.DB.prepare(`insert into preferencias (usuario_id) values (?)`).bind(id),
    ]);
    usuario = { id };
  }

  const token = tokenNuevo();
  await env.DB
    .prepare(`insert into sesiones (token, usuario_id, dispositivo, creado_en, ultimo_uso)
              values (?, ?, ?, ?, ?)`)
    .bind(await firmar(env.SECRETO, token), usuario.id, dispositivo, ahora(), ahora())
    .run();

  // El token en claro se devuelve una sola vez y no queda guardado en ningun
  // lado del servidor: en la base esta su firma, no el.
  return { token, usuarioId: usuario.id };
}

export interface Sesion {
  usuarioId: string;
  email: string;
  nombre: string | null;
}

/** Quien es el que esta haciendo el pedido, o null si no hay sesion valida. */
export async function quienEs(pedido: Request, env: Env): Promise<Sesion | null> {
  const cabecera = pedido.headers.get('Authorization') ?? '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
  if (!token) return null;

  const firma = await firmar(env.SECRETO, token);
  const fila = await env.DB
    .prepare(`select s.usuario_id, s.creado_en, u.email, u.nombre
                from sesiones s join usuarios u on u.id = s.usuario_id
               where s.token = ?`)
    .bind(firma)
    .first<{ usuario_id: string; creado_en: string; email: string; nombre: string | null }>();

  if (!fila) return null;

  if (Date.parse(fila.creado_en) + VIDA_SESION_DIAS * 86_400_000 < Date.now()) {
    await env.DB.prepare(`delete from sesiones where token = ?`).bind(firma).run();
    return null;
  }

  return { usuarioId: fila.usuario_id, email: fila.email, nombre: fila.nombre };
}

export { enDias, ahora };
