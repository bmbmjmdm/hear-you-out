from passlib.context import CryptContext
from jose import JWTError, jwt

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from datetime import datetime, timedelta
from typing import Optional, Annotated
import os

import models
import schemas
from database import get_db
from config import config

ACCESS_TOKEN_EXPIRE_MINUTES = config.ACCESS_TOKEN_EXPIRE_MINUTES


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


async def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


async def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


async def get_user(
    db: AsyncSession, username: str
) -> models.User:  # This could be in CRUD
    stmt = select(models.User).where(models.User.username == username)
    result = await db.execute(stmt)
    user = result.scalars().first()
    return user


async def authenticate_user(
    db: AsyncSession, username: str, password: str
) -> models.User:
    user = await get_user(db, username)
    if not user:
        return False
    if not await verify_password(password, user.password):
        return False
    return user


async def create_access_token(
    data: dict, expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, os.environ.get("SECRET_KEY"), os.environ.get("ALGORITHM")
    )
    return encoded_jwt


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            os.environ.get("SECRET_KEY"),
            algorithms=[os.environ.get("ALGORITHM")],
        )
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = await get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: Annotated[models.User, Depends(get_current_user)]
):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_active_admin(
    current_user: Annotated[models.User, Depends(get_current_user)]
):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if not current_user.is_admin:
        raise HTTPException(status_code=400, detail="User is not admin")
    return current_user


async def register_user(
        user: schemas.UserCreateModel,
        db: AsyncSession = Depends(get_db),
        ) -> models.User:
    # If there's only device_id, generate a username, email, and password
    # If there's a username, email, or password, assure they're all present

    if user.username is not None or user.email is not None or user.password is not None:
        if (
            user.username is None
            or user.email is None
            or user.password is None
            or user.device_id is None
        ):
            raise HTTPException(
                status_code=400,
                detail="Device ID or username, email, and password must be provided",
            )
    else:
        user.username = user.device_id
        user.email = f"{user.device_id}@example.com"
        # Hash and salt the password
        user.password = await get_password_hash(user.device_id)

    db_user = models.User(
        device_id=user.device_id,
        username=user.username,
        email=user.email,
        password=await get_password_hash(user.password),
    )
    db.add(db_user)
    try:
        await db.commit()
    except Exception as e:
        print("ERROR REPORT:",e, f"duplicate key value violates unique constraint in str(e): {'duplicate key value violates unique constraint' in str(e)}")
        if "duplicate key value violates unique constraint" in str(e):
            print("SANITY CHECK:", f"username={user.username}, email={user.email}, device_id={user.device_id}")
            print("ERROR DETAILS:", str(e), f"Key (username)=({user.username}) already exists in str(e): {'Key (username)=({user.username}) already exists' in str(e)}")
            print("ERROR DETAILS:", str(e), f"Key (email)=({user.email}) already exists in str(e): {'Key (email)=({user.email}) already exists' in str(e)}")
            print("ERROR DETAILS:", str(e), f"Key (device_id)=({user.device_id}) already exists in str(e): {'Key (device_id)=({user.device_id}) already exists' in str(e)}")
            if f"Key (username)=({user.username}) already exists" in str(e):
                raise HTTPException(
                    status_code=400,
                    detail=f"Username {user.username} already exists",
                )
            elif f"Key (email)=({user.email}) already exists" in str(e):
                raise HTTPException(
                    status_code=400,
                    detail=f"Email {user.email} already exists",
                )
            elif f"Key (device_id)=({user.device_id}) already exists" in str(e):
                raise HTTPException(
                    status_code=400,
                    detail=f"Device ID {user.device_id} already exists",
                )
        raise HTTPException(
            status_code=400,
            detail=f"Error registering user",
        )
    await db.refresh(db_user)
    return db_user