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


def check_list_length(list: List):
    if len(list) == 0:
        raise HTTPException(
            status_code=status.HTTP_204_NO_CONTENT,
            detail="No content",
        )


router = APIRouter(
    prefix="/api",
    tags=["api"],
    responses={404: {"description": "Not found"}},
)


# Always only question of the day
@router.get("/question", response_model=schemas.QuestionExternalLimitedModel)
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
    print(f"question: {question}")
    question = schemas.QuestionExternalLimitedModel.model_validate(question)
    check_list_length(question["answers"])

    return question


@router.post("/answer", response_model=schemas.AnswerExternalModel)
async def submit_answer(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    answer: schemas.AnswerCreateModel,
    db: AsyncSession = Depends(get_db),
):
    answers_CRUD = Answer.CRUDAnswer(db, models.Answer)
    # CRUD create: return answer, audio_data
    answer = await answers_CRUD.create(answer, as_pydantic=True)
    return answer


@router.post("/answer/view", response_model=schemas.AnswerExternalModel)
async def submit_answer_view(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    answer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    answers_CRUD = Answer.CRUDAnswer(db, models.Answer)
    # Get the answer
    answer = await answers_CRUD.get(id=answer_id)
    if answer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Answer not found",
        )
    # Increment the view count
    answer = await answers_CRUD.view(answer, user, as_pydantic=True)
    print(f"answer: {answer}")
    return answer


@router.get("/answers", response_model=List[schemas.AnswerExternalModel])
async def get_answers(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    db: AsyncSession = Depends(get_db),
    ids: List[uuid.UUID] = Query(None),
    questions_ids: List[uuid.UUID] = Query(None),
):
    answers_CRUD = Answer.CRUDAnswer(db, models.Answer)
    kwargs = {}
    if questions_ids is not None:
        kwargs["question_id"] = questions_ids
    if ids is not None:
        kwargs["id"] = ids
    answers = await answers_CRUD.get_multi(as_pydantic=True, **kwargs)
    check_list_length(answers)
    return answers


@router.get("/answers/views", response_model=List[schemas.AnswerExternalViewsModel])
async def get_answers_views(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    db: AsyncSession = Depends(get_db),
    ids: List[uuid.UUID] = Query(None),
):
    answers_CRUD = Answer.CRUDAnswer(db, models.Answer)
    answers = await answers_CRUD.get_views_multi(id=ids, as_pydantic=True)
    check_list_length(answers)
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
