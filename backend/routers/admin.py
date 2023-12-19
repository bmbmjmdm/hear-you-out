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


from typing import List, Optional, Union, Annotated
from pydantic import BaseModel
import uuid
import time
import random

import models, schemas
from database import get_db
import authentication
from config import config
from CRUD.Object import check_related_object


class Message(BaseModel):
    message: str


router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    responses={404: {"description": "Not found"}},
)


# Hidden endpoint for creating the first admin user
@router.post(
    "/create_admin",
    response_model=schemas.UserUpdateAdminModel,
    include_in_schema=not config.HIDDEN_ENDPOINTS,
)
async def create_admin(
    user: schemas.UserCreateModel,
    db: AsyncSession = Depends(get_db),
    password: str = Query(...),
):
    if password != config.ADMIN_SECRET:
        time.sleep(random.randint(1, 5))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )
    # Make sure there is no admin user already
    query = select(models.User).where(models.User.is_admin == True)
    admin = await db.execute(query)
    admin = admin.unique().scalars().first()
    if admin is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin user already exists",
        )
    # Create user in database
    out_user = await authentication.register_user(user, db)
    out_user.is_admin = True
    await db.commit()
    await db.refresh(out_user)

    for field in out_user.__table__.columns:
        print(f"{field.name}: {getattr(out_user, field.name)}")
    # Convert to external model
    out_user = schemas.UserUpdateAdminModel.model_validate(out_user)
    return out_user


@router.post("/users", response_model=List[schemas.UserUpdateAdminModel])
async def register_users(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    users: List[schemas.UserCreateModel],
    db: AsyncSession = Depends(get_db),
):
    # Create user in database
    out_users = []
    for user in users:
        out_user = await authentication.register_user(user, db)
        out_users.append(out_user)

    # Convert to external model
    out_users = [schemas.UserUpdateAdminModel.model_validate(user)]
    return out_users


@router.get("/users", response_model=List[schemas.UserUpdateAdminModel])
async def get_users(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    db: AsyncSession = Depends(get_db),
    ids: Optional[List[uuid.UUID]] = Query(None),
):
    # Get users from database
    query = select(models.User)

    if ids is not None:
        query = query.where(models.User.id.in_(ids))

    users = await db.execute(query)
    users = users.unique().scalars().all()

    if users is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No users found",
        )

    # Convert to external model
    users = [schemas.UserUpdateAdminModel.model_validate(user) for user in users]
    return users


@router.patch("/users", response_model=List[schemas.UserUpdateAdminModel])
async def update_users(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    users: List[schemas.UserUpdateAdminModel],
    db: AsyncSession = Depends(get_db),
):
    # Update users in database
    out_users = []
    db_users = await db.execute(
        select(models.User).where(models.User.id.in_([user.id for user in users]))
    )
    db_users = db_users.unique().scalars().all()
    for db_user, user in zip(db_users, users):
        for field in user.model_fields:
            setattr(db_user, field, getattr(user, field))
        out_users.append(db_user)
    await db.commit()

    for user in out_users:
        await db.refresh(user)

    # Convert to external model
    out_users = [
        schemas.UserUpdateAdminModel.model_validate(user) for user in out_users
    ]
    return out_users


@router.post("/questions", response_model=List[schemas.QuestionUpdateModel])
async def submit_questions(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    questions: List[schemas.QuestionCreateModel],
    db: AsyncSession = Depends(get_db),
):
    # Create questions in database
    db_questions = [models.Question(**question.model_dump()) for question in questions]
    db.add_all(db_questions)
    await db.commit()
    for question in db_questions:
        await db.refresh(question)
        print(f"Question: {question}")
        for field in question.__table__.columns:
            print(f"{field.name}: {getattr(question, field.name)}")

    # Convert to external model
    questions = [
        schemas.QuestionUpdateModel.model_validate(question)
        for question in db_questions
    ]
    return questions


