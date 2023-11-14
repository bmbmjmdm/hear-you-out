#  Routing for FastAPI with Pydantic, SQLAlchemy

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

from sqlalchemy.ext.asyncio import AsyncSession

from typing import List, Optional, Union, Annotated
from pydantic import BaseModel
import uuid

import models, schemas
from database import get_db
import authentication
from CRUD.Object import CRUDObject
from CRUD import Flag, Vote, Answer

class Message(BaseModel):
    message: str


router = APIRouter(
    prefix="/api",
    tags=["api"],
    responses={404: {"description": "Not found"}},
)

# Always only question of the day
@router.get("/question", response_model=schemas.QuestionExternalModel)
async def get_question_of_the_day(
    db: AsyncSession = Depends(get_db),
):
    question_CRUD = CRUDObject(db, models.Question)
    question = await question_CRUD.get(query_dict={"of_the_day": True})

    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No questions found",
        )

    # Convert to external model
    question = schemas.QuestionExternalModel.model_validate(question)

    return question


@router.post("/answer", response_model=schemas.AnswerExternalModel)
async def submit_answer(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    answer: schemas.AnswerCreateModel,
    db: AsyncSession = Depends(get_db),
):
    answers_CRUD = Answer.CRUDAnswer(db, models.Answer)
    # CRUD create: return answer, audio_data
    answer, audio_data = await answers_CRUD.create(answer)
    # Convert to external model from answer and audio_data
    answer = schemas.AnswerExternalModel.model_validate(answer, audio_data=audio_data)
    return answer


@router.get("/answers", response_model=List[schemas.AnswerExternalModel])
async def get_answers(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    db: AsyncSession = Depends(get_db),
    ids: Optional[List[uuid.UUID]] = Query(None),
):
    answers_CRUD = Answer.CRUDAnswer(db, models.Answer)
    if ids is not None:
        answers_audio_data = await answers_CRUD.get_multi(id=ids)
    else:
        answers_audio_data = await answers_CRUD.get_multi()
    # Convert to external models from answers and audio_data
    answers = [schemas.AnswerExternalModel.model_validate(answer, audio_data=audio_data) for answer, audio_data in answers_audio_data]
    return answers


# Flag answer
@router.post("/flag", response_model=schemas.FlagExternalModel)
async def submit_flag(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    flag: schemas.FlagCreateModel,
    db: AsyncSession = Depends(get_db),
):
    flags_CRUD = Flag.CRUDFlag(db, models.Flag)
    flag = await flags_CRUD.create(flag)
    flag = schemas.FlagExternalModel.model_validate(flag)
    return flag

# Vote answer
@router.post("/vote", response_model=schemas.VoteExternalModel)
async def submit_vote(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    vote: schemas.VoteCreateModel,
    db: AsyncSession = Depends(get_db),
):
    votes_CRUD = Vote.CRUDVote(db, models.Vote)
    vote = await votes_CRUD.create(vote)
    vote = schemas.VoteExternalModel.model_validate(vote)
    return vote