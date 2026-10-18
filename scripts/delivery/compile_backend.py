"""Compile application modules with Cython and drop the Python sources."""

from __future__ import annotations

import ast
import os
import shutil
import subprocess
import sys
from pathlib import Path

from Cython.Build import cythonize
from setuptools import setup

ROOT = Path("/src")
APP = ROOT / "app"
VERSIONS = ROOT / "alembic" / "versions"
MIGRATION_PACKAGE = APP / "_schema_migrations"
ASSIGNMENT_NAMES = ("revision", "down_revision", "branch_labels", "depends_on")


def _literal_assignments(path: Path) -> dict[str, object]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    values: dict[str, object] = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign) or len(node.targets) != 1:
            continue
        target = node.targets[0]
        if not isinstance(target, ast.Name) or target.id not in ASSIGNMENT_NAMES:
            continue
        values[target.id] = ast.literal_eval(node.value)
    missing = {"revision", "down_revision"} - values.keys()
    if missing:
        raise RuntimeError(f"{path.name} is missing {sorted(missing)}")
    return values


def _stage_migration_modules() -> list[tuple[Path, dict[str, object]]]:
    staged: list[tuple[Path, dict[str, object]]] = []
    MIGRATION_PACKAGE.mkdir(parents=True, exist_ok=True)
    (MIGRATION_PACKAGE / "__init__.py").write_text("__all__ = ()\n", encoding="utf-8")
    for path in sorted(VERSIONS.glob("*.py")):
        values = _literal_assignments(path)
        revision = values["revision"]
        if not isinstance(revision, str):
            raise RuntimeError(f"{path.name} revision is not a string")
        module_path = MIGRATION_PACKAGE / f"m_{revision}.py"
        module_path.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        staged.append((path, values))
    return staged


def _write_migration_stubs(staged: list[tuple[Path, dict[str, object]]]) -> None:
    for path, values in staged:
        revision = values["revision"]
        module_name = f"m_{revision}"
        lines = [f"{name} = {values[name]!r}" for name in ASSIGNMENT_NAMES if name in values]
        lines.extend(
            [
                "",
                "def upgrade():",
                f"    from app._schema_migrations.{module_name} import upgrade as _upgrade",
                "    return _upgrade()",
                "",
                "def downgrade():",
                f"    from app._schema_migrations.{module_name} import downgrade as _downgrade",
                "    return _downgrade()",
                "",
            ]
        )
        path.write_text("\n".join(lines), encoding="utf-8")


def _compile_extensions() -> None:
    os.chdir(ROOT)
    sources = [str(path.relative_to(ROOT)) for path in APP.rglob("*.py")]
    if not sources:
        raise RuntimeError("No Python modules were found to compile")
    extensions = cythonize(
        sources,
        compiler_directives={
            "language_level": "3",
            "annotation_typing": False,
            "embedsignature": False,
            "emit_code_comments": False,
            "boundscheck": False,
            "initializedcheck": False,
        },
        build_dir=str(ROOT / "build"),
        nthreads=0,
    )
    for extension in extensions:
        extension.extra_compile_args = ["-O3", "-g0", "-fno-ident"]
        extension.extra_link_args = ["-s"]
    setup(name="portal-delivery", ext_modules=extensions, script_args=["build_ext", "--inplace"])


def _strip_binaries() -> None:
    binaries = list(APP.rglob("*.so"))
    if not binaries:
        raise RuntimeError("Cython produced no extension modules")
    for binary in binaries:
        subprocess.run(["strip", "--strip-unneeded", str(binary)], check=True)


def _remove_sources() -> None:
    sources = [
        path
        for path in APP.rglob("*")
        if path.is_file() and (path.suffix in {".py", ".c", ".html"} or path.name.endswith(".pyx"))
    ]
    for path in sources:
        path.unlink()
    for path in list(APP.rglob("__pycache__")):
        if path.is_dir():
            shutil.rmtree(path)
    build_dir = ROOT / "build"
    if build_dir.exists():
        shutil.rmtree(build_dir)
    leftover = sorted(APP.rglob("*.py"))
    if leftover:
        raise RuntimeError(f"Python sources remained: {leftover[:10]}")


def _smoke_test() -> None:
    sys.path.insert(0, str(ROOT))
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from app.main import app

    heads = ScriptDirectory.from_config(Config(str(ROOT / "alembic.ini"))).get_heads()
    if not heads:
        raise RuntimeError("Alembic could not read the migration graph")
    if not app.routes:
        raise RuntimeError("Compiled application exposed no routes")
    print(f"compiled-import-ok routes={len(app.routes)} alembic_heads={','.join(heads)}")


def main() -> None:
    staged = _stage_migration_modules()
    _compile_extensions()
    _remove_sources()
    _write_migration_stubs(staged)
    _strip_binaries()
    _smoke_test()


if __name__ == "__main__":
    main()
