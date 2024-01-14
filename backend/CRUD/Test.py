from sqlalchemy import select
import uuid
from typing import Dict, List, Tuple
from fastapi import HTTPException

from schemas import (
    TestCreateModel,
    TestUpdateModel,
    TestModel,
)
import models
from config import config

from CRUD.Object import CRUDObject, check_related_object


# Needs a custom Create to handle creation of related objects
class CRUDTest(CRUDObject):
    async def create(self, test_in: TestCreateModel) -> models.Test:
        obj_in_data = test_in.model_dump()
        test = models.Test(**obj_in_data)
        try:
            self.db.add(test)
            await self.db.commit()
            await self.db.refresh(test)
        except Exception as e:
            if 'duplicate key value violates unique constraint "tests_name_key"' in str(e):
                raise Exception(f"Test {test.name} already exists")
            raise e
        return test
    
    async def get(self, id: uuid.UUID = None, query_dict: Dict = None) -> models.Test:
        return await super().get(id, query_dict)