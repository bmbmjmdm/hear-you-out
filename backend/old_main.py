import os
import yaml
import secrets
import datetime
#import uuid # temp solution in place -> tODO try new deta purge

from math import sqrt
from pydantic import BaseModel
from functools import lru_cache
from typing import List, Optional, Union, Iterable
from random import uniform, choice
from discord_webhook import DiscordWebhook
from fastapi.responses import  PlainTextResponse
from fastapi import FastAPI, Depends, HTTPException

try: # to accommodate deta
    from dotenv import load_dotenv
except:
    print("specify DETA_PROJECT_KEY in your .env")
    exit()

#from fastapi import FastAPI, File, UploadFile
#from fastapi.responses import HTMLResponse, StreamingResponse

### TODO
# - try out python lsp(/alternative) for docs, mvoement, code completions
# - - C-c C-d for elpy docs
# - - C-c C-s elpy rgrep symbol
# - - jedi and company for code completion i think
# - - C-c C-e for symbol multi-edit
# + update yaml to map category name to checklist (node anchors?)
# - update yaml to set schedule 
# - qetQuestion algo
# - new endpoint for days till next Q
# - getAnswer algo
# - automated/documented deploy process (separate dev micro)
# - - deploy a fix to the dev BE
#     point the dev FE to the dev BE and test out the fix
#     confirm it works
#     then we deploy the dev BE to the prod BE and everyone will have that new fix
# - tests (see todo in test_main)
# - - db+drive DI
# - all other todos in the source code and on jir
# - consider using fastapi Settings object for env vars, drive, and base objects
# - - https://fastapi.tiangolo.com/advanced/settings/
# - - alt to dev/prod env flag, could and/or read it from path (eg as path prefix)
# - # improve api docs thusly: https://fastapi.tiangolo.com/tutorial/path-operation-configuration
# - which endpoints should have associated pydantic models?
# - - all of them? no, only the ones that return content, not the ones that just ack
# - add openAPI config info, see: https://lyz-code.github.io/blue-book/fastapi/
# - add api version, like https://christophergs.com/tutorials/ultimate-fastapi-tutorial-pt-8-project-structure-api-versioning/
# - - would need to break api compatibility by switching to this structure,
#     hopefully dale wouldn't mind

from .config import Settings

@lru_cache
def get_settings():
    return Settings()

# load local env if we're running locally
if os.environ.get('DETA_RUNTIME') is None:
    load_dotenv(override=True)

# TODO use fastapi's env var support for these
Secret_key = os.environ.get('DETA_PROJECT_KEY')
# TODO update micro env with deta update -e .env
Discord_flag_url = os.environ.get('DISCORD_FLAG_WEBHOOK') # todo error if not set unless overridden
Is_dev_build = os.environ.get('IS_DEV_BUILD')
if Is_dev_build == "True":
    app = FastAPI()
else:
    app = FastAPI(redoc_url=None, docs_url=None)
    

deta = Deta(Secret_key)

# these are dependencies injected into path functions
# todo make more ergonomic in terms of DX
# - can I do anything like https://fastapi.tiangolo.com/tutorial/sql-databases/
# - since I use db and drive together almost always,
#   maybe create a pydantic schema for them and use it as a single Dependency
# - move them into separate deps pkg? like https://christophergs.com/tutorials/ultimate-fastapi-tutorial-pt-8-project-structure-api-versioning/
@lru_cache
def get_drives():
    questions_drive = Drive("questions")
    answers_drive = Drive("hyo")
    return {'questions': questions_drive,
            'answers': answers_drive}
@lru_cache
def get_dbs():
    questions_db = Base('asked_questions')
    answers_db = Base('answers')
    return {'questions': questions_db,
            'answers': answers_db}

#questions_drive, answers_drive = get_drives()
#questions_db, answers_db = get_dbs()

class QuestionModel(YamlModel):
    key: str
    text: str
    checklist: List[str]

