# gastos_viaje

Dividir gastos entre dos personas durante un viaje, y saber en cualquier
momento quién le debe cuánto a quién.

Nace de un viaje a Italia. El problema concreto: dos personas pagando cosas
sueltas durante dos semanas, con señal a ratos, y al volver nadie se acuerda de
nada.

## Cómo está armado

```
App Expo  ──►  Worker (API)  ──►  D1 (la base)
                    │
                    ├─►  Cloudflare Email  ─► aviso por mail
                    └─►  Expo Push         ─► aviso en el celular
```

Todo en una sola cuenta de Cloudflare. Sin servicios de terceros y sin tarjeta.

| pieza | qué es | por qué |
|---|---|---|
| `apps/movil` | app en Expo, Android | mismo flujo que ya usamos: EAS y APK |
| `apps/api` | Worker | la API y los avisos |
| D1 | SQLite de Cloudflare | 5 GB gratis, no se pausa |

### Por qué Cloudflare y no Supabase

Supabase trae el login hecho, que con diez días de plazo pesa. Se descartó por
tres razones:

- **Los proyectos gratis se pausan a los 7 días sin uso** y hay que despausarlos
  a mano desde el panel. Que eso pase en mitad del viaje es exactamente el
  escenario que la app existe para evitar.
- **Mandar mail en Cloudflare sale gratis** a direcciones verificadas de la
  cuenta, en cualquier plan y sin consumir cuota. Son dos personas: el caso que
  a cualquier servicio de mail le queda chico es justo el nuestro.
- El login que hace falta acá son unas 120 líneas, no un sistema de
  autenticación.

## Cómo se entra

Código de seis dígitos al mail. Se escribe el mail, llega el código, se tipea y
listo. **Nadie depende de que otro le mande nada**: el que manda el mail es el
servidor.

Sin contraseñas, a propósito. Guardar contraseñas es la parte más fácil de hacer
mal, y además obliga a construir recuperación, que termina siendo un mail igual.

La sesión dura un año, así que el código se pide una vez por teléfono.

**Su punto flojo, a sabiendas:** si el mail no llega, no se puede entrar. Con la
sesión larga eso sólo importa el día de la instalación, pero es un punto único
de falla.

### El día que lo use gente de afuera

Cloudflare manda gratis **sólo a direcciones verificadas de la cuenta**, hasta
200. Alcanza y sobra mientras seamos dos, y es lo que hace que todo esto salga
cero pesos. Para mandar a cualquiera hace falta Workers Paid, USD 5 por mes.

La salida sin tarjeta es **Resend**: 3.000 mails por mes, 100 por día, a
cualquier destinatario, dominio propio y sin tarjeta.

El cambio es barato a propósito: todo el envío está en `apps/api/src/mail.ts` y
adentro en una sola función, `mandar()`. Cambiar de proveedor es reescribir esas
cinco líneas por un `fetch`. Ni el login, ni los avisos, ni la base, ni la app se
enteran.

Lo que sí hay que agregar ese día no es el mail, es **protección contra abuso**.
Hoy hay un límite de un código por minuto por dirección, que alcanza para dos
personas. Con desconocidos hace falta además un límite por IP, para que nadie
pida mil códigos a mil direcciones distintas y queme la cuota.

## Las monedas no se convierten

La moneda se elige por gasto y el saldo se muestra **separado por moneda**:

```
Ella te debe:   € 47,50
                $ 12.300
```

Es correcto y no necesita ningún tipo de cambio. Sumar monedas distintas en un
solo número sería más cómodo y estaría mal. El día que haga falta convertir, los
datos ya están bien guardados.

## Sin señal

La app escribe primero en el teléfono y sincroniza después. Adentro de un
restaurante en otro país no hay red, y una app que se cuelga esperando al
servidor no sirve.

Lo que lo hace viable: **los gastos casi siempre son agregar**. Si cada uno
carga algo sin señal, cuando vuelve la conexión se suman los dos y no hay nada
que reconciliar. Por eso los ids los genera el teléfono y los borrados se marcan
en vez de borrar.

### Dos relojes, no uno

- `actualizado_en` lo pone el **servidor** y es el cursor de la sincronización.
- `editado_en` lo pone el **teléfono** y sólo decide quién gana si dos ediciones
  del mismo gasto chocan.

Al principio era una sola fecha, la del teléfono, usada para las dos cosas. Está
mal: un teléfono adelantado baja sus gastos siempre, y uno atrasado no los baja
nunca, que es peor porque se pierden callados. Y en un viaje los teléfonos
cambian de huso horario.

## Lo que hay que saber antes de tocar las cuentas

- **Los montos son enteros en centavos.** Nunca decimales. En una app cuyo único
  trabajo es decir cuánto debe cada uno, `0.1 + 0.2 = 0.30000000000004` no se
  puede permitir.
- **Un gasto borrado se marca, no se borra.** Si se borrara, el teléfono que
  estuvo sin señal no tendría forma de enterarse y lo volvería a subir.
- **El id de un gasto es global, no por viaje.** Por eso al resolver un conflicto
  se comprueba que la fila que ya estaba sea del mismo viaje. Sin eso, un
  miembro de un viaje podía pisar un gasto de otro mandando su id.
