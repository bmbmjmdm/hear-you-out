from sqlalchemy import select
import uuid
from typing import Dict, List, Tuple, Union
from fastapi import HTTPException

from schemas import (
    QuestionCreateModel,
    QuestionUpdateModel,
    QuestionExternalModel,
)
import models
from config import config
import random

from CRUD.Object import CRUDObject, check_related_object


# Needs a custom Create to handle creation of related objects
class CRUDQuestion(CRUDObject):
    # Depending on 'as_pydantic', return either a pydantic or sqlalchemy model
    async def get(
        self, id: uuid.UUID = None, as_pydantic=True, query_dict: Dict = None
    ) -> Union[QuestionExternalModel, models.Question]:
        question = await super().get(id, query_dict)
        if question is None:
            raise HTTPException(status_code=404, detail="Question not found")
        return question

    async def set_of_the_day(self, id: uuid.UUID, as_pydantic=True) -> QuestionExternalModel:
        """
        Sets a question as question of the day.
        """
        # Unset previous question of the day
        previous_question = await self.get(query_dict={"of_the_day": True})
        if previous_question is not None:
            previous_question.of_the_day = False
            await self.db.commit()
        question = await self.get(id, as_pydantic=False)
        question.of_the_day = True
        await self.db.commit()
        await self.db.refresh(question)
        return QuestionExternalModel.model_validate(question)