# LEFT OFF
# - updating test case s/num_asks/num_answers;
# - recording asked_on;
# - - i think we should also store the schedule as it is when Q asked
# - - and actually this hsould be recorded in a known place to avoid yaml combing
# - - - new column? can we constrain it to only be true for 1 row?
# - new endpoint to calc days til
# - getQuestion logic to use helper from new endpoint to decide which Q to server
class QuestionDB(QuestionModel):
    num_answers: int = 0
    asked_on: datetime



# utility
def gen_uuid(): # TODO
    good_enough = str(uniform(0, 100)) # from random
    good_enough = good_enough.replace(".","") # remove the dot
    return f"{good_enough}"

def yaml_to_questions(contents_yaml: str) -> List[str]:
    if contents_yaml is None:
        raise Exception(f"empty file")

    questions_yaml = yaml.safe_load(contents_yaml)
    questions = questions_yaml['questions']
    return questions

# handle all exceptions thrown in code below with a 500 http response
# todo test what happens when this isn't here
# todo maybe do this in prod but not dev?
# @app.exception_handler(Exception)
# async def validation_exception_handler(request, exc):
#     print(str(exc))
#     return PlainTextResponse("uh oh, something unexpected happened", stat
#                           us_code=500)

# todo turn off caching per docs?
@app.get("/")
async def root():
    return {'hey': 'world'}

# # return 500 if no questions (vs 200 with a FailState response model)
# @app.get("/getQuestion", response_model=QuestionModel)
# async def get_question(drive: dict = Depends(get_drives),
#                        db: dict = Depends(get_dbs),
#                        settings: Settings = Depends(get_settings)):
#     # get today's question...how? from drive? from base? from internet endpoint? from file?/src
#     # - think i want to go with base (need them anwyay). and can dev separate micro to insert Qs to it! or separate endpoint, with special auth?
#     # - cron job to delete old files 30min after question change (if they are on a schedule)

#     question_list_stream = drive['questions'].get(settings.qfilename)
#     if question_list_stream is None:
#         return PlainTextResponse("what's a question, really?", status_code=500)

#     data_streamed = question_list_stream.read().decode().strip() # strip to remove trailing newline
#     # read store of questions every invocation
#     # compare the entry with the given datetime TODO
    
#     questions = yaml_to_questions(data_streamed)
#     # LEFT OFF algo to use release_on field in question yaml to select. write down potential error states
#     q = choice(questions)
#     q_model = QuestionModel(**q)
#     #q = questions[1]

#     # make sure row exists for question in db
#     # (str() bc yaml file has integers as key)
#     if db['questions'].get(str(q['key'])) is None:
#         q_db = QuestionDB(**q_model.dict()) #TODO better way? look at pydantic model docs
#         db['questions'].insert(q_db.dict())

#     return q_model.dict()

# @app.post("/submitAnswer", response_model=SubmitAnswerResponse)
# async def submit_answer(ans: SubmitAnswerPost,
#                         drive: dict = Depends(get_drives),
#                         db: dict = Depends(get_dbs)):
#     answer_uuid = gen_uuid()
#     question_uuid = ans.question_uuid
#     data = ans.audio_data
#     # TODO put upper limit on amount of data?
#     # - what is the default POST cap?
#     # - create a unit test for an expected file size, and a file size over the POST cap

#     if db['questions'].get(question_uuid) is None:
#         return PlainTextResponse("question_uuid not found", status_code=404)
        
#     # store audio in drive, then bookkeep in base
#     try:
#         drive['answers'].put(answer_uuid, data, content_type='application/octet-stream')
#     except Exception(e):
#         print(f"~~~~~~~~~~~~~\n\n\n\n!!!!!!!!!!!!!!\n{e}") # i think visor will capture this in the logs?
#         return PlainTextResponse("error storing answer in drive", status_code=500)
#     # TODO how to test drive being full error? maybe uncommonly run use case to fill it up? can test the exact byte limit
#     # TODO test for duplicate filename error

