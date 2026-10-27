"""Los secretos no llegan al navegador ni al repositorio · F11-T04.

Tercer punto de la tarea. Es el único de los tres que, si falla, **no se
puede deshacer**: una clave de servicio dentro de un paquete de
navegador ya quedó publicada, y rotarla no borra a quién la vio. Esa
clave se saltea RLS, así que da acceso a los datos de todas las cuentas
— es decir, rompe de un saque lo único que CLAUDE.md declara no
negociable.

POR QUÉ ESTE ARCHIVO EXISTE SI LA POLÍTICA DICE «NO SE TESTEA EL DESPLIEGUE»

Porque esto no es configuración de despliegue, es «lo que protege un
dato», que es justo el otro lado de la regla. Hubo un
`tests/unit/test_config_web.py` que cubría las dos cosas juntas y se dio
de baja en `9d3f3cc` con los 23 archivos de pruebas de interfaz: la
baja estuvo bien para lo que comprobaba del build —que el generador
corte, que avise, que escriba el archivo— y se llevó de arrastre lo que
no correspondía. Vuelve sólo esa parte, y nada más que esa parte.

El criterio de CLAUDE.md, aplicado literal: *si el test falla, ¿me
enteré de algo que la pantalla no me hubiera mostrado?* Sí. Una clave de
servicio en un `.js` publicado no se ve mirando la aplicación en el
celular: la pantalla funciona igual de bien con ella adentro.
"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"

# Lo que un navegador puede pedir.
EXTENSIONES = (".js", ".mjs", ".html", ".json", ".css", ".webmanifest")

# Las dos formas de clave secreta que usa Supabase: el prefijo nuevo y
# el JWT viejo, que lleva el nombre del rol adentro.
RASTROS = ("sb_secret_", "service_role", "SERVICE_ROLE_KEY")


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
    """Todo `web/`, no sólo el archivo generado: si alguien pega la
    clave en un módulo, en el HTML o en el service worker, hay que
    verlo igual."""
    return [
        p
        for p in WEB.rglob("*")
        if p.is_file() and p.suffix in EXTENSIONES and "node_modules" not in p.parts
    ]


def archivos_del_repositorio() -> list[Path]:
    """Lo que está versionado, que es lo que se publica al repositorio.

    Se le pregunta a Git en vez de recorrer el disco: `.env` existe en
    esta máquina y **tiene** los secretos, y está bien que los tenga
    —está en `.gitignore`—. Lo que no puede pasar es que alguno haya
    quedado en un archivo rastreado.
    """
    salida = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=RAIZ,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return [RAIZ / n for n in salida.split("\0") if n]


# =================================================== el navegador


def test_la_clave_de_servicio_no_esta_en_ningun_archivo_publicado() -> None:
    secreta = _del_env("SUPABASE_SERVICE_ROLE_KEY")
    if not secreta:
        pytest.skip("no hay SUPABASE_SERVICE_ROLE_KEY con la que comparar")

    culpables = [
        str(a.relative_to(RAIZ))
        for a in archivos_publicados()
        if secreta in a.read_text(encoding="utf-8", errors="ignore")
    ]
    assert not culpables, (
        f"la clave de servicio aparece en {culpables}. Ya está publicada: "
        "hay que rotarla en Supabase, no sólo borrarla de ahí."
    )


def test_tampoco_esta_el_nombre_del_rol_de_servicio() -> None:
    """Una red más ancha, para la clave que esta máquina no conoce.

    La prueba de arriba compara contra *esta* clave; si mañana se rota,
    la vieja deja de detectarse. Buscar la forma —el prefijo y el
    nombre del rol— atrapa también una clave ajena.
    """
    sospechosos = [
        f"{a.relative_to(RAIZ)}: {patron}"
        for a in archivos_publicados()
        for patron in RASTROS
        if patron in a.read_text(encoding="utf-8", errors="ignore")
    ]
    assert not sospechosos, f"hay rastros de la clave de servicio en lo publicado: {sospechosos}"


def test_lo_que_si_va_al_navegador_esta(tmp_path: Path) -> None:
    """El contrapeso de las dos de arriba, y no es un adorno.

    Sin esto, un `web/public/config.js` vacío —o que nunca se generó—
    pasaría las dos pruebas anteriores por no tener nada adentro. Verde
    por vacío es el peor verde.
    """
    config = WEB / "public" / "config.js"
    if not config.exists():
        pytest.skip("falta web/public/config.js; lo genera `npm run build`")

    texto = config.read_text(encoding="utf-8")
    assert "supabaseUrl" in texto and "supabaseAnonKey" in texto
    assert ".supabase.co" in texto

    publicable = _del_env("SUPABASE_ANON_KEY")
    if publicable:
        assert publicable in texto, (
            "config.js no tiene la clave publicable del entorno: el build escribió otra cosa"
        )


# =================================================== el repositorio


@pytest.mark.parametrize("variable", ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET"])
def test_ningun_secreto_quedo_en_un_archivo_rastreado(variable: str) -> None:
    """La otra mitad del criterio: «ni en el repositorio».

    Se comparan **valores**, no nombres: los nombres de las dos
    variables aparecen a propósito en `.env.example`, en el README y en
    el documento técnico, y tienen que seguir apareciendo. Lo que no
    puede estar es el valor.
    """
    secreto = _del_env(variable)
    if not secreto:
        pytest.skip(f"no hay {variable} con la que comparar")
    # Un valor corto sería una comparación sin sentido: daría falsos
    # positivos contra cualquier texto.
    assert len(secreto) >= 20, f"{variable} es demasiado corta para ser el secreto real"

    culpables = []
    for archivo in archivos_del_repositorio():
        try:
            if secreto in archivo.read_text(encoding="utf-8", errors="ignore"):
                culpables.append(str(archivo.relative_to(RAIZ)))
        except (OSError, ValueError):
            # Un archivo rastreado que no está en el disco (borrado sin
            # confirmar) o que no se puede leer: no es lo que se busca.
            continue

    assert not culpables, (
        f"{variable} quedó en archivos versionados: {culpables}. "
        "Hay que rotarla en Supabase: el valor ya está en el historial."
    )


def test_el_env_con_los_secretos_no_esta_rastreado() -> None:
    """Lo que hace que la prueba de arriba no sea trivial.

    `.env` tiene los secretos y está bien que los tenga. El día que
    alguien lo agregue al repositorio —un `git add -f`, o un
    `.gitignore` que alguien «limpia»—, los secretos se publican y la
    prueba de arriba lo detectaría, pero conviene decirlo con el
    nombre del archivo.
    """
    rastreados = {a.name for a in archivos_del_repositorio()}
    assert ".env" not in rastreados, ".env está versionado: los secretos ya se publicaron"
    assert ".env.example" in rastreados, "falta .env.example, que sí tiene que estar"
