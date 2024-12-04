from flask import Blueprint, jsonify, request
from models.index import Role, User
from db import db
from datetime import datetime, timezone
from flask_jwt_extended import jwt_required

users = Blueprint("users", __name__)


@users.route("/users/roles", methods=["GET"])
@jwt_required()
def get_users_with_roles():
    users = (
        db.session.query(
            User.id.label("user_id"),
            User.fullname,
            User.email,
            Role.name.label("role"),
            User.role_updated_at,
        )
        .join(Role, User.role_id == Role.id)
        .all()
    )

    result = []
    for user in users:
        result.append(
            {
                "user_id": user.user_id,
                "fullname": user.fullname,
                "email": user.email,
                "role": user.role,
                "role_updated_at": user.role_updated_at,
            }
        )
    return jsonify(result)


@users.route("/users/<string:userId>/role", methods=["PATCH"])
@jwt_required()
def update_user_role(userId):
    data = request.get_json()
    user = User.query.get(userId)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Assuming Role and User models have 'name' and 'role' attributes respectively
    current_user_role = user.role.name
    new_role_name = data["newRole"]

    role = Role.query.filter_by(name=new_role_name).first()
    if not role:
        return jsonify({"error": "Role not found"}), 404

    # Check if the user is an admin trying to downgrade their role
    if current_user_role == "admin" and new_role_name in ["supervisor", "user"]:
        # Count how many admins exist
        admin_count = User.query.filter(User.role.has(name="admin")).count()
        # If the current user is the only admin, prevent role downgrade
        if admin_count <= 1:
            return (
                jsonify(
                    {
                        "error": "Cannot downgrade role. At least one admin must exist.",
                        "errorIdentifier": "CannotDowngradeRole",
                    }
                ),
                403,
            )

    user.role_id = role.id
    user.role_updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"message": "User role updated"}), 200
