/** Los colores de la app, en un solo lugar.
 *
 *  Tres modos y no dos: **sistema**, claro y oscuro. El de sistema es el que
 *  usa casi todo el mundo sin saberlo, porque es el que acompaña al telefono
 *  cuando se pone oscuro de noche. Que sea la opcion por defecto evita que la
 *  app sea la unica cosa blanca a las tres de la mañana.
 *
 *  Las dos paletas tienen exactamente las mismas claves. Un color que existe en
 *  una sola es el bug clasico del modo oscuro: texto de un tema sobre el fondo
 *  del otro. */

import { createContext, useContext } from 'react';

export interface Paleta {
  /** El fondo de la pantalla. */
  papel: string;
  /** El texto principal, y el color de los botones solidos. */
  tinta: string;
  /** Texto secundario: fechas, etiquetas, lo que acompaña. */
  suave: string;
  /** Lineas finas entre renglones. */
  linea: string;
  /** Fondos apenas despegados del papel. */
  fondo: string;
  /** Te deben. */
  verde: string;
  /** Debés. */
  rojo: string;
  /** Lo que va encima del verde y del rojo. Siempre blanco: las bandas son
   *  oscuras en los dos temas. */
  sobreColor: string;
  /** Lo que va encima de un fondo de `tinta`: botones solidos, chips elegidos.
   *
   *  No es lo mismo que `sobreColor`, y confundirlos es el bug clasico del modo
   *  oscuro: en oscuro `tinta` es casi blanco, asi que poner blanco encima deja
   *  el texto invisible. */
  sobreTinta: string;
  /** Avisos que no son errores, como lo que falta subir. */
  avisoFondo: string;
  avisoTinta: string;
  /** Los colores de los graficos, en orden de uso.
   *
   *  Acá el color SI lleva informacion: distinguir una categoria de otra es el
   *  trabajo de la pantalla. Es la excepcion a la regla del resto de la app,
   *  donde el unico color saturado es el del saldo.
   *
   *  Ninguno es verde ni rojo a proposito: esos dos ya significan "te deben" y
   *  "debes", y repetirlos en un grafico de categorias haria que una barra
   *  parezca decir algo sobre la deuda cuando no dice nada.
   *
   *  Son apagados, no saturados. Seis colores de pizarrita juntos marean, y
   *  estos conviven con texto encima y al lado. */
  graficos: string[];
  /** Para el teclado y la barra de estado del sistema. */
  claro: boolean;
}

export const CLARA: Paleta = {
  papel: '#ffffff',
  tinta: '#1a1815',
  suave: '#7c7873',
  linea: '#eae6e1',
  fondo: '#f6f4f1',
  verde: '#1c5c34',
  rojo: '#8f2217',
  sobreColor: '#ffffff',
  sobreTinta: '#ffffff',
  avisoFondo: '#f7f1e3',
  avisoTinta: '#7a5c1e',
  // Sobre blanco van mas profundos, si no se lavan.
  graficos: [
    '#2f6b78',  // teal
    '#a9712a',  // ocre
    '#6e4668',  // ciruela
    '#3c5a85',  // pizarra
    '#8a5a3c',  // tierra
    '#5c6b4a',  // oliva
    '#7d5a7a',  // malva
  ],
  claro: true,
};

/** El oscuro no es la clara invertida.
 *
 *  El negro puro sobre OLED vibra y cansa, asi que el fondo es un casi negro
 *  con la misma tibieza que el papel de la clara. Y los colores del saldo se
 *  levantan un poco: el verde y el rojo que funcionan sobre blanco quedan
 *  barrosos sobre oscuro. */
export const OSCURA: Paleta = {
  papel: '#141311',
  tinta: '#f2efe9',
  suave: '#9a948c',
  linea: '#2a2724',
  fondo: '#1f1d19',
  verde: '#246b3c',
  rojo: '#9e2c1f',
  sobreColor: '#ffffff',
  sobreTinta: '#141311',
  avisoFondo: '#2b2415',
  avisoTinta: '#d9bb79',
  // Sobre casi negro van mas luminosos: los mismos tonos del claro quedarian
  // barrosos y no se distinguirian entre si.
  graficos: [
    '#5fa8b5',
    '#d9a04a',
    '#ab7fa3',
    '#7d9ccf',
    '#c9906a',
    '#9aa87f',
    '#b893b5',
  ],
  claro: false,
};

export type Modo = 'sistema' | 'claro' | 'oscuro';

export const MODOS: { clave: Modo; texto: string }[] = [
  { clave: 'sistema', texto: 'Sistema' },
  { clave: 'claro', texto: 'Claro' },
  { clave: 'oscuro', texto: 'Oscuro' },
];

export interface Contexto {
  c: Paleta;
  modo: Modo;
  cambiarModo: (m: Modo) => void;
}

export const TemaContexto = createContext<Contexto>({
  c: CLARA,
  modo: 'sistema',
  cambiarModo: () => {},
});

export const useTema = () => useContext(TemaContexto);

/** La serif, solo para los numeros y los titulos. Los textos de interfaz van en
 *  la del sistema: la personalidad esta en las cifras, que es lo que se mira. */
export const SERIF = 'Fraunces_700Bold';
export const SERIF_MEDIA = 'Fraunces_600SemiBold';
