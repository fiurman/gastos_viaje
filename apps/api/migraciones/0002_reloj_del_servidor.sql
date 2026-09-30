-- Separar el reloj del servidor del reloj del telefono.
--
-- Habia una sola fecha, `actualizado_en`, que mandaba el telefono y se usaba
-- para dos cosas a la vez: decidir que gana cuando dos ediciones chocan, y
-- saber que bajar en la proxima sincronizacion.
--
-- Usar el reloj del telefono para lo segundo esta mal. Un telefono con la hora
-- adelantada hace que sus gastos queden "en el futuro" y se bajen siempre; uno
-- con la hora atrasada hace que sus cambios nunca se bajen, que es peor porque
-- se pierden en silencio. Y en un viaje los telefonos cambian de huso horario.
--
-- Ahora son dos:
--   actualizado_en  lo pone el SERVIDOR al escribir. Es el cursor de la
--                   sincronizacion, y avanza siempre parejo para todos.
--   editado_en      lo pone el TELEFONO. Solo decide quien gana si dos
--                   ediciones del mismo gasto chocan.

alter table gastos add column editado_en text;
alter table pagos  add column editado_en text;

-- Lo que ya estaba usaba una sola fecha para las dos cosas.
update gastos set editado_en = actualizado_en where editado_en is null;
update pagos  set editado_en = actualizado_en where editado_en is null;
