# Autopopulate the database with mockup data from data.json

import json
import os
import requests

# Load the data from data.json in db_mockup
with open(os.path.join(os.path.dirname(__file__), "data.json")) as f:
    data = json.load(f)

# Setup constants
url = "http://127.0.0.1:80"
admin_creation_password = "admin"


# Create admin
admin_data = data["admin"]
response = requests.post(
    url + "/api/admin/create_admin",
    params={"password": admin_creation_password},
    json=admin_data,
)


# Login admin
response = requests.post(
    url + "/api/auth/login/username",
    data={
        "username": admin_data["username"],
        "password": admin_data["password"],
        "firebase_token": admin_data["firebase_token"],
    },
)
admin_token = response.json()["access_token"]


# Create tests
tests_data = data["tests"]
tests = []
try:
    response = requests.post(
        url + "/api/admin/tests",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=tests_data,
    )
    tests = response.json()
except Exception as e:
    if (
        'duplicate key value violates unique constraint "tests_name_key"' in str(e)
    ):
        print(f"Key already exists")
    raise e


# Save to output file, create if it doesn't exist
try:
    os.makedirs(os.path.dirname("output/tests.json"))
except FileExistsError:
    pass
with open("output/tests.json", "w") as f:
    json.dump(tests, f, indent=4)


# Create users
users_data = data["users"]
users = []
for user_data in users_data:
    response = requests.post(
        url + "/api/auth/register",
        json=user_data,
    )
    response = requests.post(
        url + "/api/auth/login",
        params={"device_id": user_data["device_id"],
                "firebase_token": user_data["firebase_token"]},
    )
    users.append(response.json())

# Save to output file, create if it doesn't exist
try:
    os.makedirs(os.path.dirname("output/users.json"))
except FileExistsError:
    pass
with open("output/users.json", "w") as f:
    json.dump(users, f, indent=4)


# Create questions
questions_data = data["questions"]
questions = []
questions_output = []

response = requests.post(
    url + "/api/admin/questions",
    headers={"Authorization": f"Bearer {admin_token}"},
    json=questions_data,
)

for question_in_response, question_in_data in zip(response.json(), questions_data):
    question = {**question_in_data, "id": question_in_response["id"]}
    questions.append(question)

# Update questions to set "of_the_day"
response = requests.patch(
    url + "/api/admin/questions",
    headers={"Authorization": f"Bearer {admin_token}"},
    json=questions,
)
for question in response.json():
    questions_output.append(question)

# Save to output file, create if it doesn't exist
try:
    os.makedirs(os.path.dirname("output/questions.json"))
except FileExistsError:
    pass
with open("output/questions.json", "w") as f:
    json.dump(questions_output, f, indent=4)
