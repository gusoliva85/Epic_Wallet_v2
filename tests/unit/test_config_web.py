"""La clave de servicio no llega al navegador · F02-T08

Criterio de aceptación de la tarea, y el único de los tres que, si
falla, no se puede deshacer: una clave de servicio dentro de un paquete
de navegador ya quedó publicada, y rotarla no borra a quién la vio. Esa
clave **se saltea RLS**, así que da acceso a los datos de todas las
cuentas.

Se revisa todo `web/`, no sólo el archivo generado. Si algún día
alguien la pega en un módulo, en el HTML o en el service worker, esta
prueba tiene que verlo igual.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
GENERADOR = RAIZ / "scripts" / "generar-config.mjs"

# Lo que se publica: todo lo que un navegador puede pedir.
EXTENSIONES = (".js", ".mjs", ".html", ".json", ".css", ".webmanifest")


def _del_env(clave: str) -> str | None:
    valor = os.getenv(clave, "").strip()
    if valor:
        return valor
    archivo = RAIZ / ".env"
    if not archivo.exists():
        return None
    m = re.search(rf"^{clave}\s*=\s*(.+)$", archivo.read_text(encoding="utf-8"), re.M)
    return m.group(1).strip() if m else None


def archivos_publicados() -> list[Path]:
    return [
        p
        for p in WEB.rglob("*")
        if p.is_file() and p.suffix in EXTENSIONES and "node_modules" not in p.parts
    ]


# ========================================================= la clave


def test_la_clave_de_servicio_no_esta_en_ningun_archivo_publicado() -> None:
    secreta = _del_env("SUPABASE_SERVICE_ROLE_KEY")
    if not secreta:
        pytest.skip("no hay SUPABASE_SERVICE_ROLE_KEY con la que comparar")

    culpables = []
    for archivo in archivos_publicados():
        if secreta in archivo.read_text(encoding="utf-8", errors="ignore"):
            culpables.append(str(archivo.relative_to(RAIZ)))

    assert not culpables, (
        f"la clave de servicio aparece en {culpables}. Ya está publicada: "
        "hay que rotarla en Supabase, no sólo borrarla de ahí."
    )


def test_tampoco_esta_el_nombre_del_rol_de_servicio() -> None:
    """Una red más ancha, para la clave que todavía no existe.

    La prueba de arriba compara contra *esta* clave. Si mañana se rota,
    la vieja deja de detectarse. Buscar la forma —el prefijo
    `sb_secret_` y el nombre del rol— atrapa también una clave que esta
    máquina no conoce.
    """
    sospechosos = []
    for archivo in archivos_publicados():
        texto = archivo.read_text(encoding="utf-8", errors="ignore")
        for patron in ("sb_secret_", "service_role", "SERVICE_ROLE_KEY"):
            if patron in texto:
                sospechosos.append(f"{archivo.relative_to(RAIZ)}: {patron}")

    assert not sospechosos, f"hay rastros de la clave de servicio en lo publicado: {sospechosos}"


def test_la_clave_publicable_si_esta_y_eso_esta_bien() -> None:
    """El contrapeso de las dos de arriba.

    Sin esto, un `web/` sin configuración pasaría las dos pruebas
    anteriores por no tener nada. Verde por vacío es el peor verde.
    """
    config = WEB / "public" / "config.js"
    if not config.exists():
        pytest.skip("falta web/public/config.js; lo genera `npm run config`")

    texto = config.read_text(encoding="utf-8")
    assert "supabaseUrl" in texto and "supabaseAnonKey" in texto
    assert ".supabase.co" in texto

    publicable = _del_env("SUPABASE_ANON_KEY")
    if publicable:
        assert publicable in texto, (
            "config.js no tiene la clave publicable del entorno: el build escribió otra cosa"
        )


# ================================================ el generador


def _generar(entorno: dict[str, str], raiz: Path | None = None) -> subprocess.CompletedProcess[str]:
    """Corre el generador contra una raíz de juguete.

    La raíz aparte es lo que hace que estas pruebas sean honestas: sin
    ella correrían sobre el proyecto de verdad, pisarían el `config.js`
    bueno y encontrarían el `.env` bueno justo cuando lo que se quiere
    probar es qué pasa **sin** configuración.
    """
    env = {**os.environ, **entorno}
    return subprocess.run(
        ["node", str(GENERADOR), str(raiz or RAIZ)],
        capture_output=True,
        text=True,
        # Sin esto la consola de Windows decodifica en cp1252 y los
        # acentos del mensaje llegan rotos, así que una comprobación
        # sobre el texto falla por la codificación y no por el mensaje.
        encoding="utf-8",
        errors="replace",
        env=env,
        check=False,
    )


nodo = pytest.mark.skipif(not GENERADOR.exists(), reason="falta scripts/generar-config.mjs")


@nodo
def test_el_generador_rechaza_la_clave_secreta(tmp_path: Path) -> None:
    """La comprobación que evita el accidente irreversible.

    Se prueba con las dos formas de clave secreta que existen: el
    prefijo nuevo `sb_secret_…` y el JWT viejo con `role:
    service_role`.
    """
    import base64

    cuerpo = base64.urlsafe_b64encode(json.dumps({"role": "service_role"}).encode())
    jwt_viejo = f"x.{cuerpo.decode().rstrip('=')}.y"

    tmp = tmp_path
    for clave in ("sb_secret_abcdef123456", jwt_viejo):
        r = _generar(
            {"SUPABASE_URL": "https://x.supabase.co", "SUPABASE_ANON_KEY": clave},
            raiz=tmp,
        )
        assert r.returncode == 1, (
            f"el generador aceptó una clave secreta ({clave[:14]}…): {r.stdout}"
        )
        assert "SECRETA" in r.stderr
    assert not (tmp / "web" / "public" / "config.js").exists(), (
        "rechazó la clave pero escribió el archivo igual"
    )


@nodo
def test_el_generador_acepta_la_publicable(tmp_path: Path) -> None:
    import base64

    cuerpo = base64.urlsafe_b64encode(json.dumps({"role": "anon"}).encode())
    jwt_viejo = f"x.{cuerpo.decode().rstrip('=')}.y"

    for clave in ("sb_publishable_abcdef123456", jwt_viejo):
        r = _generar(
            {"SUPABASE_URL": "https://x.supabase.co", "SUPABASE_ANON_KEY": clave},
            raiz=tmp_path,
        )
        assert r.returncode == 0, f"rechazó una clave válida: {r.stderr}"
        escrito = (tmp_path / "web" / "public" / "config.js").read_text(encoding="utf-8")
        assert clave in escrito


@nodo
def test_sin_configuracion_avisa_fuerte_pero_no_bloquea_el_despliegue(tmp_path: Path) -> None:
    """Avisa y sigue, y la diferencia importa.

    La primera versión cortaba el build. El argumento era bueno —un
    despliegue sin autenticación se ve perfecto hasta
    que alguien intenta entrar— y la decisión estaba mal: bloqueaba
    **todos** los despliegues por una variable del frontend, incluido un
    arreglo urgente de la API que no tiene nada que ver.

    La raíz de juguete no tiene `.env`, así que el generador no tiene de
    dónde sacarla: es el caso de Vercel sin las variables cargadas.
    """
    r = _generar({"SUPABASE_URL": "", "SUPABASE_ANON_KEY": ""}, raiz=tmp_path)

    assert r.returncode == 0, (
        "cortó el build por una variable del frontend: eso bloquea "
        "despliegues que no tienen nada que ver"
    )
    assert "FALTA" in r.stderr
    assert "Environment Variables" in r.stderr, "el aviso no dice dónde se arregla"
    assert "INICIAR SESIÓN" in r.stderr, "el aviso no dice qué deja de funcionar"

    escrito = (tmp_path / "web" / "public" / "config.js").read_text(encoding="utf-8")
    assert "SUPABASE_URL" in escrito and "SUPABASE_ANON_KEY" in escrito, (
        "el config.js vacío no dice qué variables faltan"
    )
    assert "console.error" in escrito, (
        "sin un error en la consola, el navegador no dice nada y el problema "
        "se descubre recién al intentar entrar"
    )
    assert 'supabaseAnonKey: ""' in escrito, "escribió una clave inventada"


# ============================================= el HTML la carga


def test_el_html_carga_la_configuracion_antes_de_los_modulos() -> None:
    """Si `config.js` se cargara después, `auth.js` crearía el cliente
    sin URL ni clave y fallaría al primer intento de entrar."""
    html = (WEB / "index.html").read_text(encoding="utf-8")

    pos_config = html.find('src="/public/config.js"')
    assert pos_config != -1, "index.html no carga /public/config.js"

    primer_modulo = html.find('type="module"')
    assert primer_modulo != -1, "index.html no carga ningún módulo"
    assert pos_config < primer_modulo, (
        "config.js se carga después del primer módulo: auth.js se crearía sin configuración"
    )

    assert 'defer src="/public/config.js"' not in html, (
        "config.js con `defer` corre después de los módulos, que es el "
        "problema que el orden quería evitar"
    )


def test_la_politica_de_contenido_deja_hablar_con_supabase() -> None:
    """`connect-src` tiene que permitir Supabase o la autenticación no
    sale del navegador, y falla de una forma que no dice por qué."""
    vercel = json.loads((RAIZ / "vercel.json").read_text(encoding="utf-8"))
    csp = ""
    for bloque in vercel.get("headers", []):
        for cabecera in bloque.get("headers", []):
            if cabecera.get("key") == "Content-Security-Policy":
                csp = cabecera["value"]

    assert csp, "no hay Content-Security-Policy en vercel.json"
    assert "https://*.supabase.co" in csp, (
        "la CSP no permite conectarse a Supabase: `connect-src` lo bloquea"
    )
    # Y lo que NO tiene que haber: la librería está empaquetada en
    # `vendor/` justamente para no necesitar un CDN.
    assert "'unsafe-inline'" not in csp.split("script-src")[1].split(";")[0], (
        "script-src con unsafe-inline"
    )
