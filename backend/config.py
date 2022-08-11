from pydantic import BaseSettings

class Settings(BaseSettings):
    qfilename: str = 'list of questions.yaml'
