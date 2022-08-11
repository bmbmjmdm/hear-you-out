from pathlib import Path
from pydantic import BaseSettings

class Settings(BaseSettings):
    qfilename: str = 'question_list.yaml'
    local_test_dir: Path = Path('tests/')
    local_qpath: Path = Path(local_test_dir / qfilename)
