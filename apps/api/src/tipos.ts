/** Lo que el Worker recibe de Cloudflare. */
export interface Env {
  DB: D1Database;

  /** Para mandar mails. Gratis mientras el destinatario sea una direccion
   *  verificada de la cuenta, que es nuestro caso: somos dos. */
  MAIL: {
    send(mensaje: {
      to: string;
      from: string;
      subject: string;
      text?: string;
      html?: string;
    }): Promise<{ messageId: string }>;
  };

  /** Secreto del Worker, cargado con `wrangler secret put SECRETO`.
   *  Firma los codigos de acceso y los tokens de sesion: sin el, leer la base
   *  no alcanza para entrar como otro. */
  SECRETO: string;

  /** De que direccion salen los mails. Tiene que estar en un dominio
   *  configurado en la cuenta. */
  MAIL_DESDE: string;

  /** Solo existe en `.dev.vars`, nunca en produccion. Hace que el codigo de
   *  acceso salga por consola, porque en local no hay servicio de mail y sin
   *  esto no habria forma de probar el login. */
  DEV?: string;
}

export interface Gasto {
  id: string;
  viaje_id: string;
  pagado_por: string;
  monto: number;
  moneda: string;
  descripcion: string;
  fecha: string;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
  borrado_en: string | null;
}

export interface Parte {
  gasto_id: string;
  usuario_id: string;
  monto: number;
}
