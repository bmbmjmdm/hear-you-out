import sys
import yaml
import pytest

from deta import Drive, Base

from fastapi import FastAPI, Response
from fastapi.testclient import TestClient

from ..main import QuestionModel, NoAnswersResponse

# - want to play with postman to construct flows, and tests
# - - and openAPI Links: https://swagger.io/docs/specification/links/
# - AsyncAPI is for event-driven arch, not REST

# ... should we bother being RESTful, or just do our own protocol over http?

# on testing fastapi with pytest: https://www.jeffastor.com/blog/testing-fastapi-endpoints-with-docker-and-pytest/

# notes on pytest https://docs.pytest.org/en/6.2.x/fixture.html
# - to run multiple asserts safely,: All that’s needed is stepping up to a larger scope, then having the act step defined as an autouse fixture, and finally, making sure all the fixtures are targetting that highler level scope. 
# - use markers to pass data to fixtures
# - - example given is for scalar data. what about dict?
# - “factory as fixture” pattern can help in situations where the result of a fixture is needed multiple times in a single test, parameterizable in test
# - parameterize fixtures to run all tests depending on them per parameter, for when components themselves can be configured multiple ways
# - can use markers to run fixtures for all tests in a class/module when you don't need it's return value (eg @pytest.mark.usefixtures("cleandir"))
# - can override fixtures, useful in big projects
# - can run a series of tests incrementally if latter don't make sense to run when former fails: https://docs.pytest.org/en/6.2.x/example/simple.html#incremental-testing-test-steps
# - best practices for organization, packaging: https://docs.pytest.org/en/6.2.x/goodpractices.html 

# notes on pytest usage https://docs.pytest.org/en/6.2.x/usage.html
# - specifying tests via module, directory ,keyword, note id, pytest.marker, pkg
# - modifying traceback printing
# - dropping to python debugger pdb
# - profiling

# notes on pytest parameterization https://docs.pytest.org/en/6.2.x/parametrize.html and https://docs.pytest.org/en/6.2.x/example/parametrize.html#paramexamples
# - pytest.fixture() allows one to parametrize fixture functions (as discussed above)
# - @pytest.mark.parametrize allows one to define multiple sets of arguments and fixtures at the test function or class
# - - can dynamically generate them
# - - can stack them on top of each other to get all combinations
# - pytest_generate_tests allows one to define custom parametrization schemes or extensions
# - stackOverflow Q on passing args to a fixture: https://stackoverflow.com/questions/44677426/can-i-pass-arguments-to-pytest-fixtures
# - - explains indirect parameterization a bit more


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
        # instead of using global, should...
        test_drives['questions'].put(qfilename, yaml_string)
    else:
        raise Exception(f"{qfilename} already in drive, not overwriting just in case")

    yield qm
    test_drives['questions'].delete(qfilename)
    # todo delete from db too

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
# happy paths for each endpoint
# enumerate edge caes for each end point, decide which oens to write tests for
# do i want to deploy a test micro, akin to a dev server the FE can test against?
# - eventually, yeah, prob. to do integration testing with FE eg

### getQuestion

@pytest.fixture
def getQuestion(client: TestClient) -> Response:
    response = client.get("/getQuestion")
    yield response

def test_get_question(set_1_question: QuestionModel, # Arrange
                      getQuestion) -> None: # using this as the Act about which we Assert
    
    assert getQuestion.status_code == 200
    assert getQuestion.json() == set_1_question.dict()

def test_no_questions_available(getQuestion) -> None:
     assert getQuestion.status_code == 500

### submitAnswer
# - happy path results in entry appearing in drive, and entry and db
# - - create a drive+db for our test cases? or mock them out would be better
# - drive is full error
# - other drive errors? (overwriting?)
# - db errors

