"""
AWS RDS PostgreSQL Database Connection Module

Replaces Supabase client with SQLAlchemy for direct PostgreSQL access.
"""

import os
import json
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


def _convert_row(row_dict: dict) -> dict:
    """
    Convert database row values to JSON-serializable types.
    - UUID -> str
    - Decimal -> float
    - datetime -> ISO string
    """
    from uuid import UUID
    from decimal import Decimal
    from datetime import datetime, date

    converted = {}
    for key, value in row_dict.items():
        if isinstance(value, UUID):
            converted[key] = str(value)
        elif isinstance(value, Decimal):
            converted[key] = float(value)
        elif isinstance(value, datetime):
            converted[key] = value.isoformat()
        elif isinstance(value, date):
            converted[key] = value.isoformat()
        else:
            converted[key] = value
    return converted


def execute_query(query: str, params: dict = None) -> list:
    """
    Execute a raw SQL query and return results.
    """
    with get_db_session() as db:
        result = db.execute(text(query), params or {})
        return [_convert_row(dict(row._mapping)) for row in result.fetchall()]


def execute_single(query: str, params: dict = None) -> dict:
    """
    Execute a query and return a single result.
    """
    with get_db_session() as db:
        result = db.execute(text(query), params or {})
        row = result.fetchone()
        return _convert_row(dict(row._mapping)) if row else None


