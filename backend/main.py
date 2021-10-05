import os

from typing import List
from random import choice
from deta import Deta, Drive, Base
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import  PlainTextResponse

#from fastapi import FastAPI, File, UploadFile
#from fastapi.responses import HTMLResponse, StreamingResponse
#import uuid

# load local env if we're running locally
if os.environ.get('DETA_RUNTIME') is None:
    load_dotenv(override=True)

secret_key = os.environ.get('DETA_PROJECT_KEY')
deta = Deta(secret_key)
drive = Drive("voice-answers") # access to your drive
questions_db = Base('questions')
answers_db = Base('answers')
app = FastAPI()  # must be app

# questionTable - inherit BaseModel? TODO
# {question_uuid, text, category}

# answerTable - inherit BaseModel? TODO
# {key = answer_uuid, question_uuid, num_flags, is_banned, num_agrees, num_disagrees, num_listens}

class QuestionModel(BaseModel):
    uuid: str
    q: str
    category: str
    
class AnswerSubmission(BaseModel):
    audio_data: bytes
    question_uuid: str # uuid.UUID

class AnswerListen(BaseModel):
    audio_data: bytes
    answer_uuid: str # TODO

# utility
def gen_uuid():
    return 'asdf' #uuid.uuid4()
def name4drive(q, a):
    return f"{q}.{a}"

# handle all exceptions thrown in code below with a 500 http response
@app.exception_handler(Exception)
async def validation_exception_handler(request, exc):
    print(str(exc))
    return PlainTextResponse("uh oh, something unexpected happened", status_code=500)

# TODO turn off caching per docs?
@app.get("/")
async def root():
    return {'hey': 'world'}

@app.get("/getQuestion", response_model=QuestionModel)
async def get_question():
    # get today's question...how? from drive? from base? from internet endpoint? from file?/src
    # - think i want to go with base (need them anwyay). and can dev separate micro to insert Qs to it! or separate endpoint, with special auth?
    # - cron job to delete old files 30min after question change (if they are on a schedule)
    questions = [
        "What is one idea, novel or otherwise, that you'd like more people to hear about?",
        "What does class warfare look like in your opinion?",
        
    ]
    q = choice(questions)
    
    return {"q": q, "uuid": "1", "category": "?"}

@app.post("/submitAnswer")
async def submit_answer(ans: AnswerSubmission):
    question_uuid = ans.question_uuid
    answer_uuid = gen_uuid()
    data = ans.audio_data

    # check if error, try generating new uuid once, and if still error, give up
    drive.put(answer_uuid, data, content_type='application/octet-stream')
    # TODO if drive is full, need to return an error
    # TODO how to test this?
    
    # bookkeep in base, then put audio blob in drive
    # TODO use pydantic model for this to default all to right values
    answers_db.insert({"question_uuid": question_uuid,
                       "num_flags": 0,
                       "is_banned": False,
                       "num_agrees": 0,
                       "num_disagrees": 0,
                       "num_listens": 0
                       }, answer_uuid)

    return {'id': answer_uuid}

def calculate_popularity(num_agrees, num_disagrees, num_listens):
    return 0

# given all items from the db,
# skip past the ones for a different a question
# skip past the ones we've already seen
# categorize popularity
def filter_answers_from_db(items):
    pop = unpop = contro = []
    for item in items:
        if item.question_uuid is not question_uuid:
            continue
        if item.answer_uuid in seen_answer_uuids:
            continue
        if item.is_banned:
            continue

        # negative is unpop, 0 is controv/unknown, 1 is pop
        popularity = calculate_popularity(item.num_agrees,
                                          item.num_disagrees,
                                          item.num_listens)
        
        if popularity < 0:
            unpop.append(item)
        elif popularity == 0:
            contro.append(item)
        elif popularity > 0:
            pop.append(item)
        else:
            # TODO throw exception? or skip?
            pass

        # TODO check for emptiness here? to prevent typeerror unpacking None
        return pop, unpop, contro
        
        
@app.post("/getAnswer", response_model=AnswerListen)
async def get_answer(question_uuid: str, seen_answer_uuids: List[str]):
    # filter through all answers in DB once.
    # want all of them to get an equal random distribution.
    # not bothering writing a query for fetch cuz it feels btter to have all
    #   filter logic in the same place.
    # categorize into popular, controversial, unpopular during the single pass
    res = answers_db.fetch()
    pop, unpop, contro = filter_answers_from_db(res.items)
    while res.last: # TODO when will this be too slow?
        res = answers_db.fetch(last=res.last)
        pop2, unpop2, contro2 = filter_answers_from_db(res.items)
        pop += pop2
        unpop += unpop2
        contro += contro2
        # (alternative to this code duplication was a less intuitive zip,
        #   and I am optimizing for clarity)
        
    # want even distribution of answers across popularity spectrum.
    cat = choice(range(3)) # 0, 1, 2
    if cat == 0:
        a = choice(pop)
    elif cat == 1:
        a = choice(unpop)
    elif cat == 2:
        a = choice(contro)
    else:
        raise HTTPException("wat", 500)
    
    # get the selected answer
    answer_uuid = a.answer_uuid
    audio_data = drive.get(answer_uuid)

    # update selected answer's num_listen
    answers_db.update({"num_listens": users.util.increment(1)}, answer_uuid)
    
    return {"audio_data": audio_data,
            "answer_uuid": answer_uuid}

@app.post("/flagAnswer")
async def flag_answer(answer_uuid: str):
    # check what value it is at. if at a threshold, flag it as needing moderation (won't be sent to users anymore), and ping us somehow
    # TODO

    # increment update in DB otherwise
    answers_db.update(key=answer_uuid,
              updates={num_flags: users.util.increment(1)})
    pass

@app.post("/rateAnswer")
async def rate_answer(answer_uuid: str, agreement: bool):
    # TODO do i need to supply their current value if i'm not modifying them?
    if agreement:
        answers_db.update(key=answer_uuid,
                  updates={"num_agrees": users.util.increment(1)})
    else:
        answers_db.update(key=answer_uuid,
                  updates={"num_disagrees": users.util.increment(1)})
    pass
