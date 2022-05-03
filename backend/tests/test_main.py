import sys
import yaml
import pytest

from typing import Callable

from deta import Drive, Base

from fastapi import FastAPI, Response
from fastapi.testclient import TestClient

from ..main import QuestionModel, NoAnswersResponse, AnswerListen

# check out pytest.monkeypatch? eg https://testdriven.io/blog/fastapi-crud/

# - want to play with postman to construct flows, and tests
# - - and openAPI Links: https://swagger.io/docs/specification/links/
# - AsyncAPI is for event-driven arch, not REST
# - feels like I am essentially doing property-based testing in some of these
#   flows. so, maybe `deal` lib could be a good fit? feels like i shouldn't even
#   need tosspecify the impl given precise enough tests...

@pytest.fixture(scope="session")
def test_drives():
    questions_drive = Drive("TEST_questions")
    answers_drive = Drive("TEST_answers")
    return {'questions': questions_drive,
            'answers': answers_drive}

# could turn these into pydantic Store object to pass them around as a single object since they are used together
@pytest.fixture(scope="session")
def test_dbs():
    questions_db = Base("TEST_questions")
    answers_db = Base("TEST_answers")
    return {'questions': questions_db,
            'answers': answers_db}

# do something with each db and drive so it's accessible from deta dashboard gui
# todo make cli flag like `pytest --touch_backend`
# or maybe make its own test so i can one-off call it when needed. which would be...rarely?
def touch_backend(test_dbs, test_drives):
    test_dbs['questions'].put('test')
    test_dbs['answers'].put('test')
    test_drives['questions'].put('test', 'test')
    test_drives['answers'].put('test', 'test')

# Create a new application for testing
@pytest.fixture
def app(test_dbs, test_drives, touch_backend = False) -> FastAPI:
    from ..main import app, get_dbs, get_drives
    # all the tests in this file run against the prod deployment,
    # and these two overrides make it so that all the endpoints
    # use the test drives and bases instead of prod drives and bases.
    # an alternative would be to just swap the project api
    # (and create the "test" deployment)
    app.dependency_overrides[get_dbs] = lambda: test_dbs
    app.dependency_overrides[get_drives] = lambda: test_drives

    if touch_backend:
        touch_backend(test_dbs, test_drives)
        
    return app

@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)

# we are doing set_1_question instead of this...for now
# # Apply migrations at beginning and end of testing session
# @pytest.fixture(scope="session")
# def apply_migrations():
#     warnings.filterwarnings("ignore", category=DeprecationWarning)
#     os.environ["TESTING"] = "1"
#     config = Config("alembic.ini")
#     alembic.command.upgrade(config, "head")
#     yield
#     alembic.command.downgrade(config, "base")

# todo - how can we parameterize which set of test questions we want to load
#        into a given test? (do we actually want to do this?)
#   - could do this by returning parameterized closure!

@pytest.fixture
def set_1_question(test_dbs, test_drives) -> QuestionModel:
    # this doesn't add a q per se, it sets entire list to single q
    key = 'set_1_question key'
    text = 'none'
    category = 'n/a'

    # yaml data model:
    # questions:
    # - key: 1
    #   text: "What is one idea, novel or otherwise, that you'd like more people to hear about?"
    #   category: "type 1"

    qm = QuestionModel(key=key, text=text, category=category)
    # model_dicts = [QuestionModel(*q).dict() for q in questions]
    yaml_string = yaml.dump({'questions': [qm.dict()]}, sort_keys=False) # don't sort keys so key remains first
    
    qfilename = 'list of questions.yaml'
    qfile = test_drives['questions'].get(qfilename)
    if qfile is None:
        test_drives['questions'].put(qfilename, yaml_string)
    else:
        raise Exception(f"{qfilename} already in drive, not overwriting just in case")

    yield qm
    
    test_drives['questions'].delete(qfilename)
    test_dbs['questions'].delete(key)

# keeping these around for if I ever want one-off mass-delete functionality
    
# def fetch_all_from_drive(drive):
#     result = drive.list()

#     all_files = result.get("names")
#     paging = result.get("paging")
#     last = paging.get("last") if paging else None

#     while (last):
#         # provide last from previous call
#         result = drive.list(last=last)

#         all_files += result.get("names")
#         # update last
#         paging = result.get("paging")
#         last = paging.get("last") if paging else None

#     #print("all files:", all_files)
#     return all_files

# def fetch_all_from_db(db):
#     res = db.fetch()

#     if res.count == 0:
#         return None

#     rows = res.items
#     while res.last:
#         res = db.fetch(last=res.last)
#         rows += res.items

#     return rows

# def delete_all_test_answers():
#     dbs = test_dbs()
#     drives = test_drives()
#     all_filenames = fetch_all_from_drive(drives['answers'])
#     print(f"deleting all answers in drive: " + ', '.join(all_filenames))
#     drives['answers'].delete_many(all_filenames)
#     # for key in all_filenames:
#     #     dbs['answers'].delete(key)
#     rows = fetch_all_from_db(dbs['answers'])
#     print("deleting all answers in db: " + rows)
#     for row in rows:
#         dbs['answers'].delete(row.key)

