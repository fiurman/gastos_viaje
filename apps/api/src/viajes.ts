/** Viajes, quienes lo comparten, y la sincronizacion de gastos y pagos. */

import { idNuevo, ahora } from './auth.ts';
import type { Env, Gasto, Parte } from './tipos.ts';

/** Si esta persona pertenece al viaje.
 *
 *  Se pregunta en cada ruta que toca un viaje. Sin esto, cualquiera con una
 *  sesion valida podria leer o escribir en el viaje de otro con solo adivinar
 *  el id. */
export async function esMiembro(
  viajeId: string, usuarioId: string, env: Env,
): Promise<boolean> {
  const f = await env.DB
    .prepare(`select 1 x from miembros where viaje_id = ? and usuario_id = ?`)
    .bind(viajeId, usuarioId).first();
  return f !== null;
}

export async function crearViaje(
  nombre: string, usuarioId: string, env: Env,
): Promise<{ id: string }> {
  const id = idNuevo();
  const t = ahora();
  await env.DB.batch([
    env.DB.prepare(`insert into viajes (id, nombre, creado_por, creado_en, actualizado_en)
                    values (?, ?, ?, ?, ?)`).bind(id, nombre, usuarioId, t, t),
    env.DB.prepare(`insert into miembros (viaje_id, usuario_id, desde) values (?, ?, ?)`)
      .bind(id, usuarioId, t),
  ]);
  return { id };
}

export async function misViajes(usuarioId: string, env: Env) {
  const { results } = await env.DB
    .prepare(`select v.id, v.nombre, v.creado_en
                from viajes v join miembros m on m.viaje_id = v.id
               where m.usuario_id = ?
               order by v.creado_en desc`)
    .bind(usuarioId).all();
  return results;
}

/** Sumar a alguien al viaje por su mail.
 *
 *  Si todavia no tiene cuenta se le crea una: la primera vez que entre con ese
 *  mail va a encontrar el viaje esperandola. No hay invitacion pendiente que
 *  aceptar, que es un estado mas que mantener y una pantalla mas que hacer. */
export async function sumarMiembro(
  viajeId: string, email: string, env: Env,
): Promise<{ usuarioId: string; nuevo: boolean }> {
  const dir = email.trim().toLowerCase();

  let u = await env.DB.prepare(`select id from usuarios where email = ?`)
    .bind(dir).first<{ id: string }>();

  const nuevo = u === null;
  if (!u) {
    const id = idNuevo();
    await env.DB.batch([
      env.DB.prepare(`insert into usuarios (id, email, creado_en) values (?, ?, ?)`)
        .bind(id, dir, ahora()),
      env.DB.prepare(`insert into preferencias (usuario_id) values (?)`).bind(id),
    ]);
    u = { id };
  }

  await env.DB
    .prepare(`insert or ignore into miembros (viaje_id, usuario_id, desde) values (?, ?, ?)`)
    .bind(viajeId, u.id, ahora()).run();

  return { usuarioId: u.id, nuevo };
}

export interface GastoEntrante {
  id: string;
  viajeId: string;
  pagadoPor: string;
  monto: number;
  moneda: string;
  descripcion: string;
  fecha: string;
  /** Cuando lo edito el telefono. Solo sirve para decidir quien gana si dos
   *  ediciones del mismo gasto chocan; el cursor de la sincronizacion lo lleva
   *  el servidor. */
  editadoEn: string;
  borradoEn?: string | null;
  partes: { usuarioId: string; monto: number }[];
}

/** Sincronizar: subir lo que el telefono tenga pendiente y bajar lo que haya
 *  cambiado desde la ultima vez.
 *
 *  Va en un solo viaje de ida y vuelta a proposito. Con señal intermitente, dos
 *  pedidos separados tienen el doble de posibilidades de que uno falle y el
 *  telefono quede a medio sincronizar.
 *
 *  El que edito mas tarde gana, por `editado_en`, que lo pone el telefono. Es
 *  suficiente porque los gastos casi siempre son agregar: dos personas cargando
 *  cosas distintas sin señal no chocan nunca. Solo chocarian editando el mismo
 *  gasto a la vez, que entre dos personas en un viaje no pasa.
 *
 *  El cursor de la sincronizacion, en cambio, es `actualizado_en` y lo pone el
 *  SERVIDOR. Usar para eso el reloj del telefono rompia todo: uno adelantado
 *  baja sus gastos siempre, uno atrasado no los baja nunca. Y en un viaje los
 *  telefonos cambian de huso horario. */
export async function sincronizar(
  viajeId: string, desde: string | null, entrantes: GastoEntrante[],
  usuarioId: string, env: Env,
): Promise<{ gastos: unknown[]; partes: unknown[]; hasta: string }> {
  const hasta = ahora();

  for (const g of entrantes) {
    // Un gasto que llega con un viaje que no es este no se escribe. El
    // telefono no deberia mandarlo, pero el servidor no confia en el telefono.
    if (g.viajeId !== viajeId) continue;

    await env.DB.batch([
      env.DB.prepare(
        `insert into gastos (id, viaje_id, pagado_por, monto, moneda, descripcion,
                             fecha, creado_por, creado_en, actualizado_en,
                             editado_en, borrado_en)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict(id) do update set
           pagado_por = excluded.pagado_por,
           monto = excluded.monto,
           moneda = excluded.moneda,
           descripcion = excluded.descripcion,
           fecha = excluded.fecha,
           actualizado_en = excluded.actualizado_en,
           editado_en = excluded.editado_en,
           borrado_en = excluded.borrado_en
         where excluded.editado_en > gastos.editado_en
           -- Y que la fila que ya estaba sea de ESTE viaje. Sin esto, un
           -- miembro de un viaje podia pisar un gasto de otro mandando su id:
           -- el conflicto se resuelve por id, que es global.
           and gastos.viaje_id = excluded.viaje_id`)
        .bind(g.id, viajeId, g.pagadoPor, Math.round(g.monto), g.moneda,
              g.descripcion, g.fecha, usuarioId, hasta, hasta,
              g.editadoEn, g.borradoEn ?? null),

      // Las partes tambien se limitan a gastos de este viaje, por lo mismo.
      env.DB.prepare(
        `delete from partes where gasto_id in
           (select id from gastos where id = ? and viaje_id = ?)`).bind(g.id, viajeId),

      ...g.partes.map((p) =>
        env.DB.prepare(
          `insert into partes (gasto_id, usuario_id, monto)
           select ?, ?, ? where exists
             (select 1 from gastos where id = ? and viaje_id = ?)`)
          .bind(g.id, p.usuarioId, Math.round(p.monto), g.id, viajeId)),
    ]);
  }

  const corte = desde ?? '1970-01-01T00:00:00.000Z';

  const [gastos, partes] = await env.DB.batch([
    env.DB.prepare(`select * from gastos where viaje_id = ? and actualizado_en > ?`)
      .bind(viajeId, corte),
    env.DB.prepare(
      `select p.* from partes p join gastos g on g.id = p.gasto_id
        where g.viaje_id = ? and g.actualizado_en > ?`).bind(viajeId, corte),
  ]);

  return {
    gastos: gastos!.results as Gasto[],
    partes: partes!.results as Parte[],
    hasta,
  };
}
