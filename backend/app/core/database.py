"""
AWS RDS PostgreSQL Database Connection Module

Replaces Supabase client with SQLAlchemy for direct PostgreSQL access.
"""

import os
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager

from app.core.config import settings


# Database URL from settings
DATABASE_URL = getattr(settings, 'DATABASE_URL', None) or os.getenv(
    'DATABASE_URL',
    f"postgresql://{os.getenv('DB_USER', 'swn_admin')}:{os.getenv('DB_PASSWORD', '')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'secondwatchnetwork')}"
)

# Create SQLAlchemy engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    echo=os.getenv('DEBUG', 'false').lower() == 'true'
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency that provides a database session.
    Use with FastAPI's Depends().
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Context manager for database sessions.
    Use in non-FastAPI contexts.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def execute_query(query: str, params: dict = None) -> list:
    """
    Execute a raw SQL query and return results.
    """
    with get_db_session() as db:
        result = db.execute(text(query), params or {})
        return [dict(row._mapping) for row in result.fetchall()]


def execute_single(query: str, params: dict = None) -> dict:
    """
    Execute a query and return a single result.
    """
    with get_db_session() as db:
        result = db.execute(text(query), params or {})
        row = result.fetchone()
        return dict(row._mapping) if row else None


def execute_insert(query: str, params: dict = None) -> dict:
    """
    Execute an INSERT query and return the inserted row.
    """
    with get_db_session() as db:
        result = db.execute(text(query), params or {})
        db.commit()
        row = result.fetchone()
        return dict(row._mapping) if row else None


def execute_update(query: str, params: dict = None) -> int:
    """
    Execute an UPDATE query and return the number of affected rows.
    """
    with get_db_session() as db:
        result = db.execute(text(query), params or {})
        db.commit()
        return result.rowcount


def execute_delete(query: str, params: dict = None) -> int:
    """
    Execute a DELETE query and return the number of affected rows.
    """
    with get_db_session() as db:
        result = db.execute(text(query), params or {})
        db.commit()
        return result.rowcount


def test_connection() -> bool:
    """
    Test the database connection.
    """
    try:
        with get_db_session() as db:
            db.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False


# Compatibility layer for Supabase-style queries
class DatabaseTable:
    """
    Provides Supabase-like query interface for easier migration.
    Usage: db.table("users").select("*").eq("id", user_id).execute()
    """

    def __init__(self, table_name: str):
        self.table_name = table_name
        self._select_cols = "*"
        self._filters = []
        self._order_by = None
        self._order_desc = False
        self._limit = None
        self._offset = None

    def select(self, columns: str = "*"):
        self._select_cols = columns
        return self

    def eq(self, column: str, value):
        self._filters.append((column, "=", value))
        return self

    def neq(self, column: str, value):
        self._filters.append((column, "!=", value))
        return self

    def gt(self, column: str, value):
        self._filters.append((column, ">", value))
        return self

    def gte(self, column: str, value):
        self._filters.append((column, ">=", value))
        return self

    def lt(self, column: str, value):
        self._filters.append((column, "<", value))
        return self

    def lte(self, column: str, value):
        self._filters.append((column, "<=", value))
        return self

    def like(self, column: str, pattern: str):
        self._filters.append((column, "LIKE", pattern))
        return self

    def ilike(self, column: str, pattern: str):
        self._filters.append((column, "ILIKE", pattern))
        return self

    def is_(self, column: str, value):
        if value is None:
            self._filters.append((column, "IS", None))
        else:
            self._filters.append((column, "=", value))
        return self

    def in_(self, column: str, values: list):
        self._filters.append((column, "IN", values))
        return self

    def order(self, column: str, desc: bool = False):
        self._order_by = column
        self._order_desc = desc
        return self

    def limit(self, count: int):
        self._limit = count
        return self

    def offset(self, count: int):
        self._offset = count
        return self

    def _build_query(self) -> tuple:
        query = f"SELECT {self._select_cols} FROM {self.table_name}"
        params = {}

        if self._filters:
            conditions = []
            for i, (col, op, val) in enumerate(self._filters):
                param_name = f"p{i}"
                if op == "IS" and val is None:
                    conditions.append(f"{col} IS NULL")
                elif op == "IN":
                    params[param_name] = tuple(val)
                    conditions.append(f"{col} IN :{param_name}")
                else:
                    params[param_name] = val
                    conditions.append(f"{col} {op} :{param_name}")
            query += " WHERE " + " AND ".join(conditions)

        if self._order_by:
            direction = "DESC" if self._order_desc else "ASC"
            query += f" ORDER BY {self._order_by} {direction}"

        if self._limit:
            query += f" LIMIT {self._limit}"

        if self._offset:
            query += f" OFFSET {self._offset}"

        return query, params

    def execute(self):
        query, params = self._build_query()
        results = execute_query(query, params)
        return type('Response', (), {'data': results, 'error': None})()

    def single(self):
        self._limit = 1
        query, params = self._build_query()
        result = execute_single(query, params)
        return type('Response', (), {'data': result, 'error': None})()


class DatabaseClient:
    """
    Supabase-compatible database client for easier migration.
    """

    def table(self, table_name: str) -> DatabaseTable:
        return DatabaseTable(table_name)

    def rpc(self, function_name: str, params: dict = None):
        """
        Call a PostgreSQL function.
        """
        param_list = ", ".join([f":{k}" for k in (params or {}).keys()])
        query = f"SELECT * FROM {function_name}({param_list})"
        results = execute_query(query, params or {})
        return type('Response', (), {'data': results, 'error': None})()


# Global database client instance
db_client = DatabaseClient()


def get_database_client() -> DatabaseClient:
    """
    Get the database client (Supabase-compatible interface).
    """
    return db_client