### TODO
# remaining happy paths for each endpoint
# enumerate edge caes for each end point, decide which oens to write tests for
# do i want to deploy a test micro, akin to a dev server the FE can test against?
# - eventually, yeah, prob. to do integration testing with FE eg

## a note on path fixtures
# some fixtures are teh same name as paths in the api
# these are intended to be used as both:
# - Act step in a test specific for that rpc call
# - Arrange step for another rpc call as part of a longer flow


### getQuestion

# returns a function so we can call it more than once in a test case.

@pytest.fixture
def getQuestion(client: TestClient) -> Callable:
    def _getQuestion():
        response = client.get("/getQuestion")
        return response
    yield _getQuestion
    # could decrement num_asks in db to 100% revert state I guess
    # err, don't know how many times it's been asked, so need to copy
    # state from before yielding insteadd.

def test_get_question(set_1_question: QuestionModel, # Arrange
                      test_dbs,
                      getQuestion: Callable) -> None:

    # (gets input into DB during first ask)
    assert test_dbs['questions'].get(set_1_question.key) is None

    qresponse = getQuestion() # Act

    assert qresponse.status_code == 200
    assert qresponse.json() == set_1_question.dict()
    assert test_dbs['questions'].get(set_1_question.key)['num_asks'] == 1

    getQuestion() # Act again

    # make sure it incremented
    assert test_dbs['questions'].get(set_1_question.key)['num_asks'] == 2

def test_no_questions_available(getQuestion: Callable) -> None:
    qresponse = getQuestion()
    assert qresponse.status_code == 500

### submitAnswer

# TODO test cases for:
# - drive is full error
# - other drive errors? (overwriting?)
# - db errors

@pytest.fixture
def submitAnswer(client: TestClient,
                 test_dbs, test_drives,
                 set_1_question, # Arrange for getQuestion
                 getQuestion: Callable, # Arrange
                 ) -> Callable:
    responses = []
    def _submitAnswer(audio_data = "test data", question_uuid = ''):
        if question_uuid == '':
            qresponse = getQuestion()
            question_uuid = qresponse.json()['key']
            
        response = client.post("/submitAnswer",
                               json={"audio_data": audio_data,
                                     "question_uuid": question_uuid})
        responses.append(response)
        return response
        
    yield _submitAnswer

    def delete_answer(key, dbs, drives):
        drives['answers'].delete(key)
        dbs['answers'].delete(key)

    for response in responses:
        if response.status_code == 200:
            delete_answer(response.json()['answer_id'], test_dbs, test_drives)

def test_submit_answer(client: TestClient,
                       submitAnswer: Callable, # Arrange and Act
                       test_dbs, test_drives,
                       ) -> None:

    # no answers in the store before we submitAnswer
    assert len(test_drives['answers'].list()['names']) == 0
    assert len(test_dbs['answers'].fetch().items) == 0

    testdata = "test audio data"

    # Act
    aresponse = submitAnswer(testdata)

    # this is set from set_1_question called from submitAnswer
    question_uuid = aresponse.json()['question_id']
    
    assert aresponse.status_code == 200
    # check the answer_uuid is a uuid?

    answer_uuid = aresponse.json()['answer_id']
    metadata = test_dbs['answers'].get(answer_uuid)
    document = test_drives['answers'].get(answer_uuid)
    contents = document.read()

    # audio data being exactly 'test audio data'
    assert testdata.encode('utf-8') == contents

    # answer db metadata at initial state
    assert len(metadata.keys()) == 11 # reminder to update if we add new keys
    assert metadata['key'] == answer_uuid
    assert metadata['entry_timestamp'] == aresponse.json()['entry_timestamp']
    assert metadata['question_uuid'] == question_uuid
    assert metadata['num_flags'] == 0
    assert metadata['is_banned'] is False
    assert metadata['unban_token'] == ''
    assert metadata['was_banned'] is False
    assert metadata['num_agrees'] == 0
    assert metadata['num_disagrees'] == 0
    assert metadata['num_abstains'] == 0
    assert metadata['num_serves'] == 0
    
    # ...do we want to explicitly test that this answer_id doesn't exist beforehand?
    # bc if so, need to do an Assert before the Act...
    # mb create 2nd test case for this? can we call fixture inside test case?
    # or mb don't need to due to nature of arrange fixtures?

def test_submit_answer_wrong_qid(client: TestClient,
                                 submitAnswer) -> None:
    response = submitAnswer(question_uuid = "key doesn't exist")
    assert response.status_code == 404

### getAnswer
# - workflow test: getAnswer -> no filtered answers -> submitAnswer -> getAnswer -> one
# - no answers to get
# - no filtered answers to get
# - answer is got
# - - client has binary data, and server db is updated num_listens
# - - with and without a seen_before list
# - - test distribution from each category? and seeing randomness from within each category
# - - - test for round robin delivery, 1 from each category


