# Firebase push notifications

import firebase_admin
import json
import requests

from config import config

default_app = firebase_admin.initialize_app()