@router.get("/questions", response_model=List[schemas.QuestionUpdateModel])
async def get_questions(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    db: AsyncSession = Depends(get_db),
    ids: List[uuid.UUID] = Query(None),
):
    # Get questions from database
    query = select(models.Question)

    if ids is not None:
        query = query.where(models.Question.id.in_(ids))

    questions = await db.execute(query)
    questions = questions.unique().scalars().all()

    if questions is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No questions found",
        )

    # Convert to external model
    questions = [
        schemas.QuestionUpdateModel.model_validate(question) for question in questions
    ]
    return questions


@router.patch("/questions", response_model=List[schemas.QuestionUpdateModel])
async def update_questions(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    questions: List[schemas.QuestionUpdateModel],
    db: AsyncSession = Depends(get_db),
):
    # Update questions in database
    out_questions = []
    db_questions = await db.execute(
        select(models.Question).where(
            models.Question.id.in_([question.id for question in questions])
        )
    )
    db_questions = db_questions.unique().scalars().all()
    for db_question, question in zip(db_questions, questions):
        for field in question.model_fields:
            setattr(db_question, field, getattr(question, field))
        out_questions.append(db_question)
    await db.commit()

    for question in out_questions:
        await db.refresh(question)

    # Convert to external model
    out_questions = [
        schemas.QuestionUpdateModel.model_validate(question)
        for question in out_questions
    ]
    return out_questions


@router.post("/answers", response_model=List[schemas.AnswerUpdateModel])
async def submit_answers(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    answers: List[schemas.AnswerCreateModel],
    db: AsyncSession = Depends(get_db),
):
    db_answers = []
    for answer in answers:
        # Get the related objects
        user = await check_related_object(answer, models.User, "user_id", db)
        question = await check_related_object(
            answer, models.Question, "question_id", db
        )
        # Save the audio data to audio_files, provided as bytes
        audio_data = answer.audio_data
        audio_location = uuid.uuid4()
        with open(f"{config.AUDIO_FILE_PATH}{audio_location}.wav", "wb") as f:
            f.write(audio_data)
        # Create the answer
        obj_in_data = answer.model_dump()
        db_answer = models.Answer(**obj_in_data)
        # Set the related objects
        db_answer.author = user
        db_answer.question = question
        db_answer.audio_location = audio_location
        db_answers.append(db_answer)
    db.add_all(db_answers)
    await db.commit()
    for answer in db_answers:
        await db.refresh(answer)
    return [
        schemas.AnswerUpdateModel.model_validate(
            {**answer.__dict__, "audio_data": audio_data}
        )
        for answer, audio_data in zip(
            db_answers, [answer.audio_data for answer in answers]
        )
    ]


@router.get("/answers", response_model=List[schemas.AnswerUpdateModel])
async def get_answers(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    db: AsyncSession = Depends(get_db),
    ids: Optional[List[uuid.UUID]] = Query(None),
):
    # Get answers from database
    query = select(models.Answer)

    if ids is not None:
        query = query.where(models.Answer.id.in_(ids))

    answers = await db.execute(query)
    answers = answers.unique().scalars().all()

    if answers is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No answers found",
        )

    # Get the audio data
    answers_audio_data = []
    for answer in answers:
        audio_data = None
        with open(f"{config.AUDIO_FILE_PATH}{answer.audio_location}", "rb") as f:
            audio_data = f.read()
        answers_audio_data.append((answer, audio_data))

    # Convert to external model
    answers = [
        schemas.AnswerUpdateModel.model_validate(
            {**answer.__dict__, "audio_data": audio_data}
        )
        for answer, audio_data in answers_audio_data
    ]
    return answers


