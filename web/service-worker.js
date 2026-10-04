/* ============================================================
   Service worker de Epic Wallet
   Referencia: 02_Documento_Tecnico.md §15.1

   ESTADO: F00-T11 · mínimo a propósito.
   Sólo se instala y se activa, para que la aplicación cumpla el
   requisito de instalabilidad. TODAVÍA NO CACHEA NADA: las
   estrategias de caché (red primero para el HTML, revalidación en
   segundo plano para los estáticos, y nunca encolar escrituras) se
   implementan en F15-T01.

   Que no cachee es deliberado: un service worker a medias que
   guarde respuestas sin una estrategia de invalidación deja
   versiones viejas pegadas y es más difícil de depurar que no
   tener ninguno.
   ============================================================ */

const VERSION = "0.1.0";

self.addEventListener("install", () => {
  // Tomar el control sin esperar a que se cierren las pestañas viejas.
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      // Limpieza preventiva: si una versión futura dejó cachés y se
      // vuelve atrás, no quedan colgados.
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((n) => !n.endsWith(VERSION)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

// Sin manejador de 'fetch' a propósito: todas las peticiones van
// directo a la red. Se agrega en F15-T01.
