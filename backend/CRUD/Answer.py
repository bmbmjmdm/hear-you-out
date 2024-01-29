from sqlalchemy import select
import uuid
from typing import Dict, List, Tuple
from fastapi import HTTPException

from schemas import (
    AnswerCreateModel,
    AnswerExternalModel,
    AnswerUpdateModel,
    AnswerExternalViewsModel,
)
import models
from config import config
import random

from CRUD.Object import CRUDObject, check_related_object


async def retrieve_audio_data(answer: models.Answer) -> bytes:
    # retrieve the audio data
    audio_data = None
    with open(f"{config.AUDIO_FILE_PATH}{answer.audio_location}", "rb") as f:
        audio_data = f.read()
    return audio_data


async def add_audio_and_check_pydantic(
    answers: List[models.Answer], as_pydantic: bool
) -> List[Tuple[models.Answer, bytes]] | List[AnswerExternalModel]:
    # retrieve the audio data
    answers_audio_data = []
    for answer in answers:
        audio_data = await retrieve_audio_data(answer)
        answers_audio_data.append((answer, audio_data))
    if as_pydantic:
        return [
            AnswerExternalModel.model_validate(
                {**answer.__dict__, "audio_data": audio_data}
            )
            for answer, audio_data in answers_audio_data
        ]
    return answers_audio_data


