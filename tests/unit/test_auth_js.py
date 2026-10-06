"""Autenticación en el cliente. Corresponde a F02-T08.

El comportamiento se prueba en `tests/js/auth.test.mjs` con jsdom y con
el `GoTrueClient` de verdad, porque los criterios de aceptación son
todos de comportamiento —la sesión sobrevive a recargar y a cerrar la
aplicación instalada, el token se renueva solo sin que el usuario note
nada— y dos de los tres no los implementa nuestro código sino la
librería: una prueba que lea el archivo fuente no verifica ninguno.

Acá va lo que sí es estático y lo que no se puede verificar desde
JavaScript:

* que la librería empaquetada no se haya desincronizado de la versión
  instalada,
* que el único archivo que sabe de Supabase sea `auth.js`,
* que el empaquetado no haya traído código que el navegador no pueda
  ejecutar.

La clave de servicio fuera del paquete —el tercer criterio— se verifica
en `test_config_web.py`, junto con el resto de la configuración.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
AUTH = WEB / "src" / "js" / "auth.js"
VENDOR = WEB / "src" / "js" / "vendor" / "auth-js.js"
PREPARAR = RAIZ / "scripts" / "preparar-auth.mjs"

pytestmark = pytest.mark.unit


def _auth() -> str:
    return AUTH.read_text(encoding="utf-8")


def _sin_comentarios(js: str) -> str:
    """El código sin comentarios ni cadenas de documentación.

    Hace falta porque varias de estas pruebas buscan una palabra en el
    archivo, y los comentarios de `auth.js` explican justamente las
    decisiones que se verifican: nombran `sessionStorage` para decir por
    qué no se usa. Una prueba que falle por su propia explicación es
    ruido, y la forma de arreglarla sería borrar el comentario, que es
    lo contrario de lo que queremos.
    """
    js = re.sub(r"/\*.*?\*/", "", js, flags=re.S)
    return re.sub(r"//[^\n]*", "", js)


# ================================================ la librería empaquetada


def test_la_libreria_empaquetada_existe() -> None:
    """Sin ella `auth.js` no se puede importar y la aplicación no
    arranca. Se versiona a propósito, para que el despliegue no dependa
    de que el paso de empaquetado corra."""
    assert VENDOR.exists(), (
        f"falta {VENDOR.relative_to(RAIZ)}. Se genera con `npm run auth:vendor`."
    )
    assert VENDOR.stat().st_size > 10_000, "el archivo está sospechosamente vacío"


def test_la_version_empaquetada_es_la_instalada() -> None:
    """El archivo empaquetado se versiona, así que puede quedar viejo sin
    que nada falle: `npm i @supabase/auth-js@nueva` actualiza
    `node_modules` y no toca `web/`. Entonces se corregiría un bug de la
    librería en `package.json` y el navegador seguiría recibiendo el
    código viejo.
    """
    paquete = RAIZ / "node_modules" / "@supabase" / "auth-js" / "package.json"
    if not paquete.exists():
        pytest.skip("sin node_modules: no hay con qué comparar")

    instalada = json.loads(paquete.read_text(encoding="utf-8"))["version"]
    cabecera = VENDOR.read_text(encoding="utf-8")[:500]
    m = re.search(r"@supabase/auth-js v([\d.]+)", cabecera)

    assert m, "el archivo empaquetado no dice de qué versión es"
    assert m.group(1) == instalada, (
        f"empaquetada v{m.group(1)} e instalada v{instalada}. "
        "Correr `npm run auth:vendor` y versionar el resultado."
    )


def test_el_empaquetado_es_reproducible() -> None:
    """Que lo versionado sea lo que el script genera hoy.

    Si alguien editara el archivo a mano —para parchear algo, con la
    mejor intención— el próximo `npm run auth:vendor` se lo llevaría sin
    avisar. Mejor que se entere acá.
    """
    if shutil.which("node") is None:
        pytest.skip("Node no está instalado")
    if not (RAIZ / "node_modules" / "@supabase" / "auth-js").exists():
        pytest.skip("sin node_modules")

    antes = VENDOR.read_bytes()
    r = subprocess.run(
        ["node", str(PREPARAR)], cwd=RAIZ, capture_output=True, text=True, timeout=120
    )
    assert r.returncode == 0, f"el empaquetado falló: {r.stderr}"
    despues = VENDOR.read_bytes()

    assert antes == despues, (
        "el archivo versionado no es el que genera el script. Si fue una "
        "edición a mano, hay que llevarla al script o se va a perder."
    )


def test_el_empaquetado_no_dejo_imports_que_el_navegador_no_resuelve() -> None:
    """La razón de ser del paso de empaquetado.

    El build ESM de la librería trae imports sin extensión
    (`from './AuthClient'`), que Node resuelve y el navegador no. Si
    quedara uno, la aplicación fallaría recién en el navegador, con un
    404 de un archivo que no existe.
    """
    codigo = VENDOR.read_text(encoding="utf-8")
    pendientes = re.findall(r"""(?:^|[\s;])(?:import|from)\s*["']([^"']+)["']""", codigo)
    assert not pendientes, f"quedaron imports sin resolver: {set(pendientes)}"


def test_el_empaquetado_no_trae_rastros_de_react_native() -> None:
    """La librería importa `react-native` en una rama que acá nunca se
    toma. El empaquetado lo reemplaza por un módulo vacío; si apareciera
    el import de verdad, el navegador buscaría un paquete que no
    existe."""
    assert "react-native" not in VENDOR.read_text(encoding="utf-8")


# ============================================= un solo lugar sabe de Supabase


def test_solo_auth_js_sabe_de_supabase() -> None:
    """La regla que hace que cambiar de proveedor sea un cambio local, y
    que un problema de sesión haya que buscarlo en un solo archivo."""
    culpables = []
    for p in (WEB / "src" / "js").rglob("*.js"):
        if p.name == "auth.js" or "vendor" in p.parts:
            continue
        texto = p.read_text(encoding="utf-8")
        for rastro in ("supabase", "GoTrueClient", "access_token", "refresh_token"):
            if rastro in texto:
                culpables.append(f"{p.relative_to(WEB)}: {rastro}")

    assert not culpables, (
        f"estos módulos saben de Supabase y no deberían: {culpables}. Todo pasa por auth.js."
    )


def test_auth_js_no_escribe_html() -> None:
    """Regla 5 de la skill. Este módulo maneja datos que vienen de
    afuera —el email, los mensajes de error del servidor— y no tiene que
    pintar nada: de eso se encarga la pantalla, que escapa."""
    js = _auth()
    assert "innerHTML" not in js
    assert "document.write" not in js


# ================================================ lo que la configuración pide


def test_la_sesion_se_guarda_donde_sobrevive_a_cerrar_la_aplicacion() -> None:
    """`sessionStorage` se borra al cerrar la pestaña o la aplicación
    instalada. El comportamiento se verifica en jsdom; acá se fija la
    decisión para que un cambio de una palabra no pase inadvertido en
    una revisión."""
    js = _sin_comentarios(_auth())
    assert "persistSession: true" in js

    # Se mira el código y no el archivo entero: el comentario que
    # explica justamente por qué no se usa `sessionStorage` lo nombra, y
    # una prueba que falle por su propia explicación no sirve de nada.
    assert "sessionStorage" not in js, (
        "el código usa sessionStorage: la sesión no sobreviviría a cerrar la app"
    )

    # `storage` sin definir significa `localStorage`, que es lo que se
    # quiere. Si alguien lo define, tiene que ser eso.
    m = re.search(r"storage:\s*([\w.]+)", js)
    assert m is None or "localStorage" in m.group(1), f"el cliente guarda la sesión en {m.group(1)}"


def test_la_renovacion_automatica_esta_prendida() -> None:
    """Esta prueba es la única que caza que se apague, y se comprobó.

    Al mutar `autoRefreshToken: true` a `false`, las veintinueve pruebas
    de jsdom **siguieron pasando**. Tiene explicación: `token()` fuerza
    la renovación por su cuenta cuando lo que tiene en mano está por
    vencer, así que todo lo que sale a la red sigue andando. Lo que se
    pierde es la renovación mientras la aplicación está abierta y
    quieta, y eso no se puede verificar sin dejar correr media hora de
    temporizadores.

    O sea: acá no sobra una comprobación estática: es la que sostiene el
    criterio de aceptación «el token se renueva solo sin que el usuario
    note nada».
    """
    assert "autoRefreshToken: true" in _sin_comentarios(_auth())


def test_el_margen_de_renovacion_es_razonable() -> None:
    """Muy corto no sirve —una petición puede llegar vencida— y muy
    largo renueva de más en cada llamada."""
    m = re.search(r"MARGEN_DE_RENOVACION\s*=\s*(\d+)", _auth())
    assert m, "no se encuentra el margen de renovación"
    assert 30 <= int(m.group(1)) <= 300, (
        f"margen de {m.group(1)} s: fuera del rango que tiene sentido"
    )


def test_la_clave_de_la_sesion_no_es_generica() -> None:
    """Dos aplicaciones en el mismo dominio con la misma clave se pisan
    la sesión."""
    m = re.search(r'CLAVE_DE_SESION\s*=\s*"([^"]+)"', _auth())
    assert m, "no se encuentra la clave de la sesión"
    assert "epic" in m.group(1).lower(), f"clave poco específica: {m.group(1)}"


# ============================================= los mensajes no delatan cuentas


def test_ningun_mensaje_dice_si_la_cuenta_existe() -> None:
    """Criterio de F02-T09, pero los mensajes se arman acá.

    El comportamiento —que «no existe» y «contraseña mal» devuelvan lo
    mismo— se verifica en jsdom. Esto es la otra mitad: que ningún texto
    de la lista lo cuente, por si mañana se agrega uno.
    """
    mensajes = re.findall(r'^\s*\w+:\s*"([^"]+)"', _auth(), re.M)
    assert len(mensajes) >= 5, f"se esperaban los mensajes de error, hay {len(mensajes)}"

    delatores = re.compile(
        r"no existe|no est[aá] registrad|ya (existe|est[aá] registrad)|"
        r"email incorrecto|usuario incorrecto|no encontrad",
        re.I,
    )
    culpables = [m for m in mensajes if delatores.search(m)]
    assert not culpables, (
        f"estos mensajes dicen si la cuenta existe: {culpables}. Con eso, el "
        "formulario de ingreso sirve para averiguar qué emails tienen cuenta."
    )
