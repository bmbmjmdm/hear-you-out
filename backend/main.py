import os
import secrets
#import uuid # temp solution in place

from math import sqrt
from typing import List
from random import uniform, choice
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
    unban_token: str = ""
    was_banned: bool = False
    num_agrees: int = 0
    num_disagrees: int = 0
    num_listens: int = 0

# utility
def gen_uuid(): # TODO
    good_enough = str(uniform(0, 100)) # from random
    good_enough = good_enough.replace(".","") # remove the dot
    return f"{good_enough}"

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

    # TODO yaml instead of newline separated, so we can store datetimes and category
    question_list_stream = drive.get('list of questions')
    if question_list_stream is None:
        return PlainTextResponse("what's a question, really?", status_code=500)

    questions = question_list_stream.read().decode().strip().splitlines() # strip to remove trailing newline
    # read store of questions every invocation
    # compare the entry with the given datetime TODO
    q = choice(questions)

    # TODO keep track of questions asked so far
    # questions_db.insert()
    
    return {"q": q, "key": "1", "category": "?"}

@app.post("/submitAnswer")
async def submit_answer(ans: AnswerSubmission):
    answer_uuid = gen_uuid()
    question_uuid = ans.question_uuid
    data = ans.audio_data
    # TODO put upper limit on amount of data?
    
    # store audio in drive, then bookkeep in base
    try:
        drive.put(answer_uuid, data, content_type='application/octet-stream')
    except Exception(e):
        print(f"~~~~~~~~~~~~~\n\n\n\n!!!!!!!!!!!!!!\n{e}") # i think visor will capture this in the logs?
        return PlainTextResponse("error storing answer in drive", status_code=500)
    # TODOhow to test drive being full error? maybe uncommonly run use case to fill it up? can test the exact byte limit
    # TODO test for duplicate filename error

    # bookkeep in base
    new_row = AnswerTableSchema(key=answer_uuid, question_uuid=question_uuid)
    answers_db.insert(new_row.dict())
    print(new_row)
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

    # +2 so we don't div by 0, and bc i think it was a good improvement at the extremes (like cont. corr. (todo?)
    #wilson_score_lower, wilson_score_higher = calculate_wilson(num_agrees+2, num_disagrees+2)
    return 0

# given all items from the db,
# skip past the ones for a different a question
# track the ones we've already seen
# skip past the banned ones
# categorize popularity
def filter_answers_from_db(items: List[AnswerTableSchema], question_uuid: str, seen_answer_uuids: List[str]):
    pop = unpop = contro = seen_pop = seen_unpop = seen_contro = []
    for item in items:
        if item.question_uuid is not question_uuid:
            continue
        if item.is_banned:
            continue

        # negative is unpop, 0 is controv/unknown, positive is pop
        popularity = calculate_popularity(item.num_agrees,
                                          item.num_disagrees)
                                          #item.num_listens)
        
        if popularity < 0:
            if item.key in seen_answer_uuids:
                seen_unpop.append(item)
            else:
                unpop.append(item)
        elif popularity == 0:
            if item.key in seen_answer_uuids:
                seen_contro.append(item)
            else:
                contro.append(item)
        elif popularity > 0:
            if item.key in seen_answer_uuids:
                seen_pop.append(item)
            else:
                pop.append(item)
        else:
            return PlainTextResponse("popularity invalid", status_code=500)

    # TODO check for emptiness here? to prevent typeerror unpacking None
    return pop, unpop, contro, seen_pop, seen_unpop, seen_contro
        
