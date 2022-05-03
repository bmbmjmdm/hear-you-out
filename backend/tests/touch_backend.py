import os
from deta import Deta, Drive, Base

from dotenv import load_dotenv

load_dotenv(override=True)
Secret_key = os.environ.get('DETA_PROJECT_KEY')
deta = Deta(Secret_key)

b = Base("questions")
b.put("test")
