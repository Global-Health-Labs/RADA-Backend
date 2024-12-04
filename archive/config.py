from dotenv import load_dotenv
import os

load_dotenv()

class Config(object):
    JWT_SECRET_KEY = "your-secreket-key-ghl-1234"
    SECURITY_PASSWORD_SALT = "your_secret_salt_here_ghl-1234"
    JWT_ACCESS_TOKEN_EXPIRES = False
    SECRET_KEY = "your-secret-key"
    PORT = os.getenv("PORT")

    # aws
    BUCKET_NAME = os.getenv("BUCKET_NAME")
    AWS_SES_SOURCE_EMAIL = os.getenv("AWS_SES_SOURCE_EMAIL")
class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv("DEV_MSSQL_DB_URI")
    DEV_AWS_ACCESS_KEY_ID = os.getenv("DEV_AWS_ACCESS_KEY_ID")
    DEV_AWS_SECRET_ACCESS_KEY = os.getenv("DEV_AWS_SECRET_ACCESS_KEY")

class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = f"mssql+pyodbc://{os.getenv('PROD_MSSQL_DB_USER')}:{os.getenv('PROD_MSSQL_DB_PASS')}@{os.getenv('PROD_MSSQL_DB_HOST')}/{os.getenv('PROD_MSSQL_DB_NAME')}?driver={os.getenv('PROD_MSSQL_DB_DRIVER')}&TrustServerCertificate={os.getenv('PROD_MSSQL_DB_TRUST_SERVER_CERTIFICATE')}"
    PROD_AWS_ACCESS_KEY_ID = os.getenv("DEV_AWS_ACCESS_KEY_ID")
    PROD_AWS_SECRET_ACCESS_KEY = os.getenv("DEV_AWS_SECRET_ACCESS_KEY")
    PROD_AWS_REGION = os.getenv("PROD_AWS_REGION")
    DOCUMENTS_BUCKET_NAME = os.getenv("DOCUMENTS_BUCKET_NAME")
    DOMAIN_NAME = os.getenv("DOMAIN_NAME")
    FRONTEND_SUBDOMAIN = os.getenv("FRONTEND_SUBDOMAIN")
    BACKEND_SUBDOMAIN = os.getenv("BACKEND_SUBDOMAIN")
