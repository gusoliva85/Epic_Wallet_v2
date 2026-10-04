/* Capturas de la aplicación para la documentación · F01-T14

   Uso:  npm run capturas            (contra producción)
         npm run capturas -- http://localhost:3000

   Saca las mismas pantallas en tema claro y en tema oscuro, a ancho de
   teléfono y de escritorio. Se versiona el script y no sólo los PNG:
   cuando el diseño cambie, las capturas se rehacen con un comando en
   lugar de quedar viejas en el documento.

   Las imágenes van a docs/capturas/. */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = resolve(RAIZ, "docs", "capturas");

const BASE = process.argv[2] ?? "https://epic-wallet-v2.vercel.app";

/* Qué se captura. El hash es el del enrutador: entrando directo, no
   hace falta simular clics para llegar a cada vista. */
const PANTALLAS = [
  { nombre: "inicio", ruta: "#/inicio" },
  { nombre: "movimientos", ruta: "#/movimientos" },
  { nombre: "historial", ruta: "#/historial" },
  { nombre: "cartera", ruta: "#/inversiones" },
  { nombre: "patrimonio", ruta: "#/patrimonio" },
  { nombre: "analisis", ruta: "#/analisis" },
  { nombre: "ajustes", ruta: "#/config" },
];

const TAMANOS = [
  { nombre: "movil", ancho: 390, alto: 844 },
  { nombre: "escritorio", ancho: 1280, alto: 900 },
];

const TEMAS = ["light", "dark"];

/** Espera a que las fuentes estén listas y las animaciones terminadas.
    Sin esto, las capturas salen con la tipografía del sistema y las
    tarjetas a mitad de su entrada. */
async function asentar(pagina) {
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForTimeout(900);
}

async function main() {
  await mkdir(DESTINO, { recursive: true });

  const navegador = await chromium.launch();
  let hechas = 0;

  for (const tema of TEMAS) {
    for (const tamano of TAMANOS) {
      const contexto = await navegador.newContext({
        viewport: { width: tamano.ancho, height: tamano.alto },
        /* Escala 1 y no 2. A 2x las 34 capturas pesan 40 MB, y un
           repositorio carga ese peso para siempre aunque después se
           borren. A 1x se leen igual en el documento y pesan la
           cuarta parte. */
        deviceScaleFactor: 1,
        // El tema lo fija `data-theme`, pero se declara también la
        // preferencia del sistema: así la captura del tema claro no
        // depende de cómo esté la máquina donde se corre el script.
        colorScheme: tema,
        // Las animaciones de entrada congeladas: una captura con una
        // tarjeta a medio aparecer no sirve para documentar.
        reducedMotion: "reduce",
      });
      const pagina = await contexto.newPage();

      for (const pantalla of PANTALLAS) {
        await pagina.goto(`${BASE}/${pantalla.ruta}`, {
          waitUntil: "networkidle",
        });
        await pagina.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, tema);
        await asentar(pagina);

        const archivo = `${pantalla.nombre}-${tamano.nombre}-${tema === "dark" ? "oscuro" : "claro"}.png`;
        await pagina.screenshot({ path: resolve(DESTINO, archivo) });
        hechas += 1;
        process.stdout.write(`  ${archivo}\n`);
      }

      // Las dos hojas, que no tienen ruta propia: se abren a mano.
      for (const [disparador, nombre] of [
        ["#btn-alertas", "alertas"],
        ['[data-hoja="mas"]', "mas"],
      ]) {
        await pagina.goto(`${BASE}/#/inicio`, { waitUntil: "networkidle" });
        await pagina.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, tema);
        const boton = pagina.locator(disparador);
        // La hoja de «Más» sólo existe por debajo de 960 px, donde hay
        // barra inferior: en escritorio se saltea.
        if (!(await boton.isVisible().catch(() => false))) continue;
        await boton.click();
        await asentar(pagina);

        const archivo = `hoja-${nombre}-${tamano.nombre}-${tema === "dark" ? "oscuro" : "claro"}.png`;
        await pagina.screenshot({ path: resolve(DESTINO, archivo) });
        hechas += 1;
        process.stdout.write(`  ${archivo}\n`);

        // Se cierra antes de seguir: abierta, tapa el disparador de la
        // hoja que viene y el clic nunca llega.
        await pagina.keyboard.press("Escape");
        await pagina.waitForTimeout(450);
      }

      await contexto.close();
    }
  }

  await navegador.close();
  process.stdout.write(`\n  ${hechas} capturas en docs/capturas/\n`);
}

await main();
