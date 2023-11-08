## running in docker

FROM tiangolo/uvicorn-gunicorn-fastapi:python3.11

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application source code
COPY . .

# Expose port 8080
EXPOSE 8080

# Alembic


# Run the application
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]