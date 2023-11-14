from sqlalchemy import select
import uuid
from typing import Dict, List, Tuple
from fastapi import HTTPException

from schemas import AnswerCreateModel, AnswerExternalModel
import models
from config import config

from CRUD.Object import CRUDObject, check_related_object

# Needs a custom Create to handle creation of related objects
class CRUDAnswer(CRUDObject):
    # Depending on 'as_pydantic', return either a tuple of (Answer, audio_data) or a pydantic model
    async def get(self, id: uuid.UUID, as_pydantic=True, query_dict: Dict = None) -> Tuple[models.Answer, bytes] | AnswerExternalModel:
        answer = await super().get(id, query_dict)
        # retrieve the audio data
        audio_data = None
        with open(f"{config.AUDIO_FILE_PATH}{answer.audio_location}", "rb") as f:
            audio_data = f.read()
        if as_pydantic:
            # Build external model from answer and audio_data
            return AnswerExternalModel.model_validate({**answer.__dict__, 'audio_data':audio_data})
        return answer, audio_data
    
    async def get_multi(self, skip: int = 0, limit: int = 100, as_pydantic=True, **kwargs) -> List[Tuple[models.Answer, bytes]] | List[AnswerExternalModel]:
        answers = await super().get_multi(skip, limit, **kwargs)
        # retrieve the audio data
        answers_audio_data = []
        for answer in answers:
            audio_data = None
            with open(f"{config.AUDIO_FILE_PATH}{answer.audio_location}", "rb") as f:
                audio_data = f.read()
            answers_audio_data.append((answer, audio_data))
        if as_pydantic:
            return [AnswerExternalModel.model_validate({**answer.__dict__, 'audio_data':audio_data}) for answer, audio_data in answers_audio_data]
        return answers_audio_data
            
    async def create(self, answer_in: AnswerCreateModel, as_pydantic=True, ) -> Tuple[models.Answer, bytes] | AnswerExternalModel:
        # Get the related objects
        user = await check_related_object(answer_in, models.User, "user_id", self.db)
        question = await check_related_object(answer_in, models.Question, "question_id", self.db)
        # Save the audio data to audio_files, provided as bytes
        audio_data = answer_in.audio_data
        audio_location = uuid.uuid4()
        with open(f"{config.AUDIO_FILE_PATH}{audio_location}", "wb") as f:
            f.write(audio_data)
        # Create the answer
        obj_in_data = answer_in.model_dump()
        print(f"obj_in_data: {obj_in_data}")
        answer = models.Answer(**{
            "is_active": obj_in_data["is_active"],
            "question_id": obj_in_data["question_id"],
            "user_id": obj_in_data["user_id"],
        })
        # Set the related objects
        print(f"answer: {answer}")
        answer.audio_location = audio_location
        answer.user = user
        answer.question = question
        self.db.add(answer)
        await self.db.commit()
        await self.db.refresh(answer)
        if as_pydantic:
            # Build external model from answer and audio_data
            return AnswerExternalModel.model_validate({**answer.__dict__, 'audio_data':audio_data})
        return answer, audio_data
    
    async def update(self, answer: models.Answer, answer_in: AnswerCreateModel, as_pydantic=True, ) -> Tuple[models.Answer, bytes] | AnswerExternalModel:
        # Get the related objects
        user = await check_related_object(answer_in, models.User, "user_id", self.db)
        question = await check_related_object(answer_in, models.Question, "question_id", self.db)
        # Save the audio data to audio_files, provided as bytes
        audio_data = answer_in.audio_data
        audio_location = uuid.uuid4()
        with open(f"{config.AUDIO_FILE_PATH}{audio_location}", "wb") as f:
            f.write(audio_data)
        # Update the answer
        obj_in_data = answer_in.model_dump()
        answer = models.Answer
        # Set the related objects
        answer.user = user
        answer.question = question
        answer.audio_location = audio_location
        self.db.add(answer)
        await self.db.commit()
        await self.db.refresh(answer)
        # retrieve the audio data
        audio_data = None
        with open(f"{config.AUDIO_FILE_PATH}{answer.audio_location}", "rb") as f:
            audio_data = f.read()
        if as_pydantic:
            # Build external model from answer and audio_data
            return AnswerExternalModel.model_validate({**answer.__dict__, 'audio_data':audio_data})
        return answer, audio_data