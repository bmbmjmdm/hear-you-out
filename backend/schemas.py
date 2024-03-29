# Schemas for the FastAPI with Pydantic

from typing import List, Optional, Union
from pydantic import BaseModel, Field, validator, UUID4, ConfigDict, SecretStr
from datetime import datetime

# TODO Optional fields for user deletion case are not properly handled, I'll think about it when I need it

# App logic is as follows:
# Question of the day is selected from the database and sent to the frontend
# User can 1) submit an answer, 2) listen to answers and possibly vote (only 'convinced' or nothing) on them (also flag them)
# User can submit an answer by recording audio and submitting it
# Questions are created by the admin
# When answer is submitted, it's embedding is generated and stored in the database

# User. Needs to handle login, registration, admin view, user own view, other user view, update user info
# Currently user is registered and logged via device ID, except for admin making username and password optional


# User


# Base model, with necessary and public fields for all models
class UserBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    is_active: bool = Field(True, description="Whether the model is active")
    device_id: str = Field(..., description="The device ID of the user")
    is_admin: bool = Field(False, description="Whether the user is an admin")
    email: Optional[str] = Field(None, description="The email of the user")
    username: Optional[str] = Field(None, description="The username of the user")
    password: Optional[SecretStr] = Field(None, description="The password of the user")
    firebase_token: Optional[str] = Field(
        None, description="The firebase token of the user"
    )


# Minimal model, for relations with other models
class UserMinimalModel(UserBaseModel):
    id: UUID4 = Field(..., description="The ID of the model")


# User model, with all fields
class UserModel(UserMinimalModel):
    created_at: datetime = Field(..., description="The time of creation of the model")
    updated_at: datetime = Field(
        ..., description="The time of last update of the model"
    )
    # relation fields
    answers_authored: List["AnswerMinimalModel"] = Field(
        ..., description="The answers of the user"
    )
    answers_viewed: List["AnswerMinimalModel"] = Field(
        ..., description="The answers of the user"
    )
    votes: List["VoteMinimalModel"] = Field(..., description="The votes of the user")
    flags: List["FlagMinimalModel"] = Field(..., description="The flags of the user")
    test_groups: List["TestGroupMinimalModel"] = Field(
        ..., description="The test groups of the user"
    )
    topic_subscriptions: List["TopicSubscription"] = Field(
        ..., description="The topic subscriptions of the user"
    )

# Create model, for creating new users
class UserCreateModel(UserBaseModel):
    # given currently users are identified by device ID, username and password are optional
    email: Optional[str] = Field(None, description="The email of the user")
    username: Optional[str] = Field(None, description="The username of the user")
    password: Optional[str] = Field(None, description="The password of the user")

    # Test group dicts have to take form of {"test": test_name, "version": test_version}
    test_groups: List[dict[str, str]] = Field(
        None,
        description="The test groups of the user",
        example=[{"test": "colour", "version": "red"}],
    )

    @validator("username")
    def username_required(cls, v, values, **kwargs):
        if "password" in values and v is None:
            raise ValueError("username is required")
        return v

    @validator("password")
    def password_required(cls, v, values, **kwargs):
        if "username" in values and v is None:
            raise ValueError("password is required")
        return v


# Update from user perspective, for updating user info
class UserUpdateModel(UserMinimalModel):
    email: Optional[str] = Field(None, description="The email of the user")
    username: Optional[str] = Field(None, description="The username of the user")
    password: Optional[SecretStr] = Field(None, description="The password of the user")


# Update from admin perspective, for updating user info
class UserUpdateAdminModel(UserMinimalModel):
    email: Optional[str] = Field(None, description="The email of the user")
    username: Optional[str] = Field(None, description="The username of the user")
    password: Optional[SecretStr] = Field(None, description="The password of the user")
    is_admin: Optional[bool] = Field(None, description="Whether the user is an admin")


# External model, to be returned to the frontend, possibly public
class UserExternalModel(UserModel):
    pass


# Question. Needs to handle admin view, user view, other user view, update question info


# Base model, with necessary and public fields for all models
class QuestionBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    is_active: bool = Field(True, description="Whether the model is active")
    text: str = Field(..., description="The text of the question")
    checklist: List[str] = Field(
        ..., description="The checklist of the question, in markdown"
    )


# Minimal model, for relations with other models
class QuestionMinimalModel(QuestionBaseModel):
    id: UUID4 = Field(..., description="The ID of the model")


