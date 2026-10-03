/* ============================================================
   Watcher de CSS para desarrollo.  Uso: npm run dev

   POR QUÉ ESTE SCRIPT Y NO `tailwindcss --watch`
   El watcher nativo de Tailwind v4 no detecta cambios cuando la
   ruta del proyecto contiene espacios en Windows (acá:
   "D:\_Mis Datos\..."). Se comprobó que no reacciona ni al
   archivo de entrada ni a los parciales importados, mientras que
   el build puntual funciona perfecto.

   Este script usa fs.watch (recursivo, nativo de Node) y dispara
   el build de Tailwind. Cero dependencias nuevas.
   ============================================================ */
import { execFile } from "node:child_process";
import { watch, existsSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);
const WATCH = ["web/src", "web/index.html"];
const DEBOUNCE = 120;

/* Se invoca el CLI de Tailwind con node directamente, sin shell: evita el
   aviso de deprecación de Node por `shell: true` y las comillas en rutas
   con espacios. */
const CLI = "node_modules/@tailwindcss/cli/dist/index.mjs";
const ARGS = [CLI, "-i", "web/src/app.css", "-o", "web/public/app.css"];

let pending = null;
let building = false;
let queued = false;

async function build() {
  if (building) {
    queued = true;
    return;
  }
  building = true;
  const t0 = Date.now();
  try {
    await run(process.execPath, ARGS, { windowsHide: true });
    console.log(`  ✓ ${hora()}  compilado en ${Date.now() - t0} ms`);
  } catch (err) {
    console.error(`  ✗ ${hora()}  error de compilación:\n${err.stderr || err.message}`);
  } finally {
    building = false;
    if (queued) {
      queued = false;
      build();
    }
  }
}

const hora = () => new Date().toLocaleTimeString("es-AR", { hour12: false });

function onChange(file) {
  if (file && !/\.(css|html|js)$/i.test(file)) return;
  clearTimeout(pending);
  pending = setTimeout(() => {
    if (file) console.log(`\n  cambió ${file}`);
    build();
  }, DEBOUNCE);
}

console.log("\n  Epic Wallet · watcher de CSS");
for (const target of WATCH) {
  if (!existsSync(target)) {
    console.log(`  (todavía no existe ${target}, se ignora)`);
    continue;
  }
  watch(target, { recursive: true }, (_evento, archivo) => onChange(archivo));
  console.log(`  vigilando ${target}`);
}
console.log("  Ctrl+C para salir\n");

await build();
