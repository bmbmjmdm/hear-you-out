import os

from math import sqrt
from typing import List
from random import choice
from pydantic import BaseModel
from deta import Deta, Drive, Base
from discord_webhook import DiscordWebhook
from fastapi import FastAPI, HTTPException
from fastapi.responses import  PlainTextResponse

try: # to accommodate deta
    from dotenv import load_dotenv
except:
    pass

#from fastapi import FastAPI, File, UploadFile
#from fastapi.responses import HTMLResponse, StreamingResponse
#import uuid

# load local env if we're running locally
if os.environ.get('DETA_RUNTIME') is None:
    load_dotenv(override=True)

Secret_key = os.environ.get('DETA_PROJECT_KEY')
# TODO update micro env with deta update -e .env
Discord_flag_url = os.environ.get('DISCORD_FLAG_WEBHOOK') # todo error if not set unless overridden
deta = Deta(Secret_key)
drive = Drive("hyo")
questions_db = Base('questions')
answers_db = Base('answers')
app = FastAPI()  # must be app

class QuestionModel(BaseModel):
    key: str
    q: str
    category: str

class AnswerSubmission(BaseModel):
    audio_data: bytes
    question_uuid: str # uuid.UUID

class AnswerListen(BaseModel):
    audio_data: bytes
    answer_uuid: str # TODO

class AnswerTableSchema(BaseModel):
    key: str # TODO uuid; # answer_uuid
    question_uuid: str # TODO
    num_flags: int = 0
    is_banned: bool = False
    was_banned: bool = False
    num_agrees: int = 0
    num_disagrees: int = 0
    num_listens: int = 0

# utility
def gen_uuid():
    return 'asdf' #uuid.uuid4()

# handle all exceptions thrown in code below with a 500 http response
# todo test what happens when this isn't here
@app.exception_handler(Exception)
async def validation_exception_handler(request, exc):
    print(str(exc))
    return PlainTextResponse("uh oh, something unexpected happened", status_code=500)

# todo turn off caching per docs?
@app.get("/")
async def root():
    return {'hey': 'world'}

@app.get("/getQuestion", response_model=QuestionModel)
async def get_question():
    # get today's question...how? from drive? from base? from internet endpoint? from file?/src
    # - think i want to go with base (need them anwyay). and can dev separate micro to insert Qs to it! or separate endpoint, with special auth?
    # - cron job to delete old files 30min after question change (if they are on a schedule)
    # TO
    question_list = drive.get('list of questions')
    
    # 
    
    # read store of questions every invocation
    # compare the entry with the given datetime 
    questions = [
        "What is one idea, novel or otherwise, that you'd like more people to hear about?",
        "What does class warfare look like in your opinion?",
        
    ]
    q = choice(questions)
    
    return {"q": q, "key": "1", "category": "?"}

@app.post("/submitAnswer")
async def submit_answer(ans: AnswerSubmission):
    answer_uuid = gen_uuid()
    question_uuid = ans.question_uuid
    data = ans.audio_data

    # store audio in drive, then bookkeep in base
    try:
        drive.put(answer_uuid, data, content_type='application/octet-stream')
    except Exception(e):
        print(e) # i think visor will capture this in the logs?
        raise HTTPException("error storing answer in drive", 500)
    # TODO how to test drive being full error? maybe uncommonly run use case to fill it up? can test the exact byte limit
    # TODO test for duplicate filename error
    
    # bookkeep in base
    new_row = AnswerTableSchema(key=answer_uuid, question_uuid=question_uuid)
    answers_db.insert(new_row.dict())
    return {'answer id': answer_uuid}

# wilson score confidence interval for binomial distributions
# any value in also taking into account people who didn't vote?
# TODO need to add continuity correction bc n will often be small (< 40)
def calculate_wilson(p, n, z = 1.96):
    denominator = 1 + z**2/n
    centre_adjusted_probability = p + z*z / (2*n)
    adjusted_standard_deviation = sqrt((p*(1 - p) + z*z / (4*n)) / n)
    
    lower_bound = (centre_adjusted_probability - z*adjusted_standard_deviation) / denominator
    upper_bound = (centre_adjusted_probability + z*adjusted_standard_deviation) / denominator
    return (lower_bound, upper_bound)

