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
from typing import List, Optional, Union, Annotated
from pydantic import BaseModel
from datetime import timedelta
import json

from notifications import default_app
from firebase_admin import credentials, messaging

router = APIRouter(
    prefix="/api/notifications",
    tags=["notifications"],
    responses={404: {"description": "Not found"}},
)

class TestSummary(BaseModel):
    message: str
    response: str


@router.post("/send", response_model=TestSummary)
async def send_notification(
    message_text: str,
):
    default_app

    print(default_app)
    message = messaging.Message(
        data={
            "message": message_text,
        },
        topic="all",
    )
    response = messaging.send(message)
    return TestSummary(message=message_text, response=response)

@router.post("/send_to_device", response_model=TestSummary)
async def send_notification_to_user(
    message_text: str,
    registration_token: str,
):
    message = messaging.Message(
        data={
            "message": message_text,
        },
        token=registration_token,
    )
    response = messaging.send(message)
    response = json.dumps(response)
    return TestSummary(message=message_text, response=response)

@router.post("/send_to_devices", response_model=TestSummary)
async def send_notification_to_users(
    message_text: str,
    registration_tokens: List[str],
):
    message = messaging.MulticastMessage(
        data={
            "message": message_text,
        },
        tokens=registration_tokens,
    )
    response = messaging.send_multicast(message)
    return TestSummary(message=message_text, response=response)