@router.patch("/answers", response_model=List[schemas.AnswerUpdateModel])
async def update_answers(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    answers: List[schemas.AnswerUpdateModel],
    db: AsyncSession = Depends(get_db),
):
    # Update answers in database
    out_answers = []
    db_answers = await db.execute(
        select(models.Answer).where(
            models.Answer.id.in_([answer.id for answer in answers])
        )
    )
    db_answers = db_answers.unique().scalars().all()
    for db_answer, answer in zip(db_answers, answers):
        for field in answer.model_fields:
            if field == "audio_data":
                audio_location = uuid.uuid4()
                with open(f"{config.AUDIO_FILE_PATH}{audio_location}.wav", "wb") as f:
                    f.write(answer.audio_data)
                setattr(db_answer, "audio_location", audio_location)
            else:
                setattr(db_answer, field, getattr(answer, field))
        out_answers.append(db_answer)
    await db.commit()

    answers_audio_data = []
    for answer in out_answers:
        await db.refresh(answer)
        audio_data = None
        with open(f"{config.AUDIO_FILE_PATH}{answer.audio_location}", "rb") as f:
            audio_data = f.read()
        answers_audio_data.append((answer, audio_data))

    # Convert to external model
    out_answers = [
        schemas.AnswerUpdateModel.model_validate(
            {**answer.__dict__, "audio_data": audio_data}
        )
        for answer, audio_data in answers_audio_data
    ]


@router.post("/flags", response_model=List[schemas.FlagUpdateModel])
async def submit_flags(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    flags: List[schemas.FlagCreateModel],
    db: AsyncSession = Depends(get_db),
):
    # Create flags in database
    db_flags = [models.Flag(**flag.model_dump()) for flag in flags]
    db.add_all(db_flags)
    await db.commit()
    for flag in db_flags:
        await db.refresh(flag)
        print(f"Flag: {flag}")
        for field in flag.__table__.columns:
            print(f"{field.name}: {getattr(flag, field.name)}")

    # Convert to external model
    flags = [schemas.FlagUpdateModel.model_validate(flag) for flag in db_flags]
    return flags


@router.get("/flags", response_model=List[schemas.FlagUpdateModel])
async def get_flags(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    db: AsyncSession = Depends(get_db),
    ids: Optional[List[uuid.UUID]] = Query(None),
):
    # Get flags from database
    query = select(models.Flag)

    if ids is not None:
        query = query.where(models.Flag.id.in_(ids))

    flags = await db.execute(query)
    flags = flags.unique().scalars().all()

    if flags is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No flags found",
        )

    # Convert to external model
    flags = [schemas.FlagUpdateModel.model_validate(flag) for flag in flags]
    return flags


@router.patch("/flags", response_model=List[schemas.FlagUpdateModel])
async def update_flags(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    flags: List[schemas.FlagUpdateModel],
    db: AsyncSession = Depends(get_db),
):
    # Update flags in database
    out_flags = []
    db_flags = await db.execute(
        select(models.Flag).where(models.Flag.id.in_([flag.id for flag in flags]))
    )
    db_flags = db_flags.unique().scalars().all()
    for db_flag, flag in zip(db_flags, flags):
        for field in flag.model_fields:
            setattr(db_flag, field, getattr(flag, field))
        out_flags.append(db_flag)
    await db.commit()

    for flag in out_flags:
        await db.refresh(flag)

    # Convert to external model
    out_flags = [schemas.FlagUpdateModel.model_validate(flag) for flag in out_flags]
    return out_flags


@router.post("/votes", response_model=List[schemas.VoteUpdateModel])
async def submit_votes(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    votes: List[schemas.VoteCreateModel],
    db: AsyncSession = Depends(get_db),
):
    # Create votes in database
    db_votes = [models.Vote(**vote.model_dump()) for vote in votes]
    db.add_all(db_votes)
    await db.commit()
    for vote in db_votes:
        await db.refresh(vote)
        print(f"Vote: {vote}")
        for field in vote.__table__.columns:
            print(f"{field.name}: {getattr(vote, field.name)}")

    # Convert to external model
    votes = [schemas.VoteUpdateModel.model_validate(vote) for vote in db_votes]
    return votes


