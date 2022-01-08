from fastapi.testclient import TestClient

from ..main import app, get_db, get_drive

def override_get_drives():
    try:
        questions_drive = Drive("TEST_questions")
        answers_drive = Drive("TEST_answers")
        yield {'questions': questions_drive,
               'answers': answers_drive}
    finally:
        pass # don't need to close drive
def override_get_dbs():
    try:
        questions_db = Base("TEST_questions")
        answers_db = Base("TEST_answers")
        yield {'questions': questions_db,
               'answers': answers_db}
    finally:
        pass # don't need to close db


app.dependency_overrides[get_dbs] = override_get_dbs
app.dependency_overrides[get_drives] = override_get_drives

db = override_get_dbs()
drive = override_get_drives()

client = TestClient(app)

### TODO
# happy path for each endpoint
# - need setup/teardown structure. need to learn pytest. fixtures i think
# enumerate edge caes for each end point, decide which oens to write tests for

def test_get_question():
    # add a question to the drive (via file)
    response = client.get("/getQuestion")
    assert response.status_code == 200
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

# getAnswer
# - no answers to get
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
# - test that num_Serves equals sum of others

