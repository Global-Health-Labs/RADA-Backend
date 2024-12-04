import hashlib
from flask import Blueprint, jsonify, request
import boto3
from werkzeug.utils import secure_filename
from config import DevelopmentConfig, ProductionConfig
import os
from db import db
from models.index import ExperimentalPlan, Document
from flask_jwt_extended import jwt_required

AWS_ACCESS_KEY_ID = None
AWS_SECRET_ACCESS_KEY = None
BUCKET_NAME = None
AWS_REGION = None

if os.environ.get("FLASK_ENV") == "prod":
    production = ProductionConfig()
    AWS_ACCESS_KEY_ID = production.PROD_AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY = production.PROD_AWS_SECRET_ACCESS_KEY
    BUCKET_NAME = production.DOCUMENTS_BUCKET_NAME
    AWS_REGION = production.PROD_AWS_REGION

elif os.environ.get("FLASK_ENV") == "dev":
    development = DevelopmentConfig()
    AWS_ACCESS_KEY_ID = development.DEV_AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY = development.DEV_AWS_SECRET_ACCESS_KEY
    BUCKET_NAME = development.BUCKET_NAME

s3 = boto3.client(
    "s3",
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
)

mastermixes = Blueprint("mastermixes", __name__)
documents = Blueprint("documents", __name__)


@documents.route("/documents/<string:experiment_id>/upload", methods=["POST"])
@jwt_required()
def upload_document(experiment_id):
    experiment = ExperimentalPlan.query.get(experiment_id)
    if not experiment:
        return jsonify({"message": "Experiment not found"}), 404

    if "file" not in request.files:
        return jsonify({"message": "No file part"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"message": "No selected file"}), 400

    filename = secure_filename(file.filename)

    existing_doc = Document.query.filter_by(
        experiment_plan_id=experiment_id, secure_file_name=filename
    ).first()
    if existing_doc:
        return jsonify({"message": "File already exists"}), 400

    file_contents = file.read()
    file_size = len(file_contents)
    file_hash = hashlib.sha256(file_contents).hexdigest()

    file.seek(0)

    try:
        s3.upload_fileobj(
            file,
            BUCKET_NAME,
            filename,
            ExtraArgs={
                "ContentType": file.content_type,
                "ContentDisposition": f'attachment; filename="{filename}"',
            },
        )
        file_url = f"https://{BUCKET_NAME}.s3.amazonaws.com/{filename}"

        new_doc = Document(
            experiment_plan_id=experiment_id,
            original_file_name=file.filename,
            secure_file_name=filename,
            s3_url=file_url,
            content_type=file.content_type,
            file_size=file_size,
            file_hash=file_hash,
        )
        db.session.add(new_doc)
        db.session.commit()

        return jsonify({"message": "File uploaded successfully", "url": file_url}), 200
    except Exception as e:
        return jsonify({"message": "Upload failed", "error": str(e)}), 500


@documents.route("/documents/experiment/<string:experiment_id>", methods=["GET"])
@jwt_required()
def get_documents(experiment_id):
    experiment = ExperimentalPlan.query.get(experiment_id)
    if not experiment:
        return jsonify({"message": "Experiment not found"}), 404

    documents = Document.query.filter_by(experiment_plan_id=experiment_id).all()
    return jsonify([doc.serialize() for doc in documents]), 200


@documents.route("/documents/<string:document_id>", methods=["GET"])
@jwt_required()
def get_document(document_id):
    document = Document.query.get(document_id)
    if not document:
        return jsonify({"message": "Document not found"}), 404

    try:
        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": BUCKET_NAME,
                "Key": document.secure_file_name,
            },
            ExpiresIn=600,
        )
        return (
            jsonify({"document_id": document.id, "presigned_url": presigned_url}),
            200,
        )
    except Exception as e:
        print(e)
        return jsonify({"message": "Error generating presigned URL"}), 500


@documents.route("/documents/<string:document_id>", methods=["DELETE"])
@jwt_required()
def delete_document(document_id):
    document = Document.query.get(document_id)
    if not document:
        return jsonify({"message": "Document not found"}), 404

    try:
        s3.delete_object(Bucket=BUCKET_NAME, Key=document.secure_file_name)
        db.session.delete(document)
        db.session.commit()
        return jsonify({"message": "Document deleted successfully"}), 200
    except Exception as e:
        return jsonify({"message": "Delete failed", "error": str(e)}), 500
