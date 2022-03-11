import sys
import yaml
import pytest
from deta import Drive, Base
from fastapi.testclient import TestClient

from ..main import app, get_dbs, get_drives, QuestionModel, NoAnswersResponse

def get_test_drives():
    questions_drive = Drive("TEST_questions")
    answers_drive = Drive("TEST_answers")
    return {'questions': questions_drive,
            'answers': answers_drive}

def get_test_dbs():
    questions_db = Base("TEST_questions")
    answers_db = Base("TEST_answers")
    return {'questions': questions_db,
            'answers': answers_db}

# do something with each db and drive so it's accessible from deta dashboard gui
def touch_backend(dbs, drives):
    dbs['questions'].put('test')
    dbs['answers'].put('test')
    drives['questions'].put('test', 'test')
    drives['answers'].put('test', 'test')

Dbs = get_test_dbs()
Drives = get_test_drives()
touch_backend(Dbs, Drives)

# todo move to main.py / config
Qfilename = 'list of questions.yaml'

# all the tests in this file run against the prod deployment,
# and these two overrides make it so that all the endpoints
# use the test drives and bases instead of prod drives and bases.
# an alternative would be to just swap the project api
# (and create the "test" deployment)
# TODO put this in 'app' (better: 'client'?) fixture, and require it in test cases
# - also look into asgi_lifespan.LifespanManager and httpx.AsyncClient
# - - these replace the need to spin up an ASGI server - what does pytest do atm?
app.dependency_overrides[get_dbs] = get_test_dbs
app.dependency_overrides[get_drives] = get_test_drives

client = TestClient(app)

# todo - how can we parameterize which set of test questions we want to load
#        into a given test?

# key must be unique
def set_question(key, text='none', category='n/a'):
    # this doesn't add a q per se, it sets entire list to single q

    # yaml data model:
    # questions:
    # - key: 1
    #   text: "What is one idea, novel or otherwise, that you'd like more people to hear about?"
    #   category: "type 1"

    qm = QuestionModel(key=key, text=text, category=category)
    # model_dicts = [QuestionModel(*q).dict() for q in questions]
    yaml_string = yaml.dump({'questions': [qm.dict()]}, sort_keys=False) # don't sort keys so key remains first
    print(yaml_string)
    
    qfile = Drives['questions'].get(Qfilename)
    if qfile is None:
        # instead of using global, should...
        Drives['questions'].put(Qfilename, yaml_string)
    else:
        raise Exception(f"{Qfilename} already in drive, not overwriting just in case")

# could merge with set_question and become a fixture, but what if
# test case wants to add custom data?
def delete_questions():
    # instead of using global, should...
    Drives['questions'].delete(Qfilename)
    # todo delete questions db too


def drive_get_all_files(drive):
    result = drive.list()

    all_files = result.get("names")
    paging = result.get("paging")
    last = paging.get("last") if paging else None

    while (last):
        # provide last from previous call
        result = drive.list(last=last)

        all_files += result.get("names")
        # update last
        paging = result.get("paging")
        last = paging.get("last") if paging else None

    #print("all files:", all_files)
    return all_files

def fetch_all_from_db(db):
    res = db.fetch()

    if res.count == 0:
        return None

    rows = res.items
    while res.last:
        res = db.fetch(last=res.last)
        rows += res.items

    return rows


# this function is dangerous in that it will let you delete all answers from Drive and Db
# without confirming. i only intend to pass in the test drive and db so far...
def delete_all_test_answers():
    dbs = get_test_dbs()
    drives = get_test_drives()
    all_filenames = drive_get_all_files(drives['answers'])
    print(f"deleting all answers in drive: " + ', '.join(all_filenames))
    drives['answers'].delete_many(all_filenames)
    # for key in all_filenames:
    #     dbs['answers'].delete(key)
    rows = fetch_all_from_db(dbs['answers'])
    print("deleting all answers in db: " + rows)
    for row in rows:
        dbs['answers'].delete(row.key)

# this will delete all answers from the drive (evtl db)
@pytest.fixture
def teardown_answers():
    yield
    delete_all_test_answers()

        
### TODO
# happy paths for each endpoint
# - need setup/teardown structure. need to learn pytest. fixtures i think
#   - load test_question drive with question list, use as precond for all...maybe as a module-level vs test/session
#   - autouse for fixtures to be run before every test -> diff than session?
#   - when to init test db w/ data if using dep inj override? in override_ functions, but only need/want to init it once per tseting session, not per endpoint call -> how to model? maybe do that top level in file, and return the init'd instance in override_
# enumerate edge caes for each end point, decide which oens to write tests for
# do i want to deploy a test micro, akin to a dev server the FE can test against?
# - eventually, yeah, prob

