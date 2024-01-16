from sqlalchemy import select
from fastapi import HTTPException

from schemas import FlagCreateModel
import models

from CRUD.Object import CRUDObject, check_related_object

# Needs a custom Create to handle creation of related objects
class CRUDFlag(CRUDObject):
    async def create(self, flag_in: FlagCreateModel) -> models.Flag:
        # FlagCreateModel has a field for the related Answer and User
        # Get the related objects
        answer = await check_related_object(flag_in, models.Answer, "answer_id", self.db)
        user = await check_related_object(flag_in, models.User, "user_id", self.db)
        # Create the flag
        obj_in_data = flag_in.model_dump()
        flag = models.Flag(**obj_in_data)
        # Set the related objects
        flag.answer = answer
        flag.user = user
        self.db.add(flag)
        # Add to flags_count in Answer
        answer.flags_count += 1
        # Commit
        await self.db.commit()
        await self.db.refresh(flag)
        return flag
    