# Needs a custom Create to handle creation of related objects
class CRUDAnswer(CRUDObject):
    # Depending on 'as_pydantic', return either a tuple of (Answer, audio_data) or a pydantic model
    async def get(
        self, id: uuid.UUID, as_pydantic=True, query_dict: Dict = None
    ) -> Tuple[models.Answer, bytes] | AnswerExternalModel:
        answer = await super().get(id, query_dict)
        # retrieve the audio data
        audio_data = None
        with open(f"{config.AUDIO_FILE_PATH}{answer.audio_location}", "rb") as f:
            audio_data = f.read()
        if as_pydantic:
            # Build external model from answer and audio_data
            return AnswerExternalModel.model_validate(
                {**answer.__dict__, "audio_data": audio_data}
            )
        return answer, audio_data

    async def get_multi_top(
        self, skip: int = 0, limit: int = 100, as_pydantic=True, **kwargs
    ) -> List[Tuple[models.Answer, bytes]] | List[AnswerExternalModel]:
        stmt = (
            select(models.Answer)
            .where(self.model.is_active == True)
            .order_by(
                # Sorting is the same, solved division by zero
                (models.Answer.votes_count
                + 1 / models.Answer.unique_views
                + 1).desc()
            )
            .limit(limit)
            .offset(skip)
        )
        if kwargs:
            for key, value in kwargs.items():
                if isinstance(value, list):
                    stmt = stmt.where(getattr(self.model, key).in_(value))
                else:
                    stmt = stmt.where(getattr(self.model, key) == value)
        result = await self.db.execute(stmt)
        answers = result.unique().scalars().all()
        return await add_audio_and_check_pydantic(answers, as_pydantic)

    async def get_multi_least_viewed(
        self, skip: int = 0, limit: int = 100, as_pydantic=True, **kwargs
    ) -> List[Tuple[models.Answer, bytes]] | List[AnswerExternalModel]:
        stmt = (
            select(models.Answer)
            .where(self.model.is_active == True)
            .order_by(models.Answer.unique_views)
            .limit(limit)
            .offset(skip)
        )
        if kwargs:
            for key, value in kwargs.items():
                if isinstance(value, list):
                    stmt = stmt.where(getattr(self.model, key).in_(value))
                else:
                    stmt = stmt.where(getattr(self.model, key) == value)
        result = await self.db.execute(stmt)
        answers = result.unique().scalars().all()
        return await add_audio_and_check_pydantic(answers, as_pydantic)

    async def get_multi_unset(
        self, skip: int = 0, limit: int = 100, as_pydantic=True, **kwargs
    ) -> List[Tuple[models.Answer, bytes]] | List[AnswerExternalModel]:
        # Choose randomly between the two
        if random.choice([True, False]):
            return await self.get_multi_top(skip, limit, as_pydantic, **kwargs)
        return await self.get_multi_least_viewed(skip, limit, as_pydantic, **kwargs)

    async def get_multi(
        self, skip: int = 0, limit: int = 100, as_pydantic=True, **kwargs
    ) -> List[Tuple[models.Answer, bytes]] | List[AnswerExternalModel]:
        stmt = (
            select(models.Answer)
            .where(self.model.is_active == True)
            .limit(limit)
            .offset(skip)
        )
        if kwargs:
            for key, value in kwargs.items():
                if isinstance(value, list):
                    stmt = stmt.where(getattr(self.model, key).in_(value))
                else:
                    stmt = stmt.where(getattr(self.model, key) == value)
        result = await self.db.execute(stmt)
        answers = result.unique().scalars().all()
        # retrieve the audio data
        answers_audio_data = []
        for answer in answers:
            audio_data = None
            with open(f"{config.AUDIO_FILE_PATH}{answer.audio_location}", "rb") as f:
                audio_data = f.read()
            answers_audio_data.append((answer, audio_data))
        if as_pydantic:
            return [
                AnswerExternalModel.model_validate(
                    {**answer.__dict__, "audio_data": audio_data}
                )
                for answer, audio_data in answers_audio_data
            ]
        return answers_audio_data

    async def create(
        self,
        answer_in: AnswerCreateModel,
        as_pydantic=True,
    ) -> Tuple[models.Answer, bytes] | AnswerExternalModel:
        # Get the related objects
        user = await check_related_object(answer_in, models.User, "user_id", self.db)
        question = await check_related_object(
            answer_in, models.Question, "question_id", self.db
        )
        # Save the audio data to audio_files, provided as bytes
        audio_data = answer_in.audio_data
        audio_location = uuid.uuid4()
        with open(f"{config.AUDIO_FILE_PATH}{audio_location}", "wb") as f:
            f.write(audio_data)
        # Create the answer
        obj_in_data = answer_in.model_dump()
        answer = models.Answer(
            **{
                "is_active": obj_in_data["is_active"],
                "question_id": obj_in_data["question_id"],
                "user_id": obj_in_data["user_id"],
            }
        )
        # Set the related objects
        answer.audio_location = audio_location
        answer.author = user
        answer.question = question
        self.db.add(answer)
        await self.db.commit()
        await self.db.refresh(answer)
        if as_pydantic:
            # Build external model from answer and audio_data
            return AnswerExternalModel.model_validate(
                {**answer.__dict__, "audio_data": audio_data}
            )
        return answer, audio_data

    async def update(
        self,
        answer: models.Answer,
        answer_in: AnswerUpdateModel,
        as_pydantic=True,
    ) -> Tuple[models.Answer, bytes] | AnswerExternalModel:
        # Get the related objects
        user = await check_related_object(answer_in, models.User, "user_id", self.db)
        question = await check_related_object(
            answer_in, models.Question, "question_id", self.db
        )
        # Save the audio data to audio_files, provided as bytes
        audio_data = None
        for field in answer_in.__dict__:
            if field == "audio_data":
                audio_data = answer_in.audio_data
                audio_location = uuid.uuid4()
                with open(f"{config.AUDIO_FILE_PATH}{audio_location}", "wb") as f:
                    f.write(audio_data)
                answer_in.audio_location = audio_location
        # Update the answer
        for key in answer_in.model_dump():
            setattr(answer, key, getattr(answer_in, key))
        # Set the related objects
        answer.author = user
        answer.question = question
        answer.audio_location = audio_location

        await self.db.commit()
        await self.db.refresh(answer)
        # retrieve the audio data
        audio_data = None
        with open(f"{config.AUDIO_FILE_PATH}{answer.audio_location}", "rb") as f:
            audio_data = f.read()
        if as_pydantic:
            # Build external model from answer and audio_data
            return AnswerExternalModel.model_validate(
                {**answer.__dict__, "audio_data": audio_data}
            )
        return answer, audio_data

    async def view(
        self, answer: AnswerUpdateModel, user: models.User, as_pydantic=True
    ) -> Tuple[models.Answer, bytes] | AnswerExternalModel:
        # Update the answer with one view more
        answer_model = await self.get(id=answer.id, as_pydantic=False)
        answer_model = answer_model[0]
        answer_model.views_count += 1
        if user not in answer_model.viewed_by:
            answer_model.viewed_by.append(user)
            answer_model.unique_views += 1
        await self.db.commit()
        await self.db.refresh(answer_model)
        answer, audio_data = await self.get(id=answer.id, as_pydantic=False)
        if as_pydantic:
            # Build external model from answer and audio_data
            return AnswerExternalModel.model_validate(
                {**answer_model.__dict__, "audio_data": audio_data}
            )
        return answer_model, audio_data

    async def get_views_multi(
        self, skip: int = 0, limit: int = 100, as_pydantic=True, **kwargs
    ) -> List[models.Answer] | List[AnswerExternalViewsModel]:
        answers = await super().get_multi(skip, limit, **kwargs)
        if as_pydantic:
            return [
                AnswerExternalViewsModel.model_validate(
                    {**answer.__dict__, "audio_data": None}
                )
                for answer in answers
            ]
        return answers
