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
from enum import Enum

import models, schemas
from database import get_db
import authentication
from CRUD.Object import CRUDObject
from CRUD import Flag, Vote, Answer, Question, User
from firebase import Firebase


class Message(BaseModel):
    message: str


class AnswerSorting(str, Enum):
    random = "random"
    top = "top"
    unset = "unset"


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
    question_CRUD = Question.CRUDQuestion(db, models.Question)
    question = await question_CRUD.get(query_dict={"of_the_day": True})

    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No questions found",
        )

    # Convert to external model
    question = schemas.QuestionExternalLimitedModel.model_validate(question)
    check_list_length([question])

    return question


@router.get("/answers", response_model=List[schemas.AnswerExternalUserModel])
async def get_answers(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    db: AsyncSession = Depends(get_db),
    seen_answers_ids: List[uuid.UUID] = Query(None),
    limit: int = Query(1),
    ids: List[uuid.UUID] = Query(None),
    questions_ids: List[uuid.UUID] = Query(None),
    sorting: AnswerSorting = Query(AnswerSorting.unset),
):
    answers_CRUD = Answer.CRUDAnswer(db, models.Answer)
    question_CRUD = CRUDObject(db, models.Question)
    kwargs = {}

    if seen_answers_ids is not None:
        limit += len(seen_answers_ids)

    if questions_ids is None:
        question = await question_CRUD.get(query_dict={"of_the_day": True})
        if question is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No questions of the day found",
            )
        kwargs["question_id"] = question.id
    else:
        kwargs["question_id"] = questions_ids
    if ids is not None:
        kwargs["id"] = ids

    answers = []
    match sorting:
        case AnswerSorting.random:
            answers = await answers_CRUD.get_multi_least_viewed(
                **kwargs, as_pydantic=True
            )
        case AnswerSorting.top:
            answers = await answers_CRUD.get_multi_top(**kwargs, as_pydantic=True)
        case AnswerSorting.unset:
            answers = await answers_CRUD.get_multi_unset(**kwargs, as_pydantic=True)

    if seen_answers_ids is not None:
        answers = [answer for answer in answers if answer.id not in seen_answers_ids]

    response_answers = []
    for answer in answers:
        response_answer = await answers_CRUD.view(answer, user, as_pydantic=True)
        response_answers.append(response_answer)

    # Currently returns answers including the user's own answers
    # for answer in response_answers:
    #     if answer.author.id == user.id:
    #         response_answers.remove(answer)

    # Pick only limit'th answers from the front
    answers = response_answers[:limit]

    # Convert to AnswerExternalUserModel
    for answer in answers:
        answer = schemas.AnswerExternalUserModel.model_validate(answer)

    check_list_length(answers)
    return answers


@router.post("/answer", response_model=schemas.AnswerExternalModel)
async def submit_answer(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    answer: schemas.AnswerCreateModel,
    db: AsyncSession = Depends(get_db),
):
    answers_CRUD = Answer.CRUDAnswer(db, models.Answer)
    # CRUD create: return answer, audio_data
    answer = await answers_CRUD.create(answer, as_pydantic=True)
    # Send notification to all users subscribed to new answers
    # This could be whole layers of smarter:
    # 1) Run only on every nth answer
    # 2) Run only on every nth answer per user
    firebase = Firebase()
    firebase_report = await firebase.send_new_answers_notification()
    print(f"Firebase report: {firebase_report}")
    return answer


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
    return answer


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
    try:
        vote = await votes_CRUD.create(vote)
    except Exception as e:
        if str(e) == "User has already voted on this answer":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User has already voted on this answer",
            )
        elif str(e) == "User has already voted on this answer multiple times":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User has already voted on this answer multiple times",
            )
        else:
            raise e
    vote = schemas.VoteExternalModel.model_validate(vote)
    return vote


# Change subscription status for new question notifications
@router.post("/subscribe/new_question", response_model=schemas.UserExternalModel)
async def subscribe_new_question(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    user_CRUD = User.CRUDUser(db)
    user = await user_CRUD.change_subscription_status(
        user.id,
        schemas.TopicSubscription(topic="new_question", subscription_status=True),
    )
    user = schemas.UserExternalModel.model_validate(user)
    return user


@router.post("/unsubscribe/new_question", response_model=schemas.UserExternalModel)
async def unsubscribe_new_question(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    user_CRUD = User.CRUDUser(db)
    user = await user_CRUD.change_subscription_status(
        user.id,
        schemas.TopicSubscription(topic="new_question", subscription_status=False),
    )
    user = schemas.UserExternalModel.model_validate(user)
    return user


# Change subscription status for new answers notifications
@router.post("/subscribe/new_answers", response_model=schemas.UserExternalModel)
async def subscribe_new_answers(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    user_CRUD = User.CRUDUser(db)
    user = await user_CRUD.change_subscription_status(
        user.id,
        schemas.TopicSubscription(topic="new_answers", subscription_status=True),
    )
    user = schemas.UserExternalModel.model_validate(user)
    return user


@router.post("/unsubscribe/new_answers", response_model=schemas.UserExternalModel)
async def unsubscribe_new_answers(
    user: Annotated[models.User, Depends(authentication.get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    user_CRUD = User.CRUDUser(db)
    user = await user_CRUD.change_subscription_status(
        user.id,
        schemas.TopicSubscription(topic="new_answers", subscription_status=False),
    )
    user = schemas.UserExternalModel.model_validate(user)
    return user