# Question model, with all fields
class QuestionModel(QuestionMinimalModel):
    of_the_day: bool = Field(..., description="Whether the question is of the day")
    created_at: datetime = Field(..., description="The time of creation of the model")
    updated_at: datetime = Field(
        ..., description="The time of last update of the model"
    )
    # relation fields
    answers: List["AnswerMinimalModel"] = Field(
        ..., description="The answers of the question"
    )


# Create model, for creating new questions
class QuestionCreateModel(QuestionBaseModel):
    pass


# Update model, for updating question info
class QuestionUpdateModel(QuestionMinimalModel):
    id: Optional[UUID4] = Field(None, description="The ID of the model")
    text: Optional[str] = Field(None, description="The text of the question")
    of_the_day: Optional[bool] = Field(
        None, description="Whether the question is of the day"
    )


# External model, to be returned to the frontend, possibly public
class QuestionExternalModel(QuestionModel):
    pass


# External limited model, with no answers
class QuestionExternalLimitedModel(QuestionMinimalModel):
    pass


# Answer. Needs to handle admin view, user view, other user view, update answer info


# Base model, with necessary and public fields for all models
class AnswerBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    is_active: bool = Field(True, description="Whether the model is active")
    question_id: UUID4 = Field(
        ..., description="The UUID of the question of the answer"
    )
    user_id: UUID4 = Field(..., description="The UUID of the user of the answer")
    views_count: int = Field(0, description="The number of views of the answer")
    unique_views: int = Field(0, description="The number of unique views of the answer")
    votes_count: int = Field(0, description="The number of votes of the answer")
    flags_count: int = Field(0, description="The number of flags of the answer")


# Minimal model, for relations with other models
class AnswerMinimalModel(AnswerBaseModel):
    id: UUID4 = Field(..., description="The ID of the model")
    audio_location: UUID4 = Field(
        ..., description="The location of the audio file of the answer"
    )


# Answer model, with all fields
class AnswerModel(AnswerMinimalModel):
    created_at: datetime = Field(..., description="The time of creation of the model")
    updated_at: datetime = Field(
        ..., description="The time of last update of the model"
    )
    audio_location: UUID4 = Field(
        ..., description="The location of the audio file of the answer"
    )
    # relation fields
    author: "UserMinimalModel" = Field(..., description="The author of the answer")
    viewed_by: List["UserMinimalModel"] = Field(
        ..., description="The users who viewed the answer"
    )
    question: "QuestionMinimalModel" = Field(
        ..., description="The question of the answer"
    )
    embeddings: List["EmbeddingMinimalModel"] = Field(
        ..., description="The embeddings of the answer"
    )
    votes: List["VoteMinimalModel"] = Field(..., description="The votes of the answer")
    flags: List["FlagMinimalModel"] = Field(..., description="The flags of the answer")


# Create model, for creating new answers
class AnswerCreateModel(AnswerBaseModel):
    model_config = ConfigDict(from_attributes=False)
    audio_data: bytes = Field(..., description="The audio data of the answer")


# Update model, for updating answer info
class AnswerUpdateModel(AnswerMinimalModel):
    audio_data: Optional[bytes] = Field(
        None, description="The audio data of the answer"
    )
    question_id: Optional[UUID4] = Field(
        None, description="The UUID of the question of the answer"
    )
    views_count: Optional[int] = Field(
        None, description="The number of views of the answer"
    )
    unique_views: Optional[int] = Field(
        None, description="The number of unique views of the answer"
    )
    votes_count: Optional[int] = Field(
        None, description="The number of votes of the answer"
    )
    flags_count: Optional[int] = Field(
        None, description="The number of flags of the answer"
    )
    # relation fields
    viewed_by: Optional[List["UserMinimalModel"]] = Field(
        None, description="The users who viewed the answer"
    )
    author: Optional["UserMinimalModel"] = Field(
        None, description="The author of the answer"
    )


# External model, to be returned to the frontend, possibly public
class AnswerExternalModel(AnswerModel):
    audio_data: bytes = Field(..., description="The audio data of the answer")


# Slightly limited external model for standards users
class AnswerExternalUserModel(AnswerMinimalModel):
    audio_data: bytes = Field(..., description="The audio data of the answer")
    question: "QuestionMinimalModel" = Field(
        ..., description="The question of the answer"
    )


# Only ID and views
class AnswerExternalViewsModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID4 = Field(..., description="The ID of the model")
    views_count: int = Field(0, description="The number of views of the answer")


# Embedding. Needs to handle admin view, user view, other user view, update embedding info


# Base model, with necessary and public fields for all models
class EmbeddingBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    is_active: bool = Field(True, description="Whether the model is active")
    embedding: List[float] = Field(..., description="The embedding of the answer")
    model: str = Field(..., description="The model used for the embedding")
    answer_id: UUID4 = Field(..., description="The UUID of the answer of the embedding")