# returns negative for unpopular, 0 for controversial, positive for popular
def calculate_popularity(num_agrees, num_disagrees):
    # if there are a lot more of agrees than disagrees, it is popular
    # if there are relatively the same amount, it's controversial

    wilson_score_lower, wilson_score_higher = calculate_wilson(num_agrees, num_disagrees)
    return 0

# given all items from the db,
# skip past the ones for a different a question
# skip past the ones we've already seen
# categorize popularity
def filter_answers_from_db(items, question_uuid, seen_answer_uuids):
    pop = unpop = contro = []
    for item in items:
        if item.question_uuid is not question_uuid:
            continue
        if item.answer_uuid in seen_answer_uuids:
            continue
        if item.is_banned:
            continue

        # negative is unpop, 0 is controv/unknown, positive is pop
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
    pop, unpop, contro = filter_answers_from_db(res.items, question_uuid, seen_answer_uuids)
    while res.last: # TODO when will this be too slow?
        res = answers_db.fetch(last=res.last)
        pop2, unpop2, contro2 = filter_answers_from_db(res.items, question_uuid, seen_answer_uuids)
        pop += pop2
        unpop += unpop2
        contro += contro2
        
    # want even distribution of answers across popularity spectrum.
    # calculate distribution thus far from seen answers
    # TODO what if answers are flipfloppy?
    distribution = {}
    for answer_uuid in seen_answer_uuids:
        pass
        # map -1, 0, 1, to distinct dict elements. will this work as is?
        #distribution["dist"+calculate_popularity()}"

    # cat = choice(range(3)) # 0, 1, 2
    # if cat == 0:
    #     a = choice(pop)
    # elif cat == 1:
    #     a = choice(unpop)
    # elif cat == 2:
    #     a = choice(contro)
    # else:
    #     raise HTTPException("wat", 500)
    
    # get the selected answer
    answer_uuid = a.answer_uuid
    audio_data_stream = drive.get(answer_uuid)

    # update selected answer's num_listen
    answers_db.update({"num_listens": users.util.increment(1)}, answer_uuid)
    
    return {"audio_data": audio_data,
            "answer_uuid": answer_uuid}

@app.post("/flagAnswer")
async def flag_answer(answer_uuid: str):
    # check what value it is at. if at a threshold, flag it as needing moderation (won't be sent to users anymore), and ping us somehow
    # set threshold to 1 for now? so we minimized spread of badness. and scale up when it makes sense with number reports and num users

    # DON'T bother with num_flags since we are just banning after first flag for now
    # answers_db.update(key=answer_uuid,
    #                  updates={num_flags: users.util.increment(1)})
    answers_db.update(key=answer_uuid,
                      updates={is_banned: True})
    
    answer_row = answers_db.get(key=answer_uuid)
    if answer_row['num_flags'] >= 0: # 0 means the first time it has been flagged
        if answer_row['was_banned']: # we have already approved it
            return # TODO return what? should FE know that this was already approved? maybe to inform user?
        webhook = DiscordWebhook(url=Discord_flag_url, username="Flagged Answer")
        audio_data_stream = drive.get(answer_uuid)
        webhook.add_file(file=audio_data_stream.read(), filename=f"{answer_uuid}.mp3") # will this work?
        # include a link to a micro endpoint to unban this file. TODO
        #response = webhook.execute() # TODO error check

    # TODO return success
    pass

@app.post("/unbanAnswer")
async def unban_answer(answer_uuid: str): # TODO uuid
    #answers_db.update(key=answer_uuid,
    #                  updates={is_banned: False,
    #                           was_banned: True}) # this means it can't get banned again
    pass # need auth for this request. via micro api keys? look at fastapi docs too TODO

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
