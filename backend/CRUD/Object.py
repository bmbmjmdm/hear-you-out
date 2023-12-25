# CRUD directory is for all the database operations.
# Universal object class for all non-User objects from which other objects inherit
#
from typing import List, Type, TypeVar, Dict, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

import uuid

import models, schemas

# Type indicating Question, Answer, Flag, Vote, Embedding but not User
ModelType = TypeVar("ModelType", models.Question, models.Answer, models.Flag, models.Vote, models.Embedding)
# Type indicating QuestionCreateModel, AnswerCreateModel, FlagCreateModel, VoteCreateModel, EmbeddingCreateModel but not UserCreateModel
CreateSchemaType = TypeVar("CreateSchemaType", schemas.QuestionCreateModel, schemas.AnswerCreateModel, schemas.FlagCreateModel, schemas.VoteCreateModel, schemas.EmbeddingCreateModel)
# Type indicating QuestionUpdateModel, AnswerUpdateModel, FlagUpdateModel, VoteUpdateModel, EmbeddingUpdateModel but not UserUpdateModel
UpdateSchemaType = TypeVar("UpdateSchemaType", schemas.QuestionUpdateModel, schemas.AnswerUpdateModel, schemas.FlagUpdateModel, schemas.VoteUpdateModel, schemas.EmbeddingUpdateModel)


# user = await self.db.execute(select(models.User).where(models.User.id == answer_in.user_id))
# user = user.unique().scalars().first()
# if user is None:
#     raise HTTPException(
#         status_code=404,
#         detail="User not found",
#     )

async def check_related_object(model, related_model, related_id_field, db: AsyncSession):
    related_object = await db.execute(select(related_model).where(related_model.id == getattr(model, related_id_field)))
    related_object = related_object.unique().scalars().first()
    if related_object is None:
        raise HTTPException(
            status_code=404,
            detail=f"{related_model.__name__} not found",
        )
    return related_object

class CRUDObject:
    def __init__(self, db: AsyncSession, model: Type[ModelType]):
        self.db = db
        self.model = model

    async def get(self, id: uuid.UUID = None, query_dict: Dict = None) -> ModelType:
        stmt = select(self.model).where(self.model.is_active == True)

        if id is not None:
            stmt = stmt.where(self.model.id == id)
        if query_dict:
            # example:
            # question = await question_CRUD.get(query_dict={"of_the_day": True})
            for key, value in query_dict.items():
                stmt = stmt.where(getattr(self.model, key) == value)


        result = await self.db.execute(stmt)
        obj = result.scalars().first()
        return obj

    async def get_multi(self, skip: int = 0, limit: int = 100, **kwargs) -> List[ModelType]:
        stmt = select(self.model).where(self.model.is_active == True).limit(limit).offset(skip)
        if kwargs:
            print(f"kwargs: {kwargs}")
            # example:
            # kwargs: {'id': [UUID('8233d56f-162c-4d9a-aae1-fe90427bd07d')]}
            for key, value in kwargs.items():
                if isinstance(value, list):
                    stmt = stmt.where(getattr(self.model, key).in_(value))
                else:
                    stmt = stmt.where(getattr(self.model, key) == value)
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