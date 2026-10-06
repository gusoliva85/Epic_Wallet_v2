/* ============================================================
   Deja `@supabase/auth-js` en un archivo que el navegador pueda
   cargar.  Uso: npm run auth:vendor

   POR QUÉ HACE FALTA ESTE PASO

   El proyecto no usa empaquetador: `web/index.html` carga los
   módulos tal como están en `web/src/js/`, y la CSP tiene
   `script-src 'self'`, así que tampoco se puede traer la librería
   de un CDN.

   Y el build ESM de `@supabase/auth-js` no se puede servir tal
   cual: sus imports van sin extensión (`from './AuthClient'`), y
   eso lo resuelve Node pero **no el navegador**, que pide la ruta
   exacta. Además hay imports condicionales a `react-native` que
   acá no existen.

   Entonces se arma un único archivo con esbuild. Es el único uso
   de esbuild en el proyecto y es a propósito: empaqueta la
   dependencia, no nuestro código, que sigue cargándose sin
   intermediarios.

   EL RESULTADO SE VERSIONA

   `web/src/js/vendor/auth-js.js` queda en el repositorio. Dos
   razones: el despliegue no depende de que este paso corra, y el
   código de terceros que llega al navegador queda a la vista en
   los diffs. Que no se desincronice de la versión instalada lo
   vigila `tests/unit/test_vendor_auth.py`.
   ============================================================ */
import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "web/src/js/vendor/auth-js.js");

/* Sólo lo que `auth.js` usa. Nombrarlo explícitamente mantiene el
   archivo chico y deja escrito qué parte de la librería entra. */
const ENTRADA = `
export { GoTrueClient } from "@supabase/auth-js";
export { AuthError, isAuthError, AuthApiError } from "@supabase/auth-js";
`;

/* `react-native` no existe en el navegador y la librería lo importa
   dentro de una rama que nunca se toma. Se reemplaza por un módulo
   vacío para que esbuild no se detenga buscándolo. */
const sinReactNative = {
  name: "sin-react-native",
  setup(construccion) {
    construccion.onResolve({ filter: /^react-native$/ }, () => ({
      path: "react-native",
      namespace: "vacio",
    }));
    construccion.onLoad({ filter: /.*/, namespace: "vacio" }, () => ({
      contents: "export default {};",
      loader: "js",
    }));
  },
};

async function versionInstalada() {
  const p = JSON.parse(
    await readFile(join(RAIZ, "node_modules/@supabase/auth-js/package.json"), "utf8"),
  );
  return p.version;
}

const version = await versionInstalada();

await mkdir(dirname(SALIDA), { recursive: true });

const resultado = await build({
  stdin: { contents: ENTRADA, resolveDir: RAIZ, loader: "js" },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  legalComments: "none",
  plugins: [sinReactNative],
  write: false,
});

const encabezado = `/* GENERADO POR scripts/preparar-auth.mjs — NO EDITAR A MANO.
   @supabase/auth-js v${version}
   Para actualizarlo: npm i @supabase/auth-js@<version> && npm run auth:vendor
   Licencia MIT, (c) Supabase. */
`;

const codigo = resultado.outputFiles[0].text;
await writeFile(SALIDA, encabezado + codigo, "utf8");

const kb = (Buffer.byteLength(codigo, "utf8") / 1024).toFixed(1);
console.log(`  auth-js v${version} → web/src/js/vendor/auth-js.js  (${kb} kB)`);
