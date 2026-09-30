-- Esquema inicial.
--
-- Dos decisiones que atraviesan todo el archivo:
--
-- 1. Los montos son ENTEROS en centavos, nunca decimales. Sumar 0.1 + 0.2 en
--    punto flotante da 0.30000000000004, y en una app cuyo unico trabajo es
--    decir cuanto debe cada uno, eso no se puede permitir.
--
-- 2. Los ids los genera el telefono, no la base. Un gasto cargado sin señal
--    tiene que nacer con su id definitivo, para que cuando vuelva la conexion
--    se suba tal cual y no haya que reconciliar nada.

create table usuarios (
  id          text primary key,
  email       text not null unique,
  nombre      text,
  creado_en   text not null
);

-- La sesion de un telefono. Dura mucho a proposito: el codigo por mail se pide
-- una vez por dispositivo y despues la app abre y ya esta adentro.
create table sesiones (
  token        text primary key,
  usuario_id   text not null references usuarios(id),
  dispositivo  text,
  -- Token de Expo para mandarle push a este telefono. Vive aca y no en el
  -- usuario porque es del dispositivo: la misma persona en dos telefonos
  -- recibe en los dos.
  push_token   text,
  creado_en    text not null,
  ultimo_uso   text
);

create index sesiones_usuario on sesiones(usuario_id);

-- Codigos de un solo uso para entrar.
--
-- Se guarda el hash y no el codigo: si alguien llegara a leer la tabla, no
-- puede entrar con lo que ve. `intentos` corta la fuerza bruta, que contra
-- seis digitos es cuestion de minutos si no se limita.
create table codigos (
  email        text not null,
  codigo_hash  text not null,
  expira_en    text not null,
  intentos     integer not null default 0,
  creado_en    text not null,
  primary key (email, creado_en)
);

create index codigos_email on codigos(email);

create table viajes (
  id            text primary key,
  nombre        text not null,
  creado_por    text not null references usuarios(id),
  creado_en     text not null,
  actualizado_en text not null
);

create table miembros (
  viaje_id    text not null references viajes(id),
  usuario_id  text not null references usuarios(id),
  desde       text not null,
  primary key (viaje_id, usuario_id)
);

-- Un gasto.
--
-- `moneda` se elige por gasto y NO se convierte. El saldo se muestra separado
-- por moneda, asi que "te debe 47,50 EUR y 12.300 ARS" es una respuesta
-- correcta y no hace falta ningun tipo de cambio. Sumar monedas distintas en
-- un solo numero seria mas comodo y estaria mal.
create table gastos (
  id             text primary key,
  viaje_id       text not null references viajes(id),
  pagado_por     text not null references usuarios(id),
  monto          integer not null,
  moneda         text not null,
  descripcion    text not null,
  fecha          text not null,
  creado_por     text not null references usuarios(id),
  creado_en      text not null,
  actualizado_en text not null,
  -- Se marca borrado en vez de borrarse. Si se borrara, el otro telefono que
  -- estuvo sin señal no tendria forma de enterarse y lo volveria a subir.
  borrado_en     text
);

create index gastos_viaje on gastos(viaje_id, actualizado_en);

-- Como se reparte un gasto. Existe aunque casi siempre sea mitad y mitad:
-- el dia que uno paga algo que es solo suyo, o se adelanta una parte, sin esto
-- no hay forma de anotarlo.
create table partes (
  gasto_id    text not null references gastos(id),
  usuario_id  text not null references usuarios(id),
  monto       integer not null,
  primary key (gasto_id, usuario_id)
);

-- Plata que efectivamente paso de uno al otro, para saldar.
create table pagos (
  id             text primary key,
  viaje_id       text not null references viajes(id),
  de_usuario     text not null references usuarios(id),
  a_usuario      text not null references usuarios(id),
  monto          integer not null,
  moneda         text not null,
  nota           text,
  fecha          text not null,
  creado_en      text not null,
  actualizado_en text not null,
  borrado_en     text
);

create index pagos_viaje on pagos(viaje_id, actualizado_en);

-- Como quiere que le avisen cada uno.
create table preferencias (
  usuario_id  text primary key references usuarios(id),
  push        integer not null default 1,
  mail        integer not null default 0
);
