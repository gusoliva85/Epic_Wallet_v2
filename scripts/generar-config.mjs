/* ============================================================
   Escribe `web/public/config.js` con la URL y la clave anónima de
   Supabase.  Uso: npm run config  (lo llama `npm run build`)

   POR QUÉ UN ARCHIVO GENERADO

   El proyecto no usa empaquetador, así que no hay un paso que
   reemplace `process.env.X` dentro del código. La configuración
   entra por un archivo que se genera en el build y que
   `web/index.html` carga antes que los módulos.

   QUÉ CLAVE VA Y QUÉ CLAVE NO

   Va la **anónima**. Está diseñada para viajar en el navegador: no
   da acceso a nada por sí sola, porque del otro lado está RLS. Es
   pública por definición y no tiene sentido esconderla.

   La de servicio (`SUPABASE_SERVICE_ROLE_KEY`) **se saltea RLS** y
   no entra acá ni en ningún archivo de `web/`. Este script la
   rechaza explícitamente si aparece donde no debe, y
   `tests/unit/test_config_web.py` revisa los archivos publicados.

   EL ARCHIVO NO SE VERSIONA

   Está en `.gitignore`. No por secreto —la clave anónima no lo
   es— sino porque es propio del entorno: en desarrollo y en
   producción no tiene por qué ser el mismo.
   ============================================================ */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* La raíz se puede pasar por argumento: `node generar-config.mjs <raiz>`.
   Sin argumento es la del proyecto, que es lo que usa el build.

   Existe para las pruebas, y no es un agregado gratuito: sin esto
   tendrían que correr sobre el proyecto de verdad, pisando el
   `config.js` bueno y encontrando el `.env` bueno justo cuando lo que
   quieren probar es qué pasa sin configuración. */
const RAIZ = process.argv[2]
  ? resolve(process.argv[2])
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "web/public/config.js");

/* En Vercel las variables llegan por el entorno. En la máquina de
   desarrollo están en .env, que no se lee con ninguna dependencia
   porque este script tiene que correr también donde no hay
   node_modules completo. */
async function delEntorno(clave) {
  const delProceso = (process.env[clave] ?? "").trim();
  if (delProceso) return delProceso;
  try {
    const texto = await readFile(join(RAIZ, ".env"), "utf8");
    const m = texto.match(new RegExp(`^${clave}\\s*=\\s*(.+)$`, "m"));
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

const url = await delEntorno("SUPABASE_URL");
const anon = await delEntorno("SUPABASE_ANON_KEY");

if (!url || !anon) {
  /* Se corta el build en vez de generar un archivo vacío. Un
     despliegue que sale sin configuración de autenticación se ve bien
     hasta que alguien intenta entrar, y ahí falla sin explicación.
     Mejor que falle acá, donde el mensaje se lee. */
  console.error(
    "\n  ERROR: falta la configuración de Supabase para el frontend.\n" +
      `         SUPABASE_URL      ${url ? "ok" : "FALTA"}\n` +
      `         SUPABASE_ANON_KEY ${anon ? "ok" : "FALTA"}\n\n` +
      "  En Vercel: Settings → Environment Variables, para Production,\n" +
      "  Preview y Development (el build las necesita, no sólo la API).\n" +
      "  En la máquina de desarrollo: están en .env.\n",
  );
  process.exit(1);
}

/* Que no se publique por error la clave que se saltea RLS.
   Veinte líneas que evitan un accidente irreversible: una clave de
   servicio dentro de un paquete de navegador ya quedó publicada, y
   rotarla no deshace quién la vio.

   Supabase tiene hoy dos formatos de clave y los dos se reconocen:

   · El nuevo, con prefijo: `sb_publishable_…` es la que va al
     navegador y `sb_secret_…` la que nunca. (Las de este proyecto son
     de este formato.)
   · El viejo, un JWT con `role` adentro: `anon` o `service_role`. */
function queClaveEs(clave) {
  if (clave.startsWith("sb_publishable_")) return "publica";
  if (clave.startsWith("sb_secret_")) return "secreta";

  const partes = clave.split(".");
  if (partes.length === 3) {
    try {
      const json = Buffer.from(partes[1].replace(/-/g, "+").replace(/_/g, "/"), "base64");
      const rol = String(JSON.parse(json.toString("utf8")).role ?? "");
      if (rol === "anon") return "publica";
      if (rol) return "secreta"; // service_role o cualquier otra
    } catch {
      /* No es un JWT legible; cae en «desconocida». */
    }
  }
  return "desconocida";
}

const tipo = queClaveEs(anon);
if (tipo === "secreta") {
  console.error(
    "\n  ERROR: SUPABASE_ANON_KEY parece ser una clave SECRETA.\n" +
      "         Esa clave se saltea RLS y no puede ir al navegador.\n" +
      "         Se esperaba la publicable (sb_publishable_… o el JWT con\n" +
      "         role anon), que está en Supabase → Settings → API Keys.\n",
  );
  process.exit(1);
}
if (tipo === "desconocida") {
  /* Aviso y no error: Supabase ya cambió el formato una vez y un
     formato nuevo no debería cortar el despliegue. Pero que se vea. */
  console.warn(
    "\n  AVISO: no se reconoce el formato de SUPABASE_ANON_KEY.\n" +
      "         Se publica igual. Verificá a mano que sea la publicable.\n",
  );
}

const contenido = `/* GENERADO EN EL BUILD POR scripts/generar-config.mjs — NO EDITAR.
   Esta clave es la ANÓNIMA y es pública por diseño: no da acceso a
   nada por sí sola, porque del otro lado está RLS. */
window.EPIC_WALLET = Object.freeze({
  supabaseUrl: ${JSON.stringify(url)},
  supabaseAnonKey: ${JSON.stringify(anon)},
});
`;

await mkdir(dirname(SALIDA), { recursive: true });
await writeFile(SALIDA, contenido, "utf8");
console.log(`  config → web/public/config.js  (${new URL(url).host}, clave ${tipo})`);
