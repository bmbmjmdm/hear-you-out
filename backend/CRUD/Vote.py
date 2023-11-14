from sqlalchemy import select
from fastapi import HTTPException

from schemas import VoteCreateModel
import models

from CRUD.Object import CRUDObject, check_related_object

# Needs a custom Create to handle creation of related objects
class CRUDVote(CRUDObject):
    async def create(self, vote_in: VoteCreateModel) -> models.Vote:
        # VoteCreateModel has a field for the related Answer and User
        # Get the related objects
        answer = await check_related_object(vote_in, models.Answer, "answer_id", self.db)
        user = await check_related_object(vote_in, models.User, "user_id", self.db)
        # Create the flag
        obj_in_data = vote_in.model_dump()
        print(f"obj_in_data: {obj_in_data}")
        vote = models.Vote(**obj_in_data)
        # Set the related objects
        vote.answer = answer
        vote.user = user
        self.db.add(vote)
        await self.db.commit()
        await self.db.refresh(vote)
        print(f"vote: {vote}")
        for field in vote.__dict__:
            print(f"vote.{field}: {getattr(vote, field)}")
        return vote
    