# Minimal model, for relations with other models
class EmbeddingMinimalModel(EmbeddingBaseModel):
    id: UUID4 = Field(..., description="The ID of the model")


# Embedding model, with all fields
class EmbeddingModel(EmbeddingMinimalModel):
    created_at: datetime = Field(..., description="The time of creation of the model")
    updated_at: datetime = Field(
        ..., description="The time of last update of the model"
    )
    # relation fields
    answer: "AnswerMinimalModel" = Field(..., description="The answer of the embedding")


# Create model, for creating new embeddings
class EmbeddingCreateModel(EmbeddingBaseModel):
    pass


# Update model, for updating embedding info
class EmbeddingUpdateModel(EmbeddingMinimalModel):
    embedding: Optional[List[float]] = Field(
        None, description="The embedding of the answer"
    )
    model: Optional[str] = Field(None, description="The model used for the embedding")
    answer_id: Optional[UUID4] = Field(
        None, description="The UUID of the answer of the embedding"
    )


# External model, to be returned to the frontend, possibly public
class EmbeddingExternalModel(EmbeddingModel):
    pass


# Vote. Needs to handle admin view, user view, other user view, update vote info


# Base model, with necessary and public fields for all models
class VoteBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    is_active: bool = Field(True, description="Whether the model is active")
    vote: int = Field(1, description="The vote of the user")
    user_id: UUID4 = Field(..., description="The UUID of the user of the vote")
    answer_id: UUID4 = Field(..., description="The UUID of the answer of the vote")


# Minimal model, for relations with other models
class VoteMinimalModel(VoteBaseModel):
    id: UUID4 = Field(..., description="The ID of the model")


# Vote model, with all fields
class VoteModel(VoteMinimalModel):
    created_at: datetime = Field(..., description="The time of creation of the model")
    updated_at: datetime = Field(
        ..., description="The time of last update of the model"
    )
    # relation fields
    user: "UserMinimalModel" = Field(..., description="The user of the vote")
    answer: "AnswerMinimalModel" = Field(..., description="The answer of the vote")


# Create model, for creating new votes
class VoteCreateModel(VoteBaseModel):
    pass


# Update model, for updating vote info
class VoteUpdateModel(VoteMinimalModel):
    vote: Optional[int] = Field(None, description="The vote of the user")
    user_id: Optional[UUID4] = Field(
        None, description="The UUID of the user of the vote"
    )
    answer_id: Optional[UUID4] = Field(
        None, description="The UUID of the answer of the vote"
    )


# External model, to be returned to the frontend, possibly public
class VoteExternalModel(VoteModel):
    pass


# Flag. Needs to handle admin view, user view, other user view, update flag info


# Base model, with necessary and public fields for all models
class FlagBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    is_active: bool = Field(True, description="Whether the model is active")
    reason: str = Field(..., description="The reason of the flag")
    user_id: UUID4 = Field(..., description="The UUID of the user of the flag")
    answer_id: UUID4 = Field(..., description="The UUID of the answer of the flag")


# Minimal model, for relations with other models
class FlagMinimalModel(FlagBaseModel):
    id: UUID4 = Field(..., description="The ID of the model")


# Flag model, with all fields
class FlagModel(FlagMinimalModel):
    created_at: datetime = Field(..., description="The time of creation of the model")
    updated_at: datetime = Field(
        ..., description="The time of last update of the model"
    )
    # relation fields
    user: "UserMinimalModel" = Field(..., description="The user of the flag")
    answer: "AnswerMinimalModel" = Field(..., description="The answer of the flag")


# Create model, for creating new flags
class FlagCreateModel(FlagBaseModel):
    pass


# Update model, for updating flag info
class FlagUpdateModel(FlagMinimalModel):
    reason: Optional[str] = Field(None, description="The reason of the flag")
    user_id: Optional[UUID4] = Field(
        None, description="The UUID of the user of the flag"
    )
    answer_id: Optional[UUID4] = Field(
        None, description="The UUID of the answer of the flag"
    )


# External model, to be returned to the frontend, possibly public
class FlagExternalModel(FlagModel):
    pass


# Test model, for user tests
class TestBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    is_active: bool = Field(True, description="Whether the model is active")
    name: str = Field(..., description="The name of the test")
    description: str = Field(..., description="The description of the test")
    versions: List[str] = Field(..., description="The versions of the test")


