/** La base del telefono.
 *
 *  Es la fuente de verdad de la pantalla. La app escribe acá primero, muestra
 *  el resultado, y recien despues intenta subirlo. Al reves —esperar al
 *  servidor para mostrar— la app se cuelga cada vez que no hay señal, que
 *  adentro de un restaurante en otro pais es casi siempre.
 *
 *  Lo que hace esto viable: **los gastos casi siempre son agregar**. Si cada
 *  uno carga algo sin señal, al volver la conexion se suman los dos y no hay
 *  nada que reconciliar. */

import * as SQLite from 'expo-sqlite';
import type { GastoBajado, GastoSubida, ParteBajada } from './api';

let base: SQLite.SQLiteDatabase | null = null;

export async function abrir(): Promise<SQLite.SQLiteDatabase> {
  if (base) return base;
  const db = await SQLite.openDatabaseAsync('gastos.db');

  await db.execAsync(`
    pragma journal_mode = WAL;

    create table if not exists gastos (
      id           text primary key,
      viaje_id     text not null,
      pagado_por   text not null,
      monto        integer not null,
      moneda       text not null,
      descripcion  text not null,
      fecha        text not null,
      editado_en   text not null,
      borrado_en   text,
      -- 1 mientras el servidor todavia no lo confirmo. Es la cola de subida:
      -- no hace falta una tabla aparte, el gasto se sabe pendiente a si mismo.
      pendiente    integer not null default 1
    );

    create table if not exists partes (
      gasto_id    text not null,
      usuario_id  text not null,
      monto       integer not null,
      primary key (gasto_id, usuario_id)
    );

    create table if not exists estado (
      clave  text primary key,
      valor  text
    );
  `);

  base = db;
  return db;
}

/** Hasta donde se sincronizo, con el reloj del SERVIDOR.
 *
 *  Se guarda y se devuelve tal cual vino: si el telefono pusiera su propia
 *  hora acá, uno atrasado dejaria de bajar cambios y se perderian callados. */
export async function cursor(viajeId: string): Promise<string | null> {
  const db = await abrir();
  const f = await db.getFirstAsync<{ valor: string }>(
    `select valor from estado where clave = ?`, `cursor:${viajeId}`,
  );
  return f?.valor ?? null;
}

export async function guardarCursor(viajeId: string, hasta: string): Promise<void> {
  const db = await abrir();
  await db.runAsync(
    `insert into estado (clave, valor) values (?, ?)
     on conflict(clave) do update set valor = excluded.valor`,
    `cursor:${viajeId}`, hasta,
  );
}

export interface GastoLocal {
  id: string;
  viajeId: string;
  pagadoPor: string;
  monto: number;
  moneda: string;
  descripcion: string;
  fecha: string;
  editadoEn: string;
  borradoEn: string | null;
  pendiente: boolean;
  partes: { usuarioId: string; monto: number }[];
}

/** Guarda un gasto hecho en este telefono. Queda pendiente de subir. */
export async function guardarLocal(g: Omit<GastoLocal, 'pendiente'>): Promise<void> {
  const db = await abrir();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `insert into gastos (id, viaje_id, pagado_por, monto, moneda, descripcion,
                           fecha, editado_en, borrado_en, pendiente)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       on conflict(id) do update set
         pagado_por = excluded.pagado_por, monto = excluded.monto,
         moneda = excluded.moneda, descripcion = excluded.descripcion,
         fecha = excluded.fecha, editado_en = excluded.editado_en,
         borrado_en = excluded.borrado_en, pendiente = 1`,
      g.id, g.viajeId, g.pagadoPor, g.monto, g.moneda, g.descripcion,
      g.fecha, g.editadoEn, g.borradoEn,
    );
    await db.runAsync(`delete from partes where gasto_id = ?`, g.id);
    for (const p of g.partes) {
      await db.runAsync(
        `insert into partes (gasto_id, usuario_id, monto) values (?, ?, ?)`,
        g.id, p.usuarioId, p.monto,
      );
    }
  });
}

/** Lo que falta subir. */
export async function pendientes(viajeId: string): Promise<GastoSubida[]> {
  const db = await abrir();
  const filas = await db.getAllAsync<{
    id: string; pagado_por: string; monto: number; moneda: string;
    descripcion: string; fecha: string; editado_en: string; borrado_en: string | null;
  }>(`select * from gastos where viaje_id = ? and pendiente = 1`, viajeId);

  const salida: GastoSubida[] = [];
  for (const f of filas) {
    const partes = await db.getAllAsync<{ usuario_id: string; monto: number }>(
      `select usuario_id, monto from partes where gasto_id = ?`, f.id,
    );
    salida.push({
      id: f.id, viajeId, pagadoPor: f.pagado_por, monto: f.monto, moneda: f.moneda,
      descripcion: f.descripcion, fecha: f.fecha, editadoEn: f.editado_en,
      borradoEn: f.borrado_en,
      partes: partes.map((p) => ({ usuarioId: p.usuario_id, monto: p.monto })),
    });
  }
  return salida;
}

/** Mete lo que bajo del servidor.
 *
 *  Lo de afuera solo pisa a lo local si se edito despues. Sin esa condicion, un
 *  gasto que acabas de cambiar sin señal lo pisaria la version vieja que baja
 *  del servidor, y el cambio se perderia sin aviso. */
