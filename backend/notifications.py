from firebase_admin import messaging, initialize_app, _apps
import json
import requests
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from config import config
from CRUD import User, Question
from schemas import UserModel, Title, Body, Notification, Message
import models

class Firebase:
    def __init__(self):
        if not _apps:
            self.app = initialize_app()
        else:
            self.app = _apps['[DEFAULT]']

    async def send_message(self, message: Message) -> str:
        """
        Sends a message to the Firebase Cloud Messaging service.
        """
        data = None
        notification = None
        if message.data is not None:
            data = message.data
        if message.notification is not None:
            notification = messaging.Notification(
                title=message.notification.title,
                body=message.notification.body,
                image=message.notification.image,
            )
        # Can be send either to a 1) Topic/Condition, 2) Single Device, or 3) Multiple Devices
        match message:
            case Message(topic=str) | Message(condition=str):
                if message.tokens is not None:
                    raise ValueError(
                        "Cannot send message to both topic/condition and specfic device(s)"
                    )
                return messaging.send(
                    messaging.Message(
                        data=data,
                        notification=notification,
                        topic=message.topic,
                        condition=message.condition,
                    )
                )
            case Message(tokens=list):
                if len(message.tokens) == 1:
                    return await messaging.send(
                        messaging.Message(
                            data=data,
                            notification=notification,
                            token=message.tokens[0],
                        )
                    )
                else:
                    return messaging.send_multicast(
                        messaging.MulticastMessage(
                            data=data,
                            notification=notification,
                            tokens=message.tokens,
                        )
                    )
            case _:
                raise ValueError(
                    "Invalid message: must have either topic/condition or tokens"
                )

    async def send_new_question_notification(
        self, db: AsyncSession, message: Message = None
    ) -> str:
        """
        Sends a notification to all users that a new question is now active.
        """
        questionCRUD = Question.CRUDQuestion(db, models.Question)
        question = await questionCRUD.get(query_dict={"of_the_day": True})

        if message is None:
            message = Message(
                topic="new_question",
                notification=Notification(
                    title="New Question",
                    body="A new question is now active! \n" + question.text,
                ),
            )
        return await self.send_message(message)

    async def send_new_answers_notification(self, notification: Notification = None) -> str:
        """
        Sends a notification to all users waiting for answers that new answers are now available.
        """
        if notification is None:
            notification = Notification(
                title="New Answers",
                body="New answers are now available!",
            )
        return await self.send_message(
            Message(
                topic="new_answers",
                notification=notification,
            )
        )