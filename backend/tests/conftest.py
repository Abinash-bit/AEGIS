import pytest

from app import ratelimit
from app.memory import store


@pytest.fixture(autouse=True)
def tmp_db(tmp_path, monkeypatch):
    """Every test gets its own empty SQLite database; the real backend/data/aegis.db is never touched."""
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "test.db")
    store.init()
    ratelimit.reset_all()          # rate-limit windows start empty for every test
    yield
    ratelimit.reset_all()
