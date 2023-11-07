# Database config for FastAPI, async PostrgresSQL via SQLAlchemy

import os
from typing import AsyncIterator
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import (
  create_async_engine,
  async_sessionmaker,
  AsyncSession,
  AsyncEngine,
)
from sqlalchemy.orm import declarative_base


SQLALCHEMY_DATABASE_URL = f"postgresql+asyncpg://{os.environ.get('DB_USER')}:{os.environ.get('DB_PASSWORD')}@{os.environ.get('DB_HOST')}\
:{os.environ.get('DB_PORT')}/{os.environ.get('DB_NAME')}"
engine = create_async_engine(SQLALCHEMY_DATABASE_URL, echo=True, future=True)
Base = declarative_base()
async_session = async_sessionmaker(engine, expire_on_commit=False)


class DatabaseSessionManager:
    def __init__(self):
        self._engine: AsyncEngine | None = None
        self._sessionmaker: async_sessionmaker | None = None
    
    def init(self, host: str = SQLALCHEMY_DATABASE_URL):
        self._engine = create_async_engine(host, echo=True, future=True)
        self._sessionmaker = async_sessionmaker(bind=self._engine, autocommit=False)

    async def close(self):
        if self._engine is not None:
            raise Exception("DatabaseSessionManager has not been initialized")
        await self._engine.dispose()
        self._engine = None
        self._sessionmaker = None

    @asynccontextmanager
    async def connect(self) -> AsyncIterator[AsyncSession]:
        if self._engine is None:
            raise Exception("DatabaseSessionManager has not been initialized")
        async with self._engine.begin() as conn:
            try:
                yield self._sessionmaker(conn)
            except Exception:
                await conn.rollback()
                raise
    
    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        if self._sessionmaker is None:
            raise Exception("DatabaseSessionManager has not been initialized")
        
        session = self._sessionmaker()
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


session_manager = DatabaseSessionManager()

async def get_db() -> AsyncIterator[AsyncSession]:
    async with session_manager.session() as session:
        yield session