#     # bookkeep in base
#     ts = str(datetime.datetime.now(datetime.timezone.utc))
#     new_row = AnswerTableSchema(key=answer_uuid,
#                                 question_uuid=question_uuid,
#                                 entry_timestamp=ts)
#     db['answers'].insert(new_row.dict())
#     db['questions'].update(key=str(question_uuid),
#                            updates={"num_answers": db['questions'].util.increment(1)})


#     return {'answer_id': answer_uuid,
#             'question_id': question_uuid,
#             'entry_timestamp': ts}

# button meanings:
# dis/like or dis/agree?
# to have most effect, need narrowest goal. want to hear different people's philosophy
# could try to sort it left/right (conservative/liberal). could then show people even distro of viewpoints on political spectrum
# - other dimensions too (political compass)
# dale dislike dis/like buttons
# marc/lily do not like the liberal/conservative labels
# asking people questions to help categorize answer on some political compass
# if dis/like, what does dislike mean? could that mean different things to different people?
# dis/agree is less ambiguous.
# use ai to categorize answer on political compass?
# - potential mvp: liberal vs conservative judgement by ai, and potentially expand to other axes
# - three options: could have dis/agree button and/or ai classification
# - might work, but significant effort to impl
# do we want the app to amplify minority opinions?
# - algorithm should assume random distribution of audience
# - yes. already flagging answers that are poorly formatted, hatespeech
# - kind of promoting misinformation?
# - - we're inherently not making echo chamber, so they should be getting real info too
# if an answer has a lot of agrees (despite user distribution) bc its convincing (even to people w/ diff view points),
#   we don't want this ansewr to get "lost"

# wilson score confidence interval for binomial distributions
# any value in also taking into account people who didn't vote?
# TODO
# - need to add continuity correction bc n will often be small (< 40)
# - take into account max upvotes and downvotes to find controversial answers too,
#   'improved wilson score': https://arxiv.org/ftp/arxiv/papers/1809/1809.07694.pdf
# - reddit's comment rank is based on wilson score, 85% confidence: https://medium.com/hacking-and-gonzo/how-reddit-ranking-algorithms-work-ef111e33d0d9
# - - we want to do this, but also take into account downvotes as an...equal indicator ofgoodness? so are they both upvotes, essentially? just activity/reactiveness?
# - - - but what if lack of vote could be an indicator of goodness of answer? bc they don't know whether to upvote or downvote bc it had good and bad qualities
# - or do personalized recommendation? would this be significantly more effective?
#   "the people who normally vote like you did not like this, so you probably won't"
#   Bayesian Personalized Ranking in Python: https://github.com/shah314/BPR
#     (seemingly better lib for BPR: https://github.com/lyst/lightfm)
#   ..maybe use this later when # users and # answers higher? but might be good to store
#   stats on the user from the beginning so we have enough data for it to work well later
#   -> Users db that tracks rows of [phone_id, answer_uuid, user's rating of answer]
# - - collaborative filtering looks like the most relevant type of recommender system (or hybrid of it)
# - - - https://en.wikipedia.org/wiki/Collaborative_filtering
# - - - might require too much data per Answer+User to be useful at the start?
# - - hmm could try clustering/categorizing users and answers and then matching that way
# - - presumably want recommender distribution to have a long tail (recommend Answers with low-historical-data)
# - - hmm wonder if we should include implicit context in the data...kinda creepy
# - what kind of algo would work well for 10, 100, 1000 people (given unknown + diff demographic distributions
# - - (what's the minimum model complexity to achieve the results we want)
# - - - could try writing down the results we want for different scenarios?
# - - - - actively prevent echo chamber
# - - - - show users equal mix of answers they agree/disagree with (and abstain from?)
# - - - - - relattive to user demographic distribution, bucket answers via "dis/liked more than usual"
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
    pop, unpop, contro, seen_pop, seen_unpop, seen_contro = [[] for _ in range(6)]
    for item in items:
        #print(item, question_uuid)
        if item.question_uuid != question_uuid:
            continue
        if item.is_banned:
            continue

        # negative is unpop, 0 is controv/unknown, positive is pop
        popularity = calculate_popularity(item.num_agrees,
                                          item.num_disagrees)
                                          #item.num_serves)

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
        else:
            if item.key in seen_answer_uuids:
                seen_pop.append(item)
            else:
                pop.append(item)

    # TODO check for emptiness here? to prevent typeerror unpacking None
    return pop, unpop, contro, seen_pop, seen_unpop, seen_contro

