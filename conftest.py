"""Root conftest.py — pre-loads the real server package.

tests/server/__init__.py causes pytest to register tests/server as the
`server` package. This conftest runs before any test collection and
pre-imports the real server/ package from the project root, so that
`from server import db` in test files resolves correctly.
"""
import sys
import importlib.util
from pathlib import Path

ROOT = Path(__file__).parent

# Ensure project root is first in sys.path
root_str = str(ROOT)
if root_str in sys.path:
    sys.path.remove(root_str)
sys.path.insert(0, root_str)

# Pre-load the real server package so pytest doesn't replace it with
# tests/server/ later. Load it directly by spec to bypass sys.path
# resolution order issues.
_server_init = ROOT / 'server' / '__init__.py'
if _server_init.exists():
    spec = importlib.util.spec_from_file_location(
        'server', str(_server_init),
        submodule_search_locations=[str(ROOT / 'server')]
    )
    _server_mod = importlib.util.module_from_spec(spec)
    sys.modules['server'] = _server_mod
    spec.loader.exec_module(_server_mod)
