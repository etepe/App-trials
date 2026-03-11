"""
SQLite database for persistent storage of tracks and favorites.
"""
import os
import json
import sqlite3
import logging
from contextlib import contextmanager

logger = logging.getLogger("mountain_explorer.db")

DB_PATH = os.environ.get("DB_PATH", "/app/data/mountain_explorer.db")


def _ensure_dir():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def _get_connection() -> sqlite3.Connection:
    _ensure_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create tables if they don't exist."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tracks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                file_type TEXT NOT NULL DEFAULT '',
                distance_m REAL NOT NULL DEFAULT 0.0,
                duration_sec REAL,
                max_alt_m REAL,
                geojson TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                osm_id TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                elevation REAL,
                type TEXT NOT NULL DEFAULT 'peak',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        logger.info("Database initialized at %s", DB_PATH)


# Initialize on import
init_db()
