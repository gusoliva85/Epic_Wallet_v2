/* Preferencias de la cuenta · F11-T01
   Referencia: 02_Documento_Tecnico.md §9.1 · General §42

   Hoy sólo hay una preferencia real: el tema. `tema.js` (bloqueante,
   en el <head>) ya lo aplica al instante desde `localStorage`, antes
   de que haya sesión ni cliente de API; este módulo lo que agrega es
   que, una vez que SÍ hay sesión, el tema viaje entre dispositivos a
   través de la cuenta (`GET`/`PUT /api/settings`).

   La reconciliación al sincronizar es a propósito asimétrica:
   - si la cuenta ya tiene un tema guardado, manda sobre lo que haya
     en este dispositivo (es la sincronización real entre dispositivos);
   - si la cuenta todavía no tiene nada guardado pero este dispositivo
     ya había elegido uno (de antes de que existiera esta pantalla),
     se sube ese valor en vez de perderlo, para que quede como la
     preferencia de la cuenta de ahora en más. */

import { api } from "./api.js";

/** Pide la preferencia guardada en la cuenta y la aplica en este
 * dispositivo. Si la cuenta no tiene nada guardado pero el
 * dispositivo sí, sube lo que ya había en vez de perderlo. */
export async function sincronizarTema() {
  let remoto;
  try {
    remoto = await api.get("/settings");
  } catch (e) {
    console.error("preferencias: no se pudo pedir /api/settings", e);
    return;
  }

  if (remoto.theme === "light" || remoto.theme === "dark") {
    window.EpicTema.fijar(remoto.theme);
    return;
  }

  const local = window.EpicTema.preferenciaGuardada();
  if (local) await guardarTema(local);
}

/** Guarda la preferencia en la cuenta y la aplica en este
 * dispositivo. `valor` es "light", "dark" o `null` ("seguir al
 * sistema"). */
export async function guardarTema(valor) {
  if (valor === "light" || valor === "dark") window.EpicTema.fijar(valor);
  else window.EpicTema.seguirAlSistema();

  try {
    await api.put("/settings", { theme: valor ?? null });
  } catch (e) {
    console.error("preferencias: no se pudo guardar el tema", e);
  }
}
