/* ============================================================
   Mide el CSS compilado contra el presupuesto del proyecto.
   El documento técnico (§20) fija: menos de 50 KB comprimido.
   Uso: npm run size
   ============================================================ */
import { gzipSync, brotliCompressSync } from "node:zlib";
import { readFileSync, existsSync } from "node:fs";

const FILE = "web/public/app.css";
const BUDGET_KB = 50;

if (!existsSync(FILE)) {
  console.error(`No existe ${FILE}. Corré primero: npm run build`);
  process.exit(1);
}

const raw = readFileSync(FILE);
const kb = (n) => (n / 1024).toFixed(1).replace(".", ",") + " KB";
const gz = gzipSync(raw).length;
const br = brotliCompressSync(raw).length;

console.log(`\n  ${FILE}`);
console.log(`  sin comprimir  ${kb(raw.length)}`);
console.log(`  gzip           ${kb(gz)}`);
console.log(`  brotli         ${kb(br)}   <- lo que sirve Vercel`);
console.log(`  presupuesto    ${BUDGET_KB} KB comprimido`);

const used = ((br / 1024 / BUDGET_KB) * 100).toFixed(0);
if (br / 1024 > BUDGET_KB) {
  console.error(`\n  EXCEDIDO: ${used} % del presupuesto\n`);
  process.exit(1);
}
console.log(`  usado          ${used} % del presupuesto\n`);
