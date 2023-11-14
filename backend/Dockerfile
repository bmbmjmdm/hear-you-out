FROM tiangolo/uvicorn-gunicorn-fastapi:python3.11
RUN pip install --upgrade pip
COPY ./requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt
