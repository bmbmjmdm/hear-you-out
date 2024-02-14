from sqlalchemy import select
from fastapi import HTTPException
from typing import List, Type, TypeVar, Dict, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import uuid

from schemas import (
    UserCreateModel,
    UserUpdateModel,
    UserModel,
    UserExternalModel,
    TopicSubscription,
)
import models
from CRUD.Object import CRUDObject, check_related_object
from firebase import Firebase


# Needs a custom Create to handle creation of related objects
class CRUDUser:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _retrieve(
        self,
        ids: List[uuid.UUID] = None,
        query_dict: Dict = None,
        related: List[str] = None,
    ) -> List[models.User]:
        """
        Retrieves a list of users from the database based on the provided ids or query_dict.
        """
        stmt = select(models.User).where(models.User.is_active == True)
        if ids is not None:
            stmt = stmt.where(models.User.id.in_(ids))
        if query_dict:
            for key, value in query_dict.items():
                stmt = stmt.where(getattr(models.User, key) == value)
        if related is not None:
            for related_model in related:
                stmt = stmt.options(selectinload(getattr(models.User, related_model)))

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get(
        self,
        ids: List[uuid.UUID] = None,
        query_dict: Dict = None,
        related: List[str] = None,
    ) -> List[UserModel]:
        """
        Retrieves a list of User models from the database.

        Parameters:
            ids (List[uuid.UUID], optional): A list of UUIDs to filter the users. If provided, only users with these UUIDs will be returned.
            query_dict (Dict, optional): A dictionary of query parameters to filter the users. The keys should be column names and the values should be the values to filter by.
            related (List, optional): A list of related entities to load along with the users. Each entity should be a string representing the name of a relationship.
        """
        users = await self._retrieve(ids, query_dict, related=related)

        return [UserModel.model_validate(user) for user in users]

    async def get_one(
        self, id: uuid.UUID = None, query_dict: Dict = None, related: List[str] = None
    ) -> UserModel:
        """
        Retrieves a single user from the database based on the provided ids or query_dict.

        Parameters:
            id (uuid.UUID, optional): A UUID to filter the users. If provided, only users with this UUID will be returned.
            query_dict (Dict, optional): A dictionary of query parameters to filter the users. The keys should be column names and the values should be the values to filter by.
            related (List, optional): A list of related entities to load along with the users. Each entity should be a string representing the name of a relationship.
        """
        ids = [id]
        if id is None:
            ids = None
        users = await self._retrieve(ids, query_dict, related=related)
        if len(users) == 0:
            raise HTTPException(status_code=404, detail="User not found")

        return UserModel.model_validate(users[0])

    async def change_subscription_status(
        self, user_id: uuid.UUID, topic: TopicSubscription
    ) -> UserModel:
        """
        Changes the subscription status of a user to a topic.
        """
        
        user = await self._retrieve(ids=[user_id])
        user = user[0]
        
        print(f'topic: {topic.topic}, subscription_status: {topic.subscription_status}')
        if topic.subscription_status:
            await Firebase().subscribe_to_topic(topic=topic.topic, tokens=[user.firebase_token])
        else:
            await Firebase().unsubscribe_from_topic(topic=topic.topic, tokens=[user.firebase_token])
        
        topic_subscription = await self.db.execute(
            select(models.TopicSubscription)
            .where(models.TopicSubscription.user_id == user_id)
            .where(models.TopicSubscription.topic == topic.topic)
        )
        topic_subscription = topic_subscription.unique().scalars().first()
        if topic_subscription is None:
            topic_subscription = models.TopicSubscription(
                user_id=user_id,
                topic=topic.topic,
                subscription_status=topic.subscription_status,
            )
            self.db.add(topic_subscription)
        else:
            topic_subscription.subscription_status = topic.subscription_status
        await self.db.commit()
        user = await self._retrieve(ids=[user_id])
        return UserModel.model_validate(user[0])

    async def update(self, user_id: uuid.UUID, user: UserUpdateModel) -> UserModel:
        """
        Updates a user in the database.
        """
        db_user = await self._retrieve(ids=[user_id])
        db_user = db_user[0]
        for key, value in user.model_dump(exclude_unset=True).items():
            setattr(db_user, key, value)
        await self.db.commit()
        await self.db.refresh(db_user)
        return UserModel.model_validate(db_user)
