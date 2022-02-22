import yaml
from deta import Drive, Base
from fastapi.testclient import TestClient

from ..main import app, get_dbs, get_drives, QuestionModel

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

# if these don't get run, 
app.dependency_overrides[get_dbs] = get_test_dbs
app.dependency_overrides[get_drives] = get_test_drives

client = TestClient(app)

# key must be unique
def set_question(key, text='none', category='n/a'):
    # this doesn't add a q, it sets entire list to single q

    # yaml data model:
    # questions:
    # - key: 1
    #   text: "What is one idea, novel or otherwise, that you'd like more people to hear about?"
    #   category: "type 1"

    qm = QuestionModel(key=key, text=text, category=category)
    # model_dicts = [QuestionModel(*q).dict() for q in questions]
    yaml_string = yaml.dump({'questions': [qm.dict()]}, sort_keys=False)
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
    
### TODO
# happy paths for each endpoint
# - need setup/teardown structure. need to learn pytest. fixtures i think
#   - load test_question drive with question list, use as precond for all...maybe as a module-level vs test/session
#   - autouse for fixtures to be run before every test -> diff than session?
#   - when to init test db w/ data if using dep inj override? in override_ functions, but only need/want to init it once per tseting session, not per endpoint call -> how to model? maybe do that top level in file, and return the init'd instance in override_
# enumerate edge caes for each end point, decide which oens to write tests for
# do i want to deploy a test micro, akin to a dev server the FE can test against?
# - eventually, yeah, prob

def test_get_question():
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

# def test_no_questions_available():
#     # TODO mock client to temp erase it's question store
#     # (put question getting in a separate func?)
#     response = client.get("/getQuestion")
#     assert response.status_code == 500
#    #assert response.json() == "uh oh"

def test_submit_answer():
    response = client.post("/submitAnswer",
                           json={"audio_data": "test data",
                                 "question_uuid": "test question"})
    assert response.status_code == 200
    # check the answer_uuid is a string of digits
    #assert response.json 

# submitAnswer
# - happy path results in entry appearing in drive, and entry and db
# - - create a drive+db for our test cases? or mock them out would be better
# - drive is full error
# - other drive errors? (overwriting?)
# - db errors

# workflow test: getAnswer -> no filtered answers -> submitAnswer -> getAnswer -> one

# getAnswer
# - no answers to get
# - no filtered answers to get
# - answer is got
# - - client has binary data, and server db is updated num_listens
# - - with and without a seen_before list
# - - test distribution from each category? and seeing randomness from within each category
# - - - test for round robin delivery, 1 from each category
# - question not found error


# flagAnswer
# - happy path results in incremented flag in db
# - error answer not found

# rateAnswer
# - 3 happy paths: abstain, disagree, agree
# - error case of unknown answer_uuid
# - answer not found error

# getAnswerStats
# - query empty db -> get error
# - submitAnswer
# - verify 0 across the board
# - get answer -> verify
# - agree, dis, ab, dis, agree, dis -> 3, 2, 1
# - - prob need to replace this when auth introduced.
# - - - can just create func for the workflow loop instead
def test_get_answer_stats():
    pass
