print("Initializing app")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager

from database import session_manager
from routers import core, auth, admin


def init_app(init_db=True):
    lifespan = None
    
    if init_db:
        session_manager.init()

        @asynccontextmanager
        async def lifespan(app: FastAPI):
            yield
            if session_manager._engine is not None:
                await session_manager.close()
    
    server = FastAPI(title="FastAPI server", lifespan=lifespan)

    server.include_router(core.router)
    server.include_router(auth.router)
    server.include_router(admin.router)
    
    origins = [
    "http://localhost:8000",
    "http://localhost:8080",
    "http://127.0.0.1:8000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:5173/"
    ]

    server.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    server.add_middleware(SessionMiddleware, secret_key="super-secret")

    return server

app = init_app()