def execute_insert(query: str, params: dict = None) -> dict:
    """
    Execute an INSERT query and return the inserted row.
    """
    with get_db_session() as db:
        result = db.execute(text(query), params or {})
        db.commit()
        row = result.fetchone()
        return _convert_row(dict(row._mapping)) if row else None


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
    Supports Supabase-style embedded joins: select("*, profile:user_id(name, email)")
    """

    def __init__(self, table_name: str):
        self.table_name = table_name
        self._select_cols = "*"
        self._filters = []
        self._order_by = None
        self._order_desc = False
        self._limit = None
        self._offset = None
        self._single = False
        self._count_mode = None
        self._embedded_joins = []  # List of (alias, foreign_key_or_table, columns)

    def _parse_select_columns(self, columns: str):
        """
        Parse Supabase-style select string and extract embedded joins.
        Format: "*, alias:foreign_key(col1, col2)" or "*, alias:table_name(col1, col2)"
        """
        import re
        self._embedded_joins = []

        # Pattern to match embedded joins: alias:table_or_fk(columns)
        pattern = r'(\w+):(\w+)\(([^)]+)\)'

        # Find all embedded joins
        for match in re.finditer(pattern, columns):
            alias = match.group(1)
            fk_or_table = match.group(2)
            cols = match.group(3)
            self._embedded_joins.append((alias, fk_or_table, cols.strip()))

        # Remove embedded joins from the select columns
        clean_cols = re.sub(pattern, '', columns)
        # Clean up extra commas and whitespace
        clean_cols = re.sub(r',\s*,', ',', clean_cols)
        clean_cols = re.sub(r',\s*$', '', clean_cols)
        clean_cols = re.sub(r'^\s*,', '', clean_cols)
        clean_cols = clean_cols.strip()

        return clean_cols if clean_cols else "*"

    def select(self, columns: str = "*", count: str = None):
        self._select_cols = self._parse_select_columns(columns)
        self._count_mode = count  # "exact" for Supabase compatibility
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

    def _resolve_embedded_joins(self, results: list) -> list:
        """
        Fetch related data for embedded joins and attach to results.
        Supports format: alias:foreign_key(columns) where foreign_key ends with _id
        """
        if not self._embedded_joins or not results:
            return results

        for alias, fk_or_table, cols in self._embedded_joins:
            # Determine the foreign key column and target table
            if fk_or_table.endswith("_id"):
                # foreign_key pattern: profile:user_id(name) -> profiles table via user_id column
                fk_column = fk_or_table
                # Derive table name from foreign key (user_id -> users, profile_id -> profiles)
                # Common patterns in this codebase
                if fk_column == "user_id":
                    target_table = "profiles"
                elif fk_column == "call_sheet_id":
                    target_table = "backlot_call_sheets"
                elif fk_column == "task_list_id":
                    target_table = "backlot_task_lists"
                elif fk_column == "timecard_id":
                    target_table = "backlot_timecards"
                elif fk_column == "label_id":
                    target_table = "backlot_task_labels"
                elif fk_column == "created_by":
                    target_table = "profiles"
                    fk_column = "created_by"
                elif fk_column == "assigned_to":
                    target_table = "profiles"
                    fk_column = "assigned_to"
                else:
                    # Generic: remove _id suffix and pluralize
                    base = fk_column.replace("_id", "")
                    target_table = base + "s" if not base.endswith("s") else base
            else:
                # Direct table reference: profile:profiles(name)
                target_table = fk_or_table
                fk_column = fk_or_table + "_id"  # Assume standard FK naming

            # Collect all foreign key values
            fk_values = list(set(
                str(r.get(fk_column)) for r in results
                if r.get(fk_column) is not None
            ))

            if not fk_values:
                # No FK values, set all to empty dict
                for r in results:
                    r[alias] = None
                continue

            # Fetch related records
            related_query = f"SELECT id, {cols} FROM {target_table} WHERE id IN :ids"
            try:
                related_results = execute_query(related_query, {"ids": tuple(fk_values)})
                related_by_id = {str(rr["id"]): rr for rr in related_results}
            except Exception as e:
                # If query fails, set alias to None
                print(f"Warning: embedded join for {alias} failed: {e}")
                for r in results:
                    r[alias] = None
                continue

            # Attach related data to results
            for r in results:
                fk_val = str(r.get(fk_column, ""))
                r[alias] = related_by_id.get(fk_val)

        return results

    def execute(self):
        query, params = self._build_query()

        # Handle count mode (Supabase compatibility)
        if self._count_mode == "exact":
            count_query = f"SELECT COUNT(*) as cnt FROM {self.table_name}"
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
                count_query += " WHERE " + " AND ".join(conditions)
            count_result = execute_single(count_query, params)
            count_value = count_result["cnt"] if count_result else 0
            results = execute_query(query, params)
            results = self._resolve_embedded_joins(results)
            return type('Response', (), {'data': results, 'error': None, 'count': count_value})()

        if self._single:
            result = execute_single(query, params)
            if result and self._embedded_joins:
                results = self._resolve_embedded_joins([result])
                result = results[0] if results else None
            return type('Response', (), {'data': result, 'error': None, 'count': None})()
        else:
            results = execute_query(query, params)
            results = self._resolve_embedded_joins(results)
            return type('Response', (), {'data': results, 'error': None, 'count': None})()

    def single(self):
        self._limit = 1
        self._single = True
        return self

    def range(self, start: int, end: int):
        """Supabase-style range pagination (0-indexed, inclusive)."""
        self._offset = start
        self._limit = end - start + 1
        return self


class DatabaseInsertBuilder:
    """Handles INSERT operations with Supabase-compatible API."""

    def __init__(self, table_name: str, data: dict | list):
        self.table_name = table_name
        self.data = data if isinstance(data, list) else [data]
        self._returning = "*"

    def _serialize_value(self, value):
        """Convert dict/list to JSON string for PostgreSQL."""
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        return value

    def execute(self):
        results = []
        for row in self.data:
            # Serialize any dict/list values to JSON
            serialized_row = {k: self._serialize_value(v) for k, v in row.items()}
            columns = ", ".join(serialized_row.keys())
            placeholders = ", ".join([f":{k}" for k in serialized_row.keys()])
            query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders}) RETURNING {self._returning}"
            result = execute_insert(query, serialized_row)
            if result:
                results.append(result)
        return type('Response', (), {'data': results, 'error': None})()


class DatabaseUpdateBuilder:
    """Handles UPDATE operations with Supabase-compatible API."""

    def __init__(self, table_name: str, data: dict):
        self.table_name = table_name
        self.data = data
        self._filters = []
        self._returning = "*"

    def _serialize_value(self, value):
        """Convert dict/list to JSON string for PostgreSQL."""
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        return value

    def eq(self, column: str, value):
        self._filters.append((column, "=", value))
        return self

    def neq(self, column: str, value):
        self._filters.append((column, "!=", value))
        return self

    def execute(self):
        if not self._filters:
            raise ValueError("UPDATE requires at least one filter (eq, neq, etc.)")

        set_clause = ", ".join([f"{k} = :set_{k}" for k in self.data.keys()])
        params = {f"set_{k}": self._serialize_value(v) for k, v in self.data.items()}

        conditions = []
        for i, (col, op, val) in enumerate(self._filters):
            param_name = f"where_{i}"
            params[param_name] = val
            conditions.append(f"{col} {op} :{param_name}")

        where_clause = " AND ".join(conditions)
        query = f"UPDATE {self.table_name} SET {set_clause} WHERE {where_clause} RETURNING {self._returning}"

        with get_db_session() as db:
            result = db.execute(text(query), params)
            db.commit()
            rows = [_convert_row(dict(row._mapping)) for row in result.fetchall()]
            return type('Response', (), {'data': rows, 'error': None})()


class DatabaseDeleteBuilder:
    """Handles DELETE operations with Supabase-compatible API."""

    def __init__(self, table_name: str):
        self.table_name = table_name
        self._filters = []

    def eq(self, column: str, value):
        self._filters.append((column, "=", value))
        return self

    def neq(self, column: str, value):
        self._filters.append((column, "!=", value))
        return self

    def in_(self, column: str, values: list):
        self._filters.append((column, "IN", values))
        return self

    def execute(self):
        if not self._filters:
            raise ValueError("DELETE requires at least one filter (eq, neq, etc.)")

        params = {}
        conditions = []
        for i, (col, op, val) in enumerate(self._filters):
            param_name = f"p{i}"
            if op == "IN":
                params[param_name] = tuple(val)
                conditions.append(f"{col} IN :{param_name}")
            else:
                params[param_name] = val
                conditions.append(f"{col} {op} :{param_name}")

        where_clause = " AND ".join(conditions)
        query = f"DELETE FROM {self.table_name} WHERE {where_clause}"

        affected = execute_delete(query, params)
        return type('Response', (), {'data': None, 'count': affected, 'error': None})()


class DatabaseUpsertBuilder:
    """Handles UPSERT operations with Supabase-compatible API."""

    def __init__(self, table_name: str, data: dict | list, on_conflict: str = None):
        self.table_name = table_name
        self.data = data if isinstance(data, list) else [data]
        self.on_conflict = on_conflict
        self._returning = "*"

    def execute(self):
        results = []
        for row in self.data:
            columns = ", ".join(row.keys())
            placeholders = ", ".join([f":{k}" for k in row.keys()])

            if self.on_conflict:
                update_clause = ", ".join([f"{k} = EXCLUDED.{k}" for k in row.keys() if k != self.on_conflict])
                query = f"""
                    INSERT INTO {self.table_name} ({columns})
                    VALUES ({placeholders})
                    ON CONFLICT ({self.on_conflict}) DO UPDATE SET {update_clause}
                    RETURNING {self._returning}
                """
            else:
                query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders}) RETURNING {self._returning}"

            result = execute_insert(query, row)
            if result:
                results.append(result)
        return type('Response', (), {'data': results, 'error': None})()


class DatabaseTableWithMutations(DatabaseTable):
    """Extended table class that supports insert, update, delete operations."""

    def insert(self, data: dict | list):
        return DatabaseInsertBuilder(self.table_name, data)

    def update(self, data: dict):
        return DatabaseUpdateBuilder(self.table_name, data)

    def delete(self):
        return DatabaseDeleteBuilder(self.table_name)

    def upsert(self, data: dict | list, on_conflict: str = None):
        return DatabaseUpsertBuilder(self.table_name, data, on_conflict)


class DatabaseClient:
    """
    Supabase-compatible database client for easier migration.
    """

    def table(self, table_name: str) -> DatabaseTableWithMutations:
        return DatabaseTableWithMutations(table_name)

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


# ============================================================================
# Unified Client - Abstracts Supabase vs AWS
# ============================================================================

USE_AWS = getattr(settings, 'USE_AWS', False) or os.getenv('USE_AWS', 'false').lower() == 'true'


class UnifiedClient:
    """
    Unified client that provides both database and storage access.
    Compatible with both Supabase and AWS backends.
    """

    def __init__(self, db, storage=None, auth=None):
        self._db = db
        self._storage = storage
        self._auth = auth

    def table(self, table_name: str):
        return self._db.table(table_name)

    def rpc(self, function_name: str, params: dict = None):
        return self._db.rpc(function_name, params)

    @property
    def storage(self):
        if self._storage:
            return self._storage
        # Import S3 storage lazily
        from app.core.storage import storage_client
        return storage_client

    @property
    def auth(self):
        return self._auth


def get_client():
    """
    Get the AWS database client.
    Returns database client with Supabase-compatible API for easy migration.

    All data is stored in AWS RDS PostgreSQL.
    """
    from app.core.storage import storage_client
    return UnifiedClient(db_client, storage_client)
