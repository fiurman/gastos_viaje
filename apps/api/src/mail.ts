/** Mandar mails desde el Worker.
 *
 *  Usa el servicio de Cloudflare, que es gratis siempre que el destinatario sea
 *  una direccion verificada de la cuenta. Mandar a cualquiera requiere plan
 *  pago, pero acá los destinatarios son dos y se verifican una vez.
 *
 *  Es la razon principal por la que todo esto vive en Cloudflare: el caso que a
 *  cualquier servicio de mail le queda chico resulta ser gratis del todo. */

import type { Env } from './tipos.ts';

/** Nunca tira: un mail que no sale no puede romper lo que lo pidio.
 *  Devuelve si salio, para que quien llame decida si le importa. */
async function mandar(
  env: Env,
  para: string,
  asunto: string,
  cuerpo: string,
): Promise<boolean> {
  try {
    await env.MAIL.send({
      to: para,
      from: env.MAIL_DESDE,
      subject: asunto,
      text: cuerpo,
    });
    return true;
  } catch (e) {
    console.error('no se pudo mandar el mail', e);
    return false;
  }
}

/** El codigo para entrar.
 *
 *  Sin links: un link que abre la app depende de como este configurado el
 *  cliente de correo y falla seguido en Android. Seis digitos se tipean y
 *  siempre funcionan. */
export function mandarCodigo(env: Env, para: string, codigo: string): Promise<boolean> {
  // En local no hay servicio de mail. Sin esto no habria manera de probar el
  // login, porque el codigo se guarda firmado y no se puede leer de la base.
  // `DEV` solo existe en `.dev.vars`, que nunca se publica.
  if (env.DEV === '1') {
    console.log(`\n  === CODIGO PARA ${para}: ${codigo} ===\n`);
    return Promise.resolve(true);
  }

  return mandar(
    env,
    para,
    `${codigo} es tu codigo para entrar`,
    `Tu codigo es ${codigo}

Vence en 10 minutos y sirve una sola vez.

Si no lo pediste vos, ignora este mail: sin el codigo nadie puede entrar.`,
  );
}

/** Aviso de que el otro cargo un gasto. */
export function mandarAvisoGasto(
  env: Env,
  para: string,
  quien: string,
  descripcion: string,
  monto: string,
  viaje: string,
): Promise<boolean> {
  return mandar(
    env,
    para,
    `${quien} cargo ${monto} en ${viaje}`,
    `${quien} cargo un gasto:

  ${descripcion}
  ${monto}

Abri la app para ver como quedo el saldo.`,
  );
}
