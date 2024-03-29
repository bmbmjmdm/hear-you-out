from passlib.context import CryptContext
from jose import JWTError, jwt

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from datetime import datetime, timedelta
from typing import Optional, Annotated
import os

import models
import schemas
from database import get_db
from config import config

from CRUD import TestGroup, Test, User

#
ACCESS_TOKEN_EXPIRE_MINUTES = int(config.ACCESS_TOKEN_EXPIRE_MINUTES)
SECRET_KEY = os.environ.get("SECRET_KEY")
ALGORITHM = os.environ.get("ALGORITHM")


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login/username")


async def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


async def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


async def get_user_by_username(
    db: AsyncSession, username: str
) -> models.User:  # This could be in CRUD
    userCRUD = User.CRUDUser(db)
    user = await userCRUD._retrieve(
        query_dict={"username": username},
        related=["answers_authored", "answers_viewed", "topic_subscriptions"],
    )
    return user[0] if len(user) > 0 else None


async def authenticate_user(
    db: AsyncSession, username: str, password: str
) -> models.User:
    user = await get_user_by_username(db, username)
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
    encoded_jwt = jwt.encode(to_encode, key=SECRET_KEY, algorithm=ALGORITHM)
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
            key=SECRET_KEY,
            algorithms=[ALGORITHM],
        )
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = await get_user_by_username(db, username=token_data.username)
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
    # Check if groups are valid
    test_CRUD = Test.CRUDTest(db, models.Test)
    for test_group in user.test_groups:
        try:
            test = await test_CRUD.get(query_dict={"name": test_group["test"]})
            if test is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Test {test_group['test']} not found",
                )
        except KeyError:
            raise HTTPException(
                status_code=400,
                detail=f"Test name not provided",
            )

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
        if "duplicate key value violates unique constraint" in str(e):
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
    created_user = await get_user_by_username(db, username=user.username)

    test_CRUD = Test.CRUDTest(db, models.Test)
    test_group_CRUD = TestGroup.CRUDTestGroup(db, models.TestGroup)
    for test_group in user.test_groups:
        test = await test_CRUD.get(query_dict={"name": test_group["test"]})
        if test is None:
            raise HTTPException(
                status_code=404,
                detail=f"Test {test_group['test']} not found",
            )
        test_group = await test_group_CRUD.create(
            schemas.TestGroupCreateModel(
                user_id=created_user.id,
                test_id=test.id,
                is_active=True,
                version=test_group["version"],
            )
        )
    return db_user