@pytest.fixture
def getQuestion():
    response = client.get("/getQuestion")

def test_get_question():
    # todo turn set_question and delete_questions into context manager, have it default to true, and manually disable it for test_no_questions_available, the 1 test that wouldn't use it. but parameterize it by 
    set_question(2)
    # add a question to the drive (via file)
    response = client.get("/getQuestion")
    assert response.status_code == 200
    print(response.json())
    delete_questions()
    # assert structure of response
    # assert types (uuid, str, int)
    # don't think it's worth checking content of str and int?
    # todo compare to class attribs?
    # assert response.json().keys == model.QuestionModel

def test_no_questions_available():
     response = client.get("/getQuestion")
     assert response.status_code == 500

def test_submit_answer():
    response = client.post("/submitAnswer",
                           json={"audio_data": "test data",
                                 "question_uuid": "test question"})
    assert response.status_code == 200
    # check the answer_uuid is a string of digits
    #assert response.json 

### submitAnswer
# - happy path results in entry appearing in drive, and entry and db
# - - create a drive+db for our test cases? or mock them out would be better
# - drive is full error
# - other drive errors? (overwriting?)
# - db errors

# workflow test: getAnswer -> no filtered answers -> submitAnswer -> getAnswer -> one

### getAnswer
# - no answers to get
# - no filtered answers to get
# - answer is got
# - - client has binary data, and server db is updated num_listens
# - - with and without a seen_before list
# - - test distribution from each category? and seeing randomness from within each category
# - - - test for round robin delivery, 1 from each category
# - question not found error


### flagAnswer
# - happy path results in incremented flag in db
# - error answer not found

### rateAnswer
# - 3 happy paths: abstain, disagree, agree
# - error case of unknown answer_uuid
# - answer not found error

### getAnswerStats

# could create fixtures and build user workflows out of them,
# but wouldn't I want to paramterize them?
# @pytest.fixture
# def submit_answer(): # eg pass question_uuid as paramter here?
# would I make submit_answer require getQuestion? that would be
# proper workflow. would also want to test what happens in system
# if that doesn't happen though. but can use fixtures to define
# happy path while serving as scaffolding for downstream tests
# LEFT OFF reading:
# - on pytest fixtures: https://docs.pytest.org/en/6.2.x/fixture.html
# - on testing fastapi with pytest: https://www.jeffastor.com/blog/testing-fastapi-endpoints-with-docker-and-pytest/

# this is more of an e2e test of user workflow
def test_get_answer_stats(teardown_answers):
    qid = "testQ"
    # submit new answer and verify stats start at 0
    response = client.post("/submitAnswer",
                           json={"audio_data": "test data",
                                 "question_uuid": qid})
    answer_uuid = response.json()['answer_id']
    print(answer_uuid)

    stats = client.get(f"/getAnswerStats?answer_uuid={answer_uuid}").json()
    print(stats)
    stat_keys = ['num_agrees', 'num_disagrees', 'num_abstains', 'num_serves']
    for stat in stat_keys:
        assert(stats[stat] == 0)
#    question_uuid = client.post("/getQuestion").json()['key']
    
    # get the answer to update the stats
    response = client.post(f"/getAnswer?question_uuid={qid}", json=[]).json()
    print(response)
    aid = response['answer_uuid']
    stats = client.get(f"/getAnswerStats?answer_uuid={answer_uuid}").json()
    assert(stats['num_serves'] == 1)

    # rate answer few times, make sure db updates
    # (rly should be getting answer every time i guess)
    # changing rating each time ('agreement').
    # prob need to replace this when auth introduced.
    # - can just create func for the workflow loop instead
    response = client.get(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=1")
    response = client.get(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=-1")
    response = client.get(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=0")
    response = client.get(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=-1")
    response = client.get(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=1")
    response = client.get(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=-1")
    stats = client.get(f"/getAnswerStats?answer_uuid={answer_uuid}").json()
    assert(stats['num_disagrees'] == 3)
    assert(stats['num_agrees'] == 2)
    assert(stats['num_abstains'] == 1)
    
def test_bad_answer_stats():
    response = client.get("/getAnswerStats")
    assert response.status_code == 422 # this is what fastapi returns by default i guess? 

def test_no_answer_stats():
    response = client.get("/getAnswerStats?answer_uuid=2248634230063352")
    assert response.status_code == 200
    assert response.json() == NoAnswersResponse().dict()
    
