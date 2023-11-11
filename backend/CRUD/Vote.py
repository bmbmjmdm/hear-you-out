from sqlalchemy import select

from schemas import VoteCreateModel

import Object

# Needs a custom Create to handle creation of related objects
class CRUDAnswer(Object.CRUDObject):
    async def create(self, vote_in: VoteCreateModel) -> Object.models.Vote:
        # FlagCreateModel has a field for the related Answer and User
        # Get the related objects
        answer = await self.db.execute(select(Object.models.Answer).where(Object.models.Answer.id == vote_in.answer_uuid))
        answer = answer.unique().scalars().first()
        user = await self.db.execute(select(Object.models.User).where(Object.models.User.id == vote_in.user_uuid))
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
    