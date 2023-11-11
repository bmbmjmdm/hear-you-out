# CRUD directory is for all the database operations.
# Universal object class for all non-User objects from which other objects inherit
#
from typing import Any, Dict, List, Optional, Type, TypeVar, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

import uuid

import models, schemas

# Type indicating Question, Answer, Flag, Vote, Embedding but not User
ModelType = TypeVar("ModelType", models.Question, models.Answer, models.Flag, models.Vote, models.Embedding)
# Type indicating QuestionCreateModel, AnswerCreateModel, FlagCreateModel, VoteCreateModel, EmbeddingCreateModel but not UserCreateModel
CreateSchemaType = TypeVar("CreateSchemaType", schemas.QuestionCreateModel, schemas.AnswerCreateModel, schemas.FlagCreateModel, schemas.VoteCreateModel, schemas.EmbeddingCreateModel)
# Type indicating QuestionUpdateModel, AnswerUpdateModel, FlagUpdateModel, VoteUpdateModel, EmbeddingUpdateModel but not UserUpdateModel
UpdateSchemaType = TypeVar("UpdateSchemaType", schemas.QuestionUpdateModel, schemas.AnswerUpdateModel, schemas.FlagUpdateModel, schemas.VoteUpdateModel, schemas.EmbeddingUpdateModel)


class CRUDObject:
    def __init__(self, db: AsyncSession, model: Type[ModelType]):
        self.db = db
        self.model = model

    async def get(self, id: uuid.UUID = None, **kwargs) -> Optional[ModelType]:
        stmt = select(self.model).where(self.model.is_active == True)

        if id is not None:
            stmt = stmt.where(self.model.id == id)
        if kwargs:
            stmt = stmt.where(**kwargs)

        result = await self.db.execute(stmt)
        obj = result.scalars().first()
        return obj

    async def get_multi(self, skip: int = 0, limit: int = 100, **kwargs) -> List[ModelType]:
        stmt = select(self.model).where(self.model.is_active == True).limit(limit).offset(skip)
        if kwargs:
            stmt = stmt.where(**kwargs)
        result = await self.db.execute(stmt)
        objs = result.unique().scalars().all()
        return objs
    
    async def create(self, obj_in: CreateSchemaType) -> ModelType:
        obj_in_data = obj_in.model_dump()
        obj = self.model(**obj_in_data)
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj
    
    async def update(self, obj: ModelType, obj_in: UpdateSchemaType) -> ModelType:
        obj_data = obj.model_dump()
        update_data = obj_in.model_dump(exclude_unset=True)
        for field in obj_data:
            if field in update_data:
                setattr(obj, field, update_data[field])
        await self.db.commit()
        await self.db.refresh(obj)
        return obj