from sqlalchemy import select
import uuid
from typing import Dict, List, Tuple
from fastapi import HTTPException

from schemas import (
    TestGroupCreateModel,
    TestGroupUpdateModel,
    TestGroupModel,
)
import models
from config import config

from CRUD.Object import CRUDObject, check_related_object


# Needs a custom Create to handle creation of related objects
class CRUDTestGroup(CRUDObject):
    async def create(self, test_group_in: TestGroupCreateModel) -> models.TestGroup:
        # TestGroupCreateModel has a field for the related User
        # Get the related objects
        user = await check_related_object(test_group_in, models.User, "user_id", self.db)
        test = await check_related_object(test_group_in, models.Test, "test_id", self.db)
        # Create the test_group
        obj_in_data = test_group_in.model_dump()
        test_group = models.TestGroup(**obj_in_data)
        # Set the related objects
        test_group.user = user
        test_group.test = test
        self.db.add(test_group)
        await self.db.commit()
        await self.db.refresh(test_group)
        return test_group
    