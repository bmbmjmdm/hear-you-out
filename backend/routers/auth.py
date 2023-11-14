#  Auth routing for FastAPI with Pydantic, SQLAlchemy

from fastapi import (
    Depends,
    APIRouter,
    HTTPException,
    status,
    responses,
    Query,
    Request,
    Cookie,
    Response,
)
from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from typing import List, Optional, Union, Annotated
from pydantic import BaseModel
from datetime import timedelta

import models, schemas
from database import get_db
import authentication 

class Message(BaseModel):
    message: str


router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
    responses={404: {"description": "Not found"}},
)

@router.post("/register", response_model=schemas.UserExternalModel)
async def register_user(
    user: schemas.UserCreateModel,
    db: AsyncSession = Depends(get_db),
):
    # Create user in database
    user = await authentication.register_user(user)

    # Convert to external model
    user = schemas.UserExternalModel.model_validate(user)
    return user

@router.get("/users/me", response_model=schemas.UserExternalModel)
async def get_user(
    current_user: Annotated[models.User, Depends(authentication.get_current_active_user)],
):
    return schemas.UserExternalModel.model_validate(current_user)

# 2 Login modes:
# 1) Login with device ID. Default, less secure
# 2) Login with username and password. Required for admin

@router.post("/login", response_model=schemas.Token)
async def login_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
):
    # Get user from database
    user = await db.execute(
        select(models.User).where(models.User.device_id == device_id)
    )
    user = user.unique().scalars().first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user found",
        )
    
    if user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admins must login with username and password",
        )

    access_token_expires = timedelta(minutes=authentication.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = await authentication.create_access_token(
        data={"sub": user.device_id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login/username", response_model=schemas.Token)
async def login_username(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    # Get user from database
    user = await authentication.authenticate_user(
        db, form_data.username, form_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=authentication.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = await authentication.create_access_token(
        data={"sub": user.device_id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}