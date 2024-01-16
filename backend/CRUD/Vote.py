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
        # Assure the user has not already voted on the answer
        try:
            stmt = select(models.Vote).filter(
                models.Vote.answer_id == answer.id,
                models.Vote.user_id == user.id,
            )
            vote = await self.db.execute(stmt)
            vote = vote.scalar_one_or_none()
            if vote is not None:
                raise Exception("User has already voted on this answer")
        except Exception as e:
            if 'Multiple rows were found' in str(e):
                raise Exception("User has already voted on this answer multiple times")
            else:
                raise e
        # Create the Vote object
        obj_in_data = vote_in.model_dump()
        print(f"obj_in_data: {obj_in_data}")
        vote = models.Vote(**obj_in_data)
        # Set the related objects
        vote.answer = answer
        vote.user = user
        self.db.add(vote)
        answer.votes_count += 1
        await self.db.commit()
        await self.db.refresh(vote)
        print(f"vote: {vote}")
        for field in vote.__dict__:
            print(f"vote.{field}: {getattr(vote, field)}")
        return vote
    