@router.get("/votes", response_model=List[schemas.VoteUpdateModel])
async def get_votes(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    db: AsyncSession = Depends(get_db),
    ids: Optional[List[uuid.UUID]] = Query(None),
):
    # Get votes from database
    query = select(models.Vote)

    if ids is not None:
        query = query.where(models.Vote.id.in_(ids))

    votes = await db.execute(query)
    votes = votes.unique().scalars().all()

    if votes is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No votes found",
        )

    # Convert to external model
    votes = [schemas.VoteUpdateModel.model_validate(vote) for vote in votes]
    return votes


@router.patch("/votes", response_model=List[schemas.VoteUpdateModel])
async def update_votes(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    votes: List[schemas.VoteUpdateModel],
    db: AsyncSession = Depends(get_db),
):
    # Update votes in database
    out_votes = []
    db_votes = await db.execute(
        select(models.Vote).where(models.Vote.id.in_([vote.id for vote in votes]))
    )
    db_votes = db_votes.unique().scalars().all()
    for db_vote, vote in zip(db_votes, votes):
        for field in vote.model_fields:
            setattr(db_vote, field, getattr(vote, field))
        out_votes.append(db_vote)
    await db.commit()

    for vote in out_votes:
        await db.refresh(vote)

    # Convert to external model
    out_votes = [schemas.VoteUpdateModel.model_validate(vote) for vote in out_votes]
    return out_votes


@router.post("/embeddings", response_model=List[schemas.EmbeddingUpdateModel])
async def submit_embeddings(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    embeddings: List[schemas.EmbeddingCreateModel],
    db: AsyncSession = Depends(get_db),
):
    # Create embeddings in database
    db_embeddings = [
        models.Embedding(**embedding.model_dump()) for embedding in embeddings
    ]
    db.add_all(db_embeddings)
    await db.commit()
    for embedding in db_embeddings:
        await db.refresh(embedding)
        print(f"Embedding: {embedding}")
        for field in embedding.__table__.columns:
            print(f"{field.name}: {getattr(embedding, field.name)}")

    # Convert to external model
    embeddings = [
        schemas.EmbeddingUpdateModel.model_validate(embedding)
        for embedding in db_embeddings
    ]
    return embeddings


@router.get("/embeddings", response_model=List[schemas.EmbeddingUpdateModel])
async def get_embeddings(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    db: AsyncSession = Depends(get_db),
    ids: Optional[List[uuid.UUID]] = Query(None),
):
    # Get embeddings from database
    query = select(models.Embedding)

    if ids is not None:
        query = query.where(models.Embedding.id.in_(ids))

    embeddings = await db.execute(query)
    embeddings = embeddings.unique().scalars().all()

    if embeddings is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No embeddings found",
        )

    # Convert to external model
    embeddings = [
        schemas.EmbeddingUpdateModel.model_validate(embedding)
        for embedding in embeddings
    ]
    return embeddings


@router.patch("/embeddings", response_model=List[schemas.EmbeddingUpdateModel])
async def update_embeddings(
    admin: Annotated[models.User, Depends(authentication.get_current_active_admin)],
    embeddings: List[schemas.EmbeddingUpdateModel],
    db: AsyncSession = Depends(get_db),
):
    # Update embeddings in database
    out_embeddings = []
    db_embeddings = await db.execute(
        select(models.Embedding).where(
            models.Embedding.id.in_([embedding.id for embedding in embeddings])
        )
    )
    db_embeddings = db_embeddings.unique().scalars().all()
    for db_embedding, embedding in zip(db_embeddings, embeddings):
        for field in embedding.model_fields:
            setattr(db_embedding, field, getattr(embedding, field))
        out_embeddings.append(db_embedding)
    await db.commit()

    for embedding in out_embeddings:
        await db.refresh(embedding)

    # Convert to external model
    out_embeddings = [
        schemas.EmbeddingUpdateModel.model_validate(embedding)
        for embedding in out_embeddings
    ]
    return out_embeddings