export async function guardarBajados(
  bajados: GastoBajado[], partes: ParteBajada[], subidos: string[],
): Promise<void> {
  const db = await abrir();
  const porGasto = new Map<string, ParteBajada[]>();
  for (const p of partes) {
    const l = porGasto.get(p.gasto_id) ?? [];
    l.push(p);
    porGasto.set(p.gasto_id, l);
  }

  await db.withTransactionAsync(async () => {
    // Lo que se subio en esta vuelta deja de estar pendiente.
    for (const id of subidos) {
      await db.runAsync(`update gastos set pendiente = 0 where id = ?`, id);
    }

    for (const g of bajados) {
      const mio = await db.getFirstAsync<{ editado_en: string; pendiente: number }>(
        `select editado_en, pendiente from gastos where id = ?`, g.id,
      );
      // Un gasto local todavia sin subir y editado despues no se pisa.
      if (mio && mio.pendiente === 1 && mio.editado_en > (g.actualizado_en ?? '')) continue;

      await db.runAsync(
        `insert into gastos (id, viaje_id, pagado_por, monto, moneda, descripcion,
                             fecha, editado_en, borrado_en, pendiente)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
         on conflict(id) do update set
           pagado_por = excluded.pagado_por, monto = excluded.monto,
           moneda = excluded.moneda, descripcion = excluded.descripcion,
           fecha = excluded.fecha, borrado_en = excluded.borrado_en, pendiente = 0`,
        g.id, g.viaje_id, g.pagado_por, g.monto, g.moneda, g.descripcion,
        g.fecha, g.actualizado_en, g.borrado_en,
      );

      await db.runAsync(`delete from partes where gasto_id = ?`, g.id);
      for (const p of porGasto.get(g.id) ?? []) {
        await db.runAsync(
          `insert into partes (gasto_id, usuario_id, monto) values (?, ?, ?)`,
          p.gasto_id, p.usuario_id, p.monto,
        );
      }
    }
  });
}

/** Todo lo que hay que mostrar, de la base del telefono. */
export async function leerGastos(viajeId: string): Promise<GastoLocal[]> {
  const db = await abrir();
  const filas = await db.getAllAsync<{
    id: string; viaje_id: string; pagado_por: string; monto: number; moneda: string;
    descripcion: string; fecha: string; editado_en: string; borrado_en: string | null;
    pendiente: number;
  }>(
    `select * from gastos where viaje_id = ? and borrado_en is null
      order by fecha desc, editado_en desc`, viajeId,
  );

  const todas = await db.getAllAsync<{ gasto_id: string; usuario_id: string; monto: number }>(
    `select p.* from partes p join gastos g on g.id = p.gasto_id where g.viaje_id = ?`,
    viajeId,
  );
  const porGasto = new Map<string, { usuarioId: string; monto: number }[]>();
  for (const p of todas) {
    const l = porGasto.get(p.gasto_id) ?? [];
    l.push({ usuarioId: p.usuario_id, monto: p.monto });
    porGasto.set(p.gasto_id, l);
  }

  return filas.map((f) => ({
    id: f.id, viajeId: f.viaje_id, pagadoPor: f.pagado_por, monto: f.monto,
    moneda: f.moneda, descripcion: f.descripcion, fecha: f.fecha,
    editadoEn: f.editado_en, borradoEn: f.borrado_en, pendiente: f.pendiente === 1,
    partes: porGasto.get(f.id) ?? [],
  }));
}

/** Guarda con que viaje y con quienes estamos, para poder abrir la app sin red
 *  y ver algo util en vez de una pantalla vacia. */
export async function guardarViaje(
  viajeId: string, nombre: string, miembros: { usuarioId: string; email: string }[],
): Promise<void> {
  const db = await abrir();
  await db.runAsync(
    `insert into estado (clave, valor) values ('viaje', ?)
     on conflict(clave) do update set valor = excluded.valor`,
    JSON.stringify({ id: viajeId, nombre, miembros }),
  );
}

export async function leerViaje(): Promise<
  { id: string; nombre: string; miembros: { usuarioId: string; email: string }[] } | null
> {
  const db = await abrir();
  const f = await db.getFirstAsync<{ valor: string }>(
    `select valor from estado where clave = 'viaje'`,
  );
  if (!f) return null;
  try {
    return JSON.parse(f.valor);
  } catch {
    return null;
  }
}

/** Cual viaje se esta mirando. Se recuerda para que la app no salte sola a
 *  otro si aparece uno nuevo, y para que al abrir sin red muestre el mismo de
 *  siempre. */
export async function viajeElegido(): Promise<string | null> {
  const db = await abrir();
  const f = await db.getFirstAsync<{ valor: string }>(
    `select valor from estado where clave = 'elegido'`,
  );
  return f?.valor ?? null;
}

export async function elegirViaje(viajeId: string): Promise<void> {
  const db = await abrir();
  await db.runAsync(
    `insert into estado (clave, valor) values ('elegido', ?)
     on conflict(clave) do update set valor = excluded.valor`, viajeId,
  );
}

/** Preferencias chicas de este telefono, como la densidad de la lista.
 *
 *  Van en la base y no en memoria porque una preferencia que se reinicia en
 *  cada apertura molesta todos los dias. */
export async function preferencia(clave: string): Promise<string | null> {
  const db = await abrir();
  const f = await db.getFirstAsync<{ valor: string }>(
    `select valor from estado where clave = ?`, `pref:${clave}`,
  );
  return f?.valor ?? null;
}

export async function guardarPreferencia(clave: string, valor: string): Promise<void> {
  const db = await abrir();
  await db.runAsync(
    `insert into estado (clave, valor) values (?, ?)
     on conflict(clave) do update set valor = excluded.valor`,
    `pref:${clave}`, valor,
  );
}

/** Borra todo. Se usa al cerrar sesion: los gastos de una cuenta no tienen por
 *  que quedar visibles para la siguiente que entre en este telefono. */
export async function limpiar(): Promise<void> {
  const db = await abrir();
  await db.execAsync(`delete from gastos; delete from partes; delete from estado;`);
}
