from deta import App, Drive, Base

from .config import Settings
from .main import get_dbs, get_drives, rotate_active_question

def get_settings():
    return Settings()

### cron job to rotate questions

# this cronjob to separate file so that i can run pytest without `from deta import App`. that, or maybe i need to update my deta lib or cli so App is locally available?
# (see error when running pytest)
@app.lib.cron()
def cronjob1(event):
    return rotate_active_question(get_drives(), get_dbs(), get_settings())

# LEFT OFF need to get drive, db and settings from this file
# can i just import and call get_settings, get_drives, and get_dbs?