def tHe_alGoRitHm(db_stream: Iterable[List[AnswerTableSchema]], 
                  question_uuid: str,
                  seen_answer_uuids: List[str]) -> Union[NoAnswersResponse,AnswerTableSchema]:

    # answers_items = db_stream()
    # if empty(answers_items):
    #     return NoAnswersResponse()

    # todo fix this data mode...
    pop, unpop, contro, seen_pop, seen_unpop, seen_contro = [[] for _ in range(6)]
    for answers_items in db_stream(): # Todo when will this be too slow?
        pop2, unpop2, contro2, seen_pop2, seen_unpop2, seen_contro2 = filter_answers_from_db(answers_items, question_uuid, seen_answer_uuids)
        pop += pop2
        unpop += unpop2
        contro += contro2
        seen_pop += seen_pop2
        seen_unpop += seen_unpop2
        seen_contro += seen_contro2

    if len(pop+unpop+contro) == 0:
        return NoAnswersResponse()

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
    return a
    
# returns diff data model if no answers found (2nd happy path)
@app.post("/getAnswer", response_model=Union[AnswerListen,NoAnswersResponse])
async def get_answer(question_uuid: str,
                     seen_answer_uuids: List[str],
                     drive: dict = Depends(get_drives),
                     db: dict = Depends(get_dbs)):
    
    # filter through all answers in DB once.
    # want all of them to get an equal random distribution.
    # not bothering writing a query for fetch cuz it feels btter to have all
    #   filter logic in the same place.
    # categorize into popular, controversial, unpopular during the single pass
    def db_stream() -> Iterable[List[AnswerTableSchema]]:
        res = db['answers'].fetch()
        answers_items = [AnswerTableSchema(**item) for item in res.items]
        yield answers_items
        while res.last: # Todo when will this be too slow?
            # TODO ought to unit test this inner logic
            res = db['answers'].fetch(last=res.last)
            answers_items = [AnswerTableSchema(**item) for item in res.items]
            yield answers_items
        
    a = tHe_alGoRitHm(db_stream, question_uuid, seen_answer_uuids)
    if isinstance(a, NoAnswersResponse): # better way to propagate this?
        return a                         #   functional core monad?

    
    # get the selected answer
    answer_uuid = a.key
    audio_data = drive['answers'].get(answer_uuid).read()

    # increment selected answer's num_serves
    # could catch exception here, but i think it makes sense to just abort if this update fails
    db['answers'].update({"num_serves": db['answers'].util.increment(1)}, answer_uuid)
    
    return {"audio_data": audio_data,
            "answer_uuid": answer_uuid}

