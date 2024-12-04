from flask import Flask
from sqlalchemy import create_engine
from sqlalchemy_utils import database_exists, create_database
from werkzeug.security import generate_password_hash
from flask_cors import CORS
from db import db
from routes.auth import auth
from routes.experiments import experiments
from routes.mastermixes import mastermixes
from routes.documents import documents
from routes.users import users
from config import DevelopmentConfig, ProductionConfig
from models.index import Role
import os
from dotenv import load_dotenv

load_dotenv()

from flask_jwt_extended import JWTManager

app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
app.config["SECURITY_PASSWORD_SALT"] = os.getenv("SECURITY_PASSWORD_SALT")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
jwt = JWTManager(app)


if os.environ.get("FLASK_ENV") == "prod":
    cors = CORS(
        app,
        resources={
            r"/*": {
                "origins": [
                    f"https://{os.getenv('CLOUDFRONT_DOMAIN_NAME')}",
                    f"http://{os.getenv('CLOUDFRONT_DOMAIN_NAME')}",
                    f"http://localhost:3000",
                    f"https://localhost:3000",
                    f"https://{os.getenv('FRONTEND_SUBDOMAIN')}.{os.getenv('DOMAIN_NAME')}",
                    f"http://{os.getenv('DOMAIN_NAME')}"
                ]
            }
        },
        supports_credentials=True,
    )
    print("*** Prod environment ***")
    print("Change test")
    app.config.from_object(ProductionConfig)
elif os.environ.get("FLASK_ENV") == "dev":
    cors = CORS(
        app, supports_credentials=True, headers=["Content-Type", "Authorization"]
    )
    print("*** Dev environment ***")
    app.config.from_object(DevelopmentConfig)

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.register_blueprint(auth, url_prefix="/auth")
app.register_blueprint(experiments)
app.register_blueprint(mastermixes)
app.register_blueprint(documents)
app.register_blueprint(users)


def check_and_create_database():
    engine = create_engine(app.config["SQLALCHEMY_DATABASE_URI"])
    if not database_exists(engine.url):
        create_database(engine.url)
        print("Database created")
    else:
        print("Database already exists")


db.init_app(app)

with app.app_context():
    check_and_create_database()
    db.create_all()
    roles = Role.query.all()
    if len(roles) > 0:
        print("Roles already exist")
    else:
        roles = ["user", "admin", "supervisor"]
        for role_name in roles:
            role = Role(name=role_name)
            db.session.add(role)
        db.session.commit()
    print("*** Server started ***")

if __name__ == "__main__":
    app.config["DEV_PORT"] = os.getenv("DEV_PORT")
    app.run(host="0.0.0.0", port=app.config["DEV_PORT"], debug=True)