def test_get_answer_wrong_qid(client: TestClient,
                              getAnswer: Callable) -> None:
    response = getAnswer(question_uuid='keynotfound')

    # should this be 404 instead?
    assert response.status_code == 200
    assert response.json() == NoAnswersResponse().dict()


def test_get_answer_no_answers(client: TestClient,
                               set_1_question,
                               ) -> None:

    response = client.post(f"/getAnswer?question_uuid={set_1_question.key}",
                           json=[])

    assert response.status_code == 200
    assert response.json() == NoAnswersResponse().dict()

def test_get_answer(client: TestClient,
                    getAnswer: Callable,
                    test_dbs, test_drives,
                    ) -> None:

    db_rows = test_dbs['answers'].fetch().items
    assert len(db_rows) == 1 # this is from the submitAnswer that getAnswer calls
    # ... not sure if I like that I can't get the value from submitAnswer as a dependency

    answer_uuid = db_rows[0]['key']
    #answer_uuid = response['answer_uuid']    

    # ensure answer bookkeeping in db
    answer_row = test_dbs['answers'].get(answer_uuid)
    assert answer_row['num_serves'] == 0
    response = getAnswer()
    answer_row = test_dbs['answers'].get(answer_uuid)
    assert answer_row['num_serves'] == 1

    # TODO
    # need to look through submitAnswer and compare results to expected distribution?
    # this feels quite important to test actually.


@pytest.fixture
def getAnswer(client: TestClient,
              test_dbs, test_drives,
              set_1_question, # Arrange
              submitAnswer: Response, # Arrange
              ) -> Callable:

    submitAnswer() # Arrange
    
    seen_answers = [] # avoiding that bug of using [] as default arg
    responses = []
    def _getAnswer(seen_answers=seen_answers, question_uuid=set_1_question.key):
        response = client.post(f"/getAnswer?question_uuid={question_uuid}",
                               json=seen_answers)
        responses.append(response)
        return response

    yield _getAnswer

    for response in responses:
        if type(response) == AnswerListen:
            test_dbs['answers'].update(
                {"num_serves": test_dbs['answers'].util.increment(-1)},
                response.json()['answer_uuid'])

### banAnswer
# - this isn't an actual endpoint but might eventually be separate event than flag
# - getAnswer doesn't get banned answer

def test_get_no_banned_answer(client: TestClient,
                              submitAnswer: Response,
                              getAnswer: Callable,
                              test_dbs, test_drives,
                              ) -> None:
    assert False


### flagAnswer
# - happy path results in incremented flag in db
# - error answer not found

### rateAnswer and getAnswerStats

@pytest.fixture
def rateAnswer(client: TestClient,
               test_dbs, test_drives,
               getAnswer: Callable, # Arrange
               ) -> Callable:
    responses = []
    def _rateAnswer(answer_uuid='', agreement=0):
        if answer_uuid == '':
            response = getAnswer()
            assert response.status_code == 200
            answer_uuid = response.json()['answer_uuid'] # TODO inconsistent get submitAnswer i think

        response = client.post(f"/rateAnswer?answer_uuid={answer_uuid}&agreement={agreement}")
        responses.append(response)
        return response

    yield _rateAnswer

    for response in responses:
        pass # TODO ought to record the rating in closure and undo here


@pytest.fixture
def getAnswerStats(client: TestClient,
                   test_dbs, test_drives,
                   getAnswer: Callable, # Arrange
                   ) -> Callable:
    responses = []
    def _getAnswerStats(answer_uuid=''):
        if answer_uuid == '':
            response = getAnswer()
            assert response.status_code == 200
            answer_uuid = response.json()['answer_uuid'] 

        response = client.get(f"/getAnswerStats?answer_uuid={answer_uuid}")
        responses.append(response)
        return response

    yield _getAnswerStats

    for response in responses:
        pass # no side effects of this endpoint

def test_rate_and_stats(rateAnswer: Callable,
                        getAnswerStats: Callable):

    # getAnswerStats calls getAnswer as part of the flow alraedy
    stats = getAnswerStats().json()
    assert stats['num_serves'] == 1
    assert stats['num_agrees'] == 0
    assert stats['num_abstains'] == 0
    assert stats['num_disagrees'] == 0

    # rateAnswer calls getAnswer as part of the flow already
    rateAnswer(agreement=1) 
    rateAnswer(agreement=-1)
    rateAnswer(agreement=0)
    rateAnswer(agreement=-1)
    rateAnswer(agreement=1)
    rateAnswer(agreement=-1)

    # this calls getAnswer, hence 8 serves total so far
    stats = getAnswerStats().json()
    assert stats['num_abstains'] == 1
    assert stats['num_agrees'] == 2
    assert stats['num_disagrees'] == 3
    assert stats['num_serves'] == 8

# do I need to test this?
def test_bad_answer_stats(client: TestClient) -> None:
    response = client.get("/getAnswerStats")
    assert response.status_code == 422 # this is what fastapi returns by default i guess 

def test_no_answer_stats(client: TestClient) -> None:
    response = client.get("/getAnswerStats?answer_uuid=2248634230063352")
    assert response.status_code == 200
    assert response.json() == NoAnswersResponse().dict()
    
