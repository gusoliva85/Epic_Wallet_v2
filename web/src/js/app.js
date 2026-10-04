/* Punto de entrada · F01-T07

   Arranca el enrutador. Va en un módulo aparte y cargado al final para
   que las dos barras ya hayan registrado su escucha de `epic:ruta`
   cuando se emita la primera ruta.

   Los módulos de las barras se conectan solos al importarse; acá sólo
   hace falta dar la orden de arranque. */

import { arrancar } from "./router.js";

arrancar();
