/* Registra el service worker.
   Va en un archivo aparte y no en línea para que la política de
   contenido pueda mantener `script-src 'self'` sin `unsafe-inline`,
   que es lo que impide que un dato del servidor llegue a ejecutarse.

   Referencia: 02_Documento_Tecnico.md §15, §17 */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
      console.info("[pwa] service worker registrado:", reg.scope);
    } catch (err) {
      // Que falle el registro no debe romper la aplicación: sin service
      // worker se pierde la instalación y el offline, nada más.
      console.warn("[pwa] no se pudo registrar el service worker:", err);
    }
  });
}