# phone_id for potential future abuse mitigation
@app.post("/flagAnswer")
async def flag_answer(answer_uuid: str,
                      phone_id: str,
                      drive: dict = Depends(get_drives),
                      db: dict = Depends(get_dbs)):
    # check what value it is at. if at a threshold, flag it as needing moderation (won't be sent to users anymore), and ping us somehow
    # set threshold to 1 for now? so we minimized spread of badness. and scale up when it makes sense with number reports and num users

    # todo record phone_id, answer_uuid, and timestamp into a users/activity DB
    # could shadowban abusers, eg
    
    db['answers'].update(key=answer_uuid,
                      updates={'num_flags': db['answers'].util.increment(1)})

    # after noting the flag, if we have already explicitly approved this, then do nothing more
    answer_row = db['answers'].get(key=answer_uuid)
    if answer_row['was_banned']:
        # todo maybe if it keeps getting flagged after we approved it, send a different message?
        return PlainTextResponse("answer flagged", status_code=200)# could potentially let user know; not sure if there is value

    # for now, lets ban after the first flag, to limit the spread of badness
    if answer_row['num_flags'] >= 0: # 0 means the first time it has been flagged
        # we are banning it, so generate a security token for an unban magic link
        unban_token = secrets.token_urlsafe(32) # TODO two entries in DB with same token? need to seed?
        db['answers'].update(key=answer_uuid, updates={'is_banned': True, 'unban_token': unban_token})
        webhook = DiscordWebhook(url=Discord_flag_url, username="Flag Bot",
                                 content=f"Click to unban this answer: https://hearyouout.deta.dev/unbanAnswer/{answer_uuid}/{unban_token}_")
        audio_data_stream = drive['answers'].get(answer_uuid)
        # todo b64 decode into...audio bytes?
        webhook.add_file(file=audio_data_stream.read(), filename=f"{answer_uuid}.mp4") # will this work?
        response = webhook.execute() # TODO error check
        
    return PlainTextResponse("answer flagged", status_code=200)

# 32 byte tokens is prob enough to deter people from trying to brute force it?
@app.get("/unbanAnswer/{answer_uuid}/{unban_token}")
async def unban_answer(answer_uuid: str,
                       unban_token: str,
                       db: dict = Depends(get_dbs)):
    # using magic link sent to discord as auth
    stored_token = db['answers'].get(key=answer_uuid)['unban_token']
    if unban_token == stored_token:
        db['answers'].update(key=answer_uuid,
                          updates={'is_banned': False,
                                   'was_banned': True}) # this means it can't get banned again

    webhook = DiscordWebhook(url=Discord_flag_url, username="Flag Bot",
                             content=f"{answer_uuid} \"unbanned\"")
    response = webhook.execute() # TODO error check

    # we return this regardless of the correct unban token
    return PlainTextResponse("answer unbanned", status_code=200)

# todo is there anything stopping random people from hitting this endpoint unfairly? i don't think so.
# doesn't seem terrribly hard to add user id and magic links for all of them. turn above into dependency injection.
# can probably wait til after MVP...?
# would be cool if the security nonce gen and lookup and be pre/post hooks for these path executions
@app.post("/rateAnswer") # why is this post? todo
async def rate_answer(answer_uuid: str,
                      agreement: int,
                      db: dict = Depends(get_dbs)):
    # TODO do i need to supply their current value if i'm not modifying them?
    print("rate", answer_uuid, agreement)
    try:
        if agreement > 0:
            db['answers'].update(key=answer_uuid,
                              updates={"num_agrees": db['answers'].util.increment(1)})
        elif agreement < 0:
            db['answers'].update(key=answer_uuid,
                              updates={"num_disagrees": db['answers'].util.increment(1)})
        elif agreement == 0:
            db['answers'].update(key=answer_uuid,
                              updates={"num_abstains": db['answers'].util.increment(1)})
        else:
            raise Exception("invariant violated")
    except Exception as e:
        #return PlainTextResponse("rating recorded", status_code=200)
        return PlainTextResponse(f"error rating answer: {e}", status_code=500)        
        
    return PlainTextResponse("rating recorded", status_code=200)

@app.get("/getAnswerStats", response_model=Union[AnswerStatsResponse,NoAnswersResponse])
async def get_answer_stats(answer_uuid: str,
                           drive: dict = Depends(get_drives),
                           db: dict = Depends(get_dbs)):
    row = db['answers'].get(answer_uuid)
    if row is None:
        return NoAnswersResponse()
    else:
        # good way to AnswerStatsResponse(**row) while ignoring irrelevant keys?
        # print(row)
        # return AnswerStatsResponse().parse_obj_as(AnswerStatsResponse, row)
        return AnswerStatsResponse( # replace following lines with **row?
            key = row['key'],
            num_serves = row['num_serves'],
            num_agrees = row['num_agrees'],
            num_abstains = row['num_abstains'],
            num_disagrees = row['num_disagrees'])

