from fastapi.testclient import TestClient

from .main import app

client = TestClient(app)

def test_get_question():
    response = client.get("/getQuestion")
    assert response.status_code == 200
    # assert structure of response
    # assert types (uuid, str, int)
    # don't think it's worth checking content of str and int?
    assert response.json() == {
        "id": "foo",
        "title": "Foo",
        "description": "There goes my hero",
    }

def test_no_questions_available():
    # TODO mock client to temp erase it's question store
    # (put question getting in a separate func?)
    response = client.get("/getQuestion")
    assert response.status_code == 500
    #assert response.json() == "uh oh"

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
# - 2 happy paths, for each side of the bool
# - answer not found error