@pytest.fixture
def submitAnswer(client: TestClient,
                 test_dbs, test_drives,
                 set_1_question, # Arrange for getQuestion
                 getQuestion: Response, # Arrange
                 request, # Arrange (parameterized for audio data)
                 question_uuid: str = None # Arrange # TODO change to uuid
                 ) -> Response:

    assert getQuestion.status_code == 200
    
    audio_data = "test data" if request is None else request.param
    # is it possible to put this in the arglist? ie, refer to other arg
    question_uuid = getQuestion.json()['key'] if question_uuid is None else question_uuid
    
    response = client.post("/submitAnswer",
                           json={"audio_data": audio_data,
                                 "question_uuid": question_uuid})
    yield response

    def delete_answer(key, dbs, drives):
        drives['answers'].delete(key)
        dbs['answers'].delete(key)

    if response.status_code == 200:
        delete_answer(response.json()['answer_id'], test_dbs, test_drives)

# parameterizing this instead of using default value so test case is clearer,
# but maybe overly complicated to use fixture to auto delete_answer?
@pytest.mark.parametrize('submitAnswer',
                         ["test audio data"],
                         indirect=['submitAnswer'])
def test_submit_answer(client: TestClient,
                       submitAnswer: Response, # Arrange and Act
                       ) -> None:

    assert submitAnswer.status_code == 200
    # check the answer_uuid is a string of digits
    #assert response.json
    answer_uuid = submitAnswer.json()['answer_id']
    # check answer is now in db and drive and associated to correct qid, with
    # audio data being exactly 'test audio data'
    # LEFT OFF here ^, and inserting/udpating db row upon getQuestion
    
    # ...do we want to explicitly test that this answer_id doesn't exist beforehand?
    # bc if so, need to do an Assert before the Act...
    # mb create 2nd test case for this? can we call fixture inside test case?
    # or mb don't need to due to nature of arrange fixtures?

def test_submit_answer_wrong_qid(client: TestClient) -> None:
    response = client.post("/submitAnswer",
                           json={"audio_data": "test data",
                                 "question_uuid": "key doesn't exist"})
    assert response.status_code == 400 # what to return?
    

### getAnswer
# - workflow test: getAnswer -> no filtered answers -> submitAnswer -> getAnswer -> one
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

# def test_workflow_get_answer_stats(client: TestClient,
#                                    set_1_question: QuestionModel,
#                                    test_dbs,
#                                    test_drives) -> None:
#     qid = set_1_question.key
    
#     # submit new answer and verify stats start at 0
#     response = client.post("/submitAnswer",
#                            json={"audio_data": "test data",
#                                  "question_uuid": qid})
#     answer_uuid = response.json()['answer_id']

#     stats = client.get(f"/getAnswerStats?answer_uuid={answer_uuid}").json()
#     stat_keys = ['num_agrees', 'num_disagrees', 'num_abstains', 'num_serves']
#     for stat in stat_keys:
#         assert(stats[stat] == 0)
# #    question_uuid = client.post("/getQuestion").json()['key']
    
#     # get the answer to update the stats
#     response = client.post(f"/getAnswer?question_uuid={qid}", json=[]).json()
#     aid = response['answer_uuid']
#     stats = client.get(f"/getAnswerStats?answer_uuid={answer_uuid}").json()
#     assert(stats['num_serves'] == 1)

#     # rate answer few times, make sure db updates
#     # rly should be getting answer every time i guess
#     # -> update when I introduce auth/proper workflows
#     # - can just create func for the workflow loop instead
#     response = client.post(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=1")
#     response = client.post(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=-1")
#     response = client.post(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=0")
#     response = client.post(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=-1")
#     response = client.post(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=1")
#     response = client.post(f"/rateAnswer?answer_uuid={answer_uuid}&agreement=-1")
#     stats = client.get(f"/getAnswerStats?answer_uuid={answer_uuid}").json()
#     print("test", stats)
#     assert(stats['num_disagrees'] == 3)
#     assert(stats['num_agrees'] == 2)
#     assert(stats['num_abstains'] == 1)

#     delete_answer(aid, test_dbs, test_drives)

# do I need to test this?
def test_bad_answer_stats(client: TestClient) -> None:
    response = client.get("/getAnswerStats")
    assert response.status_code == 422 # this is what fastapi returns by default i guess 

def test_no_answer_stats(client: TestClient) -> None:
    response = client.get("/getAnswerStats?answer_uuid=2248634230063352")
    assert response.status_code == 200
    assert response.json() == NoAnswersResponse().dict()
    