@app.post("/getAnswer", response_model=AnswerListen)
async def get_answer(question_uuid: str, seen_answer_uuids: List[str]):
    # filter through all answers in DB once.
    # want all of them to get an equal random distribution.
    # not bothering writing a query for fetch cuz it feels btter to have all
    #   filter logic in the same place.
    # categorize into popular, controversial, unpopular during the single pass
    res = answers_db.fetch()
    print(res)
    if res.count == 0:
        return PlainTextResponse("no answers found", status_code=500)

    answers_items = [AnswerTableSchema(**item) for item in res.items]
    pop, unpop, contro, seen_pop, seen_unpop, seen_contro = filter_answers_from_db(answers_items, question_uuid, seen_answer_uuids)
    while res.last: # Todo when will this be too slow?
        # TODO ought to unit test this inner logic
        res = answers_db.fetch(last=res.last)
        pop2, unpop2, contro2, seen_pop2, seen_unpop2, seen_contro2 = filter_answers_from_db(answers_items, question_uuid, seen_answer_uuids)
        pop += pop2
        unpop += unpop2
        contro += contro2
        seen_pop += seen_pop2
        seen_unpop += seen_unpop2
        seen_contro += seen_contro2
        
    # calculate distribution thus far from seen answers, since we want to take that into account.
    # TODO finish this
    # TODO take into account empty arrays...
    # num_seen_pop = len(seen_pop)
    # num_seen_unpop = len(seen_unpop)
    # num_seen_contro = len(seen_contro)
    # if num_seen_pop < num_seen_unpop:
    #     if num_seen_pop < num_seen_contro:
    #         a = choice(pop)
    #     elif num_seen_contro < num_seen_unpop:
    #         a = choice(contro)
    #     else:
    #         a = choice(unpop)
    # elif num_seen_
        # map -1, 0, 1, to distinct dict elements. will this work as is?
        #distribution["dist"+calculate_popularity()}"

    a = choice(pop+unpop+contro)
    # cat = choice(range(3)) # 0, 1, 2
    # if cat == 0:
    #     a = choice(pop)
    # elif cat == 1:
    #     a = choice(unpop)
    # elif cat == 2:
    #     a = choice(contro)
    # else:
    #     return PlainTextResponse("wat", status_code=500)
    
    # get the selected answer
    answer_uuid = a.key
    audio_data = drive.get(answer_uuid).read()

    # update selected answer's num_listen
    # could catch exception here, but i think it makes sense to just abort if this update fails
    answers_db.update({"num_listens": answers_db.util.increment(1)}, answer_uuid)
    
    return {"audio_data": audio_data,
            "answer_uuid": answer_uuid}

@app.post("/flagAnswer")
async def flag_answer(answer_uuid: str):
    # check what value it is at. if at a threshold, flag it as needing moderation (won't be sent to users anymore), and ping us somehow
    # set threshold to 1 for now? so we minimized spread of badness. and scale up when it makes sense with number reports and num users

    answers_db.update(key=answer_uuid,
                      updates={'num_flags': answers_db.util.increment(1)})

    # after noting the flag, if we have already explicitly approved this, then do nothing more
    answer_row = answers_db.get(key=answer_uuid)
    if answer_row['was_banned']:
        # todo maybe if it keeps getting flagged after we approved it, send a different message?
        return PlainTextResponse("answer flagged", status_code=200)# could potentially let user know; not sure if there is value

    # for now, lets ban after the first flag, to limit the spread of badness
    if answer_row['num_flags'] >= 0: # 0 means the first time it has been flagged
        # we are banning it, so generate a security token for an unban magic link
        unban_token = secrets.token_urlsafe(32)
        answers_db.update(key=answer_uuid, updates={'is_banned': True, 'unban_token': unban_token})
        webhook = DiscordWebhook(url=Discord_flag_url, username="Flagged Answer",
                                 content=f"Unban this: https://hearyouout.deta.dev/unbanAnswer/{answer_uuid}/{unban_token}")
        audio_data_stream = drive.get(answer_uuid)
        webhook.add_file(file=audio_data_stream.read(), filename=f"{answer_uuid}.mp3") # will this work?
        response = webhook.execute() # TODO error check
    return PlainTextResponse("answer flagged", status_code=200)

# 32 byte tokens is prob enough to deter people from trying to brute force it?
@app.get("/unbanAnswer/{answer_uuid}/{unban_token}")
async def unban_answer(answer_uuid: str, unban_token: str):
    # using magic link sent to discord as auth
    stored_token = answers_db.get(key=answer_uuid)['unban_token']
    if unban_token == stored_token:
        answers_db.update(key=answer_uuid,
                          updates={'is_banned': False,
                                   'was_banned': True}) # this means it can't get banned again
        
    # we return this regardless of the correct unban token
    return PlainTextResponse("answer unbanned", status_code=200)

# todo is there anything stopping random people from hitting this endpoint unfairly? i don't think so.
# doesn't seem terrribly hard to add user id and magic links for all of them. turn above into dependency injection.
# can probably wait til after MVP...?
# would be cool if the security nonce gen and lookup and be pre/post hooks for these path executions
@app.post("/rateAnswer")
async def rate_answer(answer_uuid: str, agreement: bool):
    # TODO do i need to supply their current value if i'm not modifying them?
    if agreement:
        answers_db.update(key=answer_uuid,
                          updates={"num_agrees": answers_db.util.increment(1)})
    else:
        answers_db.update(key=answer_uuid,
                          updates={"num_disagrees": answers_db.util.increment(1)})
    return PlainTextResponse("rating recorded", status_code=200)