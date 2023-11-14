from sqlalchemy import select

from schemas import VoteCreateModel
import models

from CRUD.Object import CRUDObject

# Needs a custom Create to handle creation of related objects
class CRUDVote(CRUDObject):
    async def create(self, vote_in: VoteCreateModel) -> models.Vote:
        # VoteCreateModel has a field for the related Answer and User
        # Get the related objects
        answer = await self.db.execute(select(models.Answer).where(models.Answer.id == vote_in.answer_uuid))
        answer = answer.unique().scalars().first()
        user = await self.db.execute(select(models.User).where(models.User.id == vote_in.user_uuid))
        user = user.unique().scalars().first()
        # Create the flag
        obj_in_data = vote_in.model_dump()
        vote = self.model(**obj_in_data)
        # Set the related objects
        vote.answer = answer
        vote.user = user
        self.db.add(vote)
        await self.db.commit()
        await self.db.refresh(vote)
        return vote
    