from flask import Blueprint, jsonify
from flask import request
from models.index import User, Role, db
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from flask import current_app
from models.index import db, User
from datetime import datetime
from jinja2 import Environment, FileSystemLoader

import boto3
import os
from dotenv import load_dotenv

load_dotenv()

if os.getenv("FLASK_ENV") == "dev":
    aws_access_key_id = os.getenv("DEV_AWS_ACCESS_KEY_ID")
    aws_secret_access_key = os.getenv("DEV_AWS_SECRET_ACCESS_KEY")
    ses_client = boto3.client(
        "ses",
        region_name="us-east-1",
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
    )
    url = "http://localhost:3000"
    aws_ses_source_email = os.getenv("AWS_SES_SOURCE_EMAIL")

elif os.getenv("FLASK_ENV") == "prod":
    aws_access_key_id = os.getenv("PROD_AWS_ACCESS_KEY_ID")
    aws_secret_access_key = os.getenv("PROD_AWS_SECRET_ACCESS_KEY")
    aws_region = os.getenv("PROD_AWS_REGION")
    if not os.getenv("FRONTEND_SUBDOMAIN"):
        url = f"https://{os.getenv('DOMAIN_NAME')}"
    else:
        url = f"https://{os.getenv('FRONTEND_SUBDOMAIN')}.{os.getenv('DOMAIN_NAME')}"
    aws_ses_source_email = os.getenv("AWS_SES_SOURCE_EMAIL")
    ses_client = boto3.client(
        "ses",
        region_name=aws_region,
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
    )


def generate_token(email, secret_key):
    serializer = URLSafeTimedSerializer(secret_key)
    return serializer.dumps(email, salt=current_app.config["SECURITY_PASSWORD_SALT"])


auth = Blueprint("auth", __name__)


@auth.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    user = User.query.filter_by(email=data["email"]).first()

    if not user:
        return "Invalid email or password", 400

    if not user.check_password(data["password"]):
        return "Invalid email or password", 400

    if not user.confirmed:
        return "Please confirm your email or reset password", 400

    # create jwt token
    access_token = create_access_token(
        identity={
            "id": user.id,
            "fullname": user.fullname,
            "email": user.email,
            "role": user.role.name,
        }
    )

    return (
        jsonify(
            {
                "access_token": access_token,
            }
        ),
        200,
    )


@auth.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    user = User.query.filter_by(email=data["email"]).first()
    if user:
        return (
            jsonify(
                {
                    "error": "UserAlreadyExists",
                    "message": "A user with the given email already exists.",
                }
            ),
            409,
        )

    new_user = User(
        fullname=data["fullName"],
        email=data["email"],
        password=data["password"],
        role_updated_at=datetime.now(),
    )

    new_user.set_password(data["password"])

    if User.query.count() == 0:
        role = Role.query.filter_by(name="admin").first()
    else:
        role = Role.query.filter_by(name="user").first()

    if not role:
        return "Role not found", 400

    new_user.role_id = role.id

    db.session.add(new_user)
    db.session.commit()

    confirm_token = generate_token(new_user.email, current_app.config["SECRET_KEY"])
    confirm_url = f"{url}/auth/confirm/{confirm_token}"

    html_content = load_email_template("confirmationEmail.html", confirm_url)

    try:
        ses_client.send_email(
            Source=aws_ses_source_email,
            Destination={"ToAddresses": [new_user.email]},
            Message={
                "Body": {"Html": {"Charset": "UTF-8", "Data": html_content}},
                "Subject": {"Charset": "UTF-8", "Data": "Confirm Your Email"},
            },
        )

    except Exception as e:
        print(f"Error sending confirmation email: {e}")

    try:
        access_token = create_access_token(
            identity={
                "id": new_user.id,
                "fullname": new_user.fullname,
                "email": new_user.email,
                "role": role.name,
            }
        )

        return (
            jsonify(
                {
                    "access_token": access_token,
                }
            ),
            201,
        )
    except Exception as e:
        print(f"Error sending confirmation email: {e}")


@auth.route("/resend-confirm-email", methods=["POST"])
def resend_confirmation():
    data = request.get_json()
    user = User.query.filter_by(email=data["email"]).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.confirmed:
        return jsonify({"message": "Email already confirmed"}), 400

    # Generate and send a new confirmation email as done in the register route
    confirm_token = generate_token(user.email, current_app.config["SECRET_KEY"])
    confirm_url = f"{url}/auth/confirm/{confirm_token}"
    html_content = load_email_template("confirmationEmail.html", confirm_url)

    # send email
    try:
        ses_client.send_email(
            Source=aws_ses_source_email,
            Destination={"ToAddresses": [user.email]},
            Message={
                "Body": {"Html": {"Charset": "UTF-8", "Data": html_content}},
                "Subject": {"Charset": "UTF-8", "Data": "Confirm Your Email"},
            },
        )

    except Exception as e:
        print(f"Error sending confirmation email: {e}")
        return jsonify({"message": "Failed to send confirmation email"}), 500

    # Use your email sending logic here
    return jsonify({"message": "Confirmation email resent"}), 200


@auth.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    current_user = get_jwt_identity()
    print("current user: ", current_user)
    user = User.query.filter_by(id=current_user["id"]).first()
    if not user:
        return jsonify({"message": "Invalid Token", "statusCode": 401})
    user_dict = user.__dict__

    role = Role.query.filter_by(id=user_dict["role_id"]).first()
    user_data = {
        "id": user_dict["id"],
        "fullName": user_dict["fullname"],
        "email": user_dict["email"],
        "role": role.name,
        "confirmed": user_dict["confirmed"],
    }

    return jsonify({"user": user_data}), 200


@auth.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    user = User.query.filter_by(email=data["email"]).first()

    if not user:
        return jsonify({"message": "Email not found"}), 404

    try:
        reset_token = generate_token(user.email, current_app.config["SECRET_KEY"])
        reset_url = f"{url}/reset-password?token={reset_token}"
        ses_client.send_email(
            Source=aws_ses_source_email,
            Destination={
                "ToAddresses": [user.email],
            },
            Message={
                "Body": {
                    "Text": {
                        "Data": f"Please click on the link to reset your password: {reset_url}",
                    },
                },
                "Subject": {
                    "Data": "Reset Your Password",
                },
            },
        )
    except Exception as e:
        print(f"Error sending email: {e}")
        return jsonify({"message": "Failed to send reset password email"}), 500

    return jsonify({"message": "Reset password email sent successfully"}), 200


@auth.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    reset_token = data.get("token")
    new_password = data.get("password")

    if not reset_token or not new_password:
        return jsonify({"message": "Missing token or password"}), 400

    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])

    try:
        email = serializer.loads(
            reset_token, salt=current_app.config["SECURITY_PASSWORD_SALT"], max_age=3600
        )
    except SignatureExpired:
        return jsonify({"message": "The reset token is expired"}), 400
    except BadSignature:
        return jsonify({"message": "Invalid reset token"}), 400

    user = User.query.filter_by(email=email).first()
    if user is None:
        return jsonify({"message": "Invalid token or user does not exist"}), 400

    user.set_password(new_password)
    db.session.commit()

    return jsonify({"message": "Your password has been reset successfully"}), 200


@auth.route("/confirm/<token>", methods=["GET"])
def confirm_email(token):
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])

    try:
        email = serializer.loads(
            token, salt=current_app.config["SECURITY_PASSWORD_SALT"], max_age=3600 * 24
        )
    except (SignatureExpired, BadSignature):
        return (
            jsonify({"message": "The confirmation link is invalid or has expired."}),
            400,
        )

    try:
        user = User.query.filter_by(email=email).first()
        if user is None:
            return jsonify({"message": "Invalid token or user does not exist"}), 400

        if user.confirmed:
            return jsonify({"message": "Account already confirmed."}), 400
        else:
            user.confirmed = True
            db.session.commit()
            token = create_access_token(
                identity={
                    "id": user.id,
                    "fullname": user.fullname,
                    "email": user.email,
                    "role": user.role.name,
                }
            )
            return (
                jsonify(
                    {"message": "Your account has been confirmed.", "token": token}
                ),
                200,
            )

    except Exception as e:
        print(f"Error confirming account: {e}")
        return jsonify({"message": f"Error confirming account: {e}"}), 500


def load_email_template(template_name, confirm_url=""):
    """Reads an HTML file from the templates directory and returns its rendered content."""
    base_dir = os.path.dirname(
        os.path.dirname(__file__)
    )  # This goes up two levels from the current script
    templates_dir = os.path.join(
        base_dir, "templates", "emails"
    )  # Adjusted path to the templates directory
    env = Environment(loader=FileSystemLoader(templates_dir))
    template = env.get_template(template_name)
    personalized_html = template.render(confirm_url=confirm_url)
    return personalized_html