# Minimal model, for relations with other models
class TestMinimalModel(TestBaseModel):
    id: UUID4 = Field(..., description="The ID of the model")


# Test model, with all fields
class TestModel(TestMinimalModel):
    created_at: datetime = Field(..., description="The time of creation of the model")
    updated_at: datetime = Field(
        ..., description="The time of last update of the model"
    )
    # relation fields
    test_groups: List["TestGroupMinimalModel"] = Field(
        ..., description="The test groups of the test"
    )


# Create model, for creating new tests
class TestCreateModel(TestBaseModel):
    pass


# Update model, for updating test info
class TestUpdateModel(TestMinimalModel):
    name: Optional[str] = Field(None, description="The name of the test")
    description: Optional[str] = Field(None, description="The description of the test")
    versions: Optional[List[str]] = Field(None, description="The versions of the test")


# TestGroup model, for user tests
class TestGroupBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    is_active: bool = Field(True, description="Whether the model is active")
    test_id: UUID4 = Field(..., description="The UUID of the test of the group")
    user_id: UUID4 = Field(..., description="The UUID of the user of the group")
    version: str = Field(..., description="The version of the test of the group")


# Minimal model, for relations with other models
class TestGroupMinimalModel(TestGroupBaseModel):
    id: UUID4 = Field(..., description="The ID of the model")


# TestGroup model, with all fields
class TestGroupModel(TestGroupMinimalModel):
    created_at: datetime = Field(..., description="The time of creation of the model")
    updated_at: datetime = Field(
        ..., description="The time of last update of the model"
    )

    # relation fields
    test: "TestMinimalModel" = Field(..., description="The test of the group")
    user: "UserMinimalModel" = Field(..., description="The user of the group")


# Create model, for creating new test groups
class TestGroupCreateModel(TestGroupBaseModel):
    pass


# Update model, for updating test group info
class TestGroupUpdateModel(TestGroupMinimalModel):
    test_id: Optional[UUID4] = Field(
        None, description="The UUID of the test of the group"
    )
    user_id: Optional[UUID4] = Field(
        None, description="The UUID of the user of the group"
    )
    version: Optional[str] = Field(
        None, description="The version of the test of the group"
    )


# Token


class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: UUID4


class TokenData(BaseModel):
    username: str | None = None


# Message


class Title(BaseModel):
    title: Optional[str] = Field(None, description="The title of the message")


class Body(BaseModel):
    body: Optional[str] = Field(None, description="The body of the message")


class Image(BaseModel):
    image: Optional[str] = Field(None, description="URL of the image of the message")


class Notification(Title, Body, Image):
    pass


class Message(BaseModel):
    # data: dict of arbitrary string keys and string values
    data: Optional[dict[str, str]] = Field(None, description="The data of the message")
    # notification: dict of keys: title, body, image
    notification: Notification
    # topic: string
    topic: Optional[str] = Field(None, description="The topic of the message")
    # condition: string
    condition: Optional[str] = Field(
        None,
        description="The condition of the message, read more at https://firebase.google.com/docs/cloud-messaging/send-message#send-messages-to-topics",
        example="'TopicA' in topics && ('TopicB' in topics || 'TopicC' in topics)",
    )
    # tokens: list of strings
    tokens: Optional[List[str]] = Field(None, description="The tokens of the message")

    # Require either topic or tokens
    @validator("topic", "tokens")
    def topic_or_tokens_required(cls, v, values, **kwargs):
        if v is None:
            raise ValueError("Either topic or tokens are required")
        return v

    # Require either topic, condition or tokens
    @validator("topic", "condition", "tokens")
    def topic_or_condition_or_tokens_required(cls, v, values, **kwargs):
        if v is None:
            raise ValueError("Either topic, condition or tokens are required")
        return v


# Subscriptions
    
class TopicSubscription(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    topic: str = Field(..., description="The topic of the subscription")
    subscription_status: bool = Field(
        ..., description="Whether the user is subscribed to the topic"
    )


# Rebuild models for relations

TestModel.model_rebuild()
TestGroupModel.model_rebuild()
TestGroupMinimalModel.model_rebuild()
TopicSubscription.model_rebuild()
FlagModel.model_rebuild()
FlagExternalModel.model_rebuild()
VoteModel.model_rebuild()
VoteExternalModel.model_rebuild()
EmbeddingModel.model_rebuild()
EmbeddingExternalModel.model_rebuild()
AnswerModel.model_rebuild()
AnswerExternalModel.model_rebuild()
QuestionModel.model_rebuild()
QuestionExternalModel.model_rebuild()
UserModel.model_rebuild()
UserExternalModel.model_rebuild()
