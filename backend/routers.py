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
from sqlalchemy.future import select

from typing import List, Optional, Union
from pydantic import BaseModel
import uuid

import models, schemas
from database import get_db


class Message(BaseModel):
  message: str

router = APIRouter(
  prefix="/api",
  tags=["api"],
  responses={404: {"description": "Not found"}},
)


# return 500 if no questions (vs 200 with a FailState response model)
# Always only question of the day
@router.get("/questions", response_model=List[schemas.QuestionExternalModel])
async def get_question(
  db: AsyncSession = Depends(get_db),
  ids: Optional[List[uuid.UUID]] = Query(None),
  limit: Optional[int] = Query(100),
  offset: Optional[int] = Query(0),
):
  # Get questions, by default the question of the day, from database
  query = select(models.Question).limit(limit).offset(offset)

  if ids is not None:
    query = query.where(models.Question.key.in_(ids))
    
  questions = await db.execute(query)
  questions = questions.unique().scalars().all()


  print(questions)
  if questions is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="No questions found",
    )
  print(4)
  # Convert to external model
  questions = [schemas.QuestionExternalModel.model_validate(question) for question in questions]

  return questions


@router.post("/answers", response_model=List[schemas.AnswerExternalModel])
async def submit_answer(
  answer: schemas.AnswerCreateModel,
  db: AsyncSession = Depends(get_db),
):
  # Submit answer to database
  # MADEUP
  answer = models.Answer(
    audio_data=answer.audio_data,
    question_uuid=answer.question_uuid,
  )
  db.add(answer)
  db.commit()
  db.refresh(answer)
  return answer


@router.get("/answers", response_model=List[schemas.AnswerExternalModel])
async def get_answer(
  db: AsyncSession = Depends(get_db),
  ids: Optional[List[uuid.UUID]] = Query(None),
):
  if ids is None:
    # get first 100 answers
    answers = db.query(models.Answer).limit(100).all()
  else:
    answers = db.query(models.Answer).filter(models.Answer.key.in_(ids)).all()

  if answers is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="No answers found",
    )
  return answers


#TODO: add patch when admin role is added
# @router.patch("/answers", response_model=List[schemas.AnswerExternalModel])
# async def update_answer(
#   answer: schemas.AnswerTableSchema,
#   db: AsyncSession = Depends(get_db),
# ):
#   # Update answer in database
#   answer = db.query(models.Answer).filter(models.Answer.key == answer.key).first()
#   if answer is None:
#     raise HTTPException(
#       status_code=status.HTTP_404_NOT_FOUND,
#       detail="No answer found",
#     )
#   db.commit()
#   db.refresh(answer)
#   return answer


# TODO: add ban check on CRUD layer
# Single answer report flag
@router.post("/answers/{answer_id}/report", response_model=Message)
async def report_answer(
  answer_id: uuid.UUID,
  db: AsyncSession = Depends(get_db),
):
  # Report answer in database
  answer = db.query(models.Answer).filter(models.Answer.key == answer_id).first()
  if answer is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="No answer found",
    )
  answer.num_flags += 1
  db.commit()
  return {"message": "Answer reported"}

# TODO: add proper unbanning when admin role is added
# Single answer unban, temporary via token
@router.post("/answers/{answer_id}/unban", response_model=Message)
async def unban_answer(
  answer_id: uuid.UUID,
  unban_token: str,
  db: AsyncSession = Depends(get_db),
):
  # Unban answer in database
  answer = db.query(models.Answer).filter(models.Answer.key == answer_id).first()
  if answer is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="No answer found",
    )
  if answer.unban_token != unban_token:
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Unban token is incorrect",
    )
  answer.is_banned = False
  db.commit()
  return {"message": "Answer unbanned"}


# TODO: add login check here and fucking everywhere
# Rate answer +,- or 0