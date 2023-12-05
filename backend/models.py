# Models for database. SQLAlchemy, FastAPI, Pydantic, and PostgresSQL

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    DateTime,
    Float,
    types,
    Table,
)
from sqlalchemy.dialects.postgresql import UUID, BYTEA, ARRAY
from sqlalchemy.orm import relationship, mapped_column, Mapped, deferred
import hashlib

import uuid
from datetime import datetime
from typing import List, Optional, Union

from database import Base

# App logic is as follows:
# Question of the day is selected from the database and sent to the frontend
# User can 1) submit an answer, 2) listen to answers and possibly vote (only 'convinced' or nothing) on them (also flag them)
# User can submit an answer by recording audio and submitting it
# Answers are currently stored on the drive
# Answers's embeddings are stored separately to manage information about models used
#
# Given the above, the database should have the following models:
# User (id-uuid, the user ID; username-string, the user's username; password-string, the user's password)
# Question (id-uuid, the question ID; text-string, the question text)
# Answer (id-uuid, the answer ID; audio_data-bytes, the audio data;)
# Flag (id-uuid, the flag ID; reason-string, the reason for flagging)
# Vote (id-uuid, the vote ID; vote-int, the vote value)
# Embedding (id-uuid, the embedding ID; embedding-array of floats, the embedding; model-string, the model used to generate the embedding)
# QuestionAnswer, a join table between Question and Answer (question_id-uuid, the question ID; answer_id-uuid, the answer ID)
# AnswerVote, a join table between Answer and User (answer_id-uuid, the answer ID; user_id-uuid, the user ID; vote-int, the vote value)
# AnswerFlag, a join table between Answer and User (answer_id-uuid, the answer ID; user_id-uuid, the user ID; flag_id-uuid, the flag ID)
# AnswerEmbedding, a join table between Answer and Embedding (answer_id-uuid, the answer ID; embedding_id-uuid, the embedding ID)
#
# Currently user is registered and logged via device ID, except for admin


class BaseMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
    )


class User(BaseMixin, Base):
    __tablename__ = "users"
    device_id: Mapped[str] = mapped_column(
        unique=True,
        nullable=False,
    )
    username: Mapped[str] = mapped_column(
        nullable=False,
        unique=True,
    )
    email: Mapped[str] = mapped_column(
        nullable=True,
        unique=True,
    )
    #
    password: Mapped[str] = mapped_column(
        nullable=False,
    )
    is_admin: Mapped[bool] = mapped_column(
        nullable=False,
        default=False,
    )

    # relationships
    answers: Mapped[List["Answer"]] = relationship(
        "Answer",
        back_populates="user",
        lazy="selectin",
    )
    votes: Mapped[List["Vote"]] = relationship(
        "Vote",
        back_populates="user",
        lazy="selectin",
    )
    flags: Mapped[List["Flag"]] = relationship(
        "Flag",
        back_populates="user",
        lazy="selectin",
    )


class Question(BaseMixin, Base):
    __tablename__ = "questions"
    text: Mapped[str] = mapped_column(
        nullable=False,
    )
    of_the_day: Mapped[bool] = mapped_column(
        nullable=False,
        default=False,
    )

    # relationships
    answers: Mapped[List["Answer"]] = relationship(
        "Answer",
        back_populates="question",
        lazy="selectin",
    )


class Answer(BaseMixin, Base):
    __tablename__ = "answers"
    audio_location: Mapped[uuid.UUID] = mapped_column(
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,  # Save user data in case of deletion by default
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id"),
        nullable=False,
    )
    views: Mapped[int] = mapped_column(
        nullable=False,
        default=0,
    )
    # relationships
    user: Mapped[User] = relationship(
        "User",
        back_populates="answers",
        lazy="selectin",
    )
    votes: Mapped[List["Vote"]] = relationship(
        "Vote",
        back_populates="answer",
        lazy="selectin",
    )
    flags: Mapped[List["Flag"]] = relationship(
        "Flag",
        back_populates="answer",
        lazy="selectin",
    )
    embeddings: Mapped[List["Embedding"]] = relationship(
        "Embedding",
        back_populates="answer",
        lazy="selectin",
    )
    question: Mapped[Question] = relationship(
        "Question",
        back_populates="answers",
        lazy="selectin",
    )


class Flag(BaseMixin, Base):
    __tablename__ = "flags"
    reason: Mapped[str] = mapped_column(
        nullable=True,  # No reason by default
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,  # Save user data in case of deletion by default
    )
    answer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("answers.id"),
        nullable=False,
    )

    # relationships
    user: Mapped[User] = relationship(
        "User",
        back_populates="flags",
        lazy="selectin",
    )
    answer: Mapped[Answer] = relationship(
        "Answer",
        back_populates="flags",
        lazy="selectin",
    )


class Vote(BaseMixin, Base):
    __tablename__ = "votes"
    vote: Mapped[int] = mapped_column(
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,  # Save user data in case of deletion by default
    )
    answer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("answers.id"),
        nullable=False,
    )

    # relationships
    user: Mapped[User] = relationship(
        "User",
        back_populates="votes",
        lazy="selectin",
    )
    answer: Mapped[Answer] = relationship(
        "Answer",
        back_populates="votes",
        lazy="selectin",
    )


class Embedding(BaseMixin, Base):
    __tablename__ = "embeddings"
    embedding: Mapped[List[float]] = mapped_column(
        ARRAY(Float),
        nullable=False,
    )
    model: Mapped[str] = mapped_column(
        nullable=False,
    )
    answer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("answers.id"),
        nullable=False,
    )

    # relationships
    answer: Mapped[Answer] = relationship(
        "Answer",
        back_populates="embeddings",
        lazy="selectin",
    )
