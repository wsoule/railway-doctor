# Django settings for broken project

import os

SECRET_KEY = 'django-insecure-test-key'

# Debug should be False in production!
DEBUG = True

# Empty ALLOWED_HOSTS will fail on Railway
ALLOWED_HOSTS = []

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # Missing whitenoise middleware!
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'myproject.urls'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'mydb',
        'USER': 'myuser',
        'PASSWORD': 'mypassword',
        'HOST': 'localhost',  # Hardcoded localhost won't work on Railway!
        'PORT': '5432',
    }
}

# No STATIC_ROOT defined
STATIC_URL = '/static/'

# No CSRF_TRUSTED_ORIGINS for Django 4.0+
