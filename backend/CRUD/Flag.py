from sqlalchemy import select

from schemas import FlagCreateModel
import models

from CRUD.Object import CRUDObject

# Needs a custom Create to handle creation of related objects
class CRUDFlag(CRUDObject):
    async def create(self, flag_in: FlagCreateModel) -> models.Flag:
        # FlagCreateModel has a field for the related Answer and User
        # Get the related objects
        answer = await self.db.execute(select(models.Answer).where(models.Answer.id == flag_in.answer_uuid))
        answer = answer.unique().scalars().first()
        user = await self.db.execute(select(models.User).where(models.User.id == flag_in.user_uuid))
        user = user.unique().scalars().first()
        # Create the flag
        obj_in_data = flag_in.model_dump()
        flag = self.model(**obj_in_data)
        # Set the related objects
        flag.answer = answer
        flag.user = user
        self.db.add(flag)
        await self.db.commit()
        await self.db.refresh(flag)
        return flag
    