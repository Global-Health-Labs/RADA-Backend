from typing import List
import uuid
from dataclasses import dataclass
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from db import db
from datetime import datetime


class User(UserMixin, db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fullname = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(50), nullable=False, unique=True)
    password = db.Column(db.String(256))
    role_id = db.Column(db.String(36), db.ForeignKey("role.id"), nullable=True)
    role_updated_at = db.Column(
        db.DateTime,
        default=db.func.current_timestamp(),
        onupdate=db.func.current_timestamp(),
    )
    role = db.relationship("Role", foreign_keys=[role_id], backref="users")
    confirmed = db.Column(db.Boolean, nullable=False, default=False)

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)


class Role(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(50), nullable=False, unique=True)

    # users = db.relationship('User', foreign_keys=[User.role_id], backref='role')
    def serialize(self):
        return {"id": self.id, "name": self.name}


@dataclass
class MasterMix(db.Model):
    id: str
    name_of_mastermix: str
    experimental_plan_id: str
    order_index: int

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name_of_mastermix = db.Column(db.String(50), nullable=False)
    experimental_plan_id = db.Column(
        db.String(36), db.ForeignKey("experimental_plan.id")
    )
    order_index = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(
        db.DateTime,
        default=db.func.current_timestamp(),
        onupdate=db.func.current_timestamp(),
    )
    # One-to-many relationship: A MasterMix can have many MasterMixRecipes
    recipes = db.relationship(
        "MasterMixRecipe", backref="mastermix", lazy=True, cascade="all, delete-orphan"
    )


@dataclass
class MasterMixRecipe(db.Model):
    id: str
    order_index: int

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_index = db.Column(db.Integer)
    mastermix_id = db.Column(db.String(36), db.ForeignKey("master_mix.id"))
    final_source = db.Column(db.String(50))
    unit = db.Column(db.Unicode(50))
    final_concentration = db.Column(db.Float)
    tip_washing = db.Column(db.String(50))
    stock_concentration = db.Column(db.Float)
    liquid_type = db.Column(db.String(50))
    dispense_type = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(
        db.DateTime,
        default=db.func.current_timestamp(),
        onupdate=db.func.current_timestamp(),
    )

    def serialize(self):
        return {
            "id": self.id,
            "order_index": self.order_index,
            "mastermix_id": self.mastermix_id,
            "final_source": self.final_source,
            "unit": self.unit,
            "final_concentration": self.final_concentration,
            "tip_washing": self.tip_washing,
            "stock_concentration": self.stock_concentration,
            "liquid_type": self.liquid_type,
            "dispense_type": self.dispense_type,
        }


@dataclass
class ExperimentalPlan(db.Model):
    id: str
    name_of_experimental_plan: str
    num_of_sample_concentrations: int
    num_of_technical_replicates: int
    mastermix_volume_per_reaction: int
    sample_volume_per_reaction: int
    pcr_plate_size: int
    owner_id: int

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Define columns based on the provided names
    name_of_experimental_plan = db.Column(db.String(255))
    num_of_sample_concentrations = db.Column(db.Integer)
    num_of_technical_replicates = db.Column(db.Integer)
    mastermix_volume_per_reaction = db.Column(db.Integer)
    sample_volume_per_reaction = db.Column(db.Integer)
    pcr_plate_size = db.Column(db.Integer)
    owner_id = db.Column(db.String(36), db.ForeignKey("user.id"))
    owner = db.relationship(
        "User", foreign_keys=[owner_id], backref="experimental_plans"
    )
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(
        db.DateTime,
        default=db.func.current_timestamp(),
        onupdate=db.func.current_timestamp(),
    )

    # One-to-many relationship: An ExperimentalPlan can have many MasterMix
    master_mixes = db.relationship(
        "MasterMix",
        backref="experimental_plan",
        lazy=True,
        cascade="all, delete-orphan",
    )


@dataclass
class Document(db.Model):
    id: str
    experiment_plan_id: str
    original_file_name: str
    secure_file_name: str
    s3_url: str
    content_type: str
    file_size: int
    file_hash: str
    created_at: datetime
    updated_at: datetime

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    experiment_plan_id = db.Column(
        db.String(36), db.ForeignKey("experimental_plan.id"), nullable=False
    )
    original_file_name = db.Column(db.String(255), nullable=False)
    secure_file_name = db.Column(db.String(255), nullable=False)
    s3_url = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(50))
    file_size = db.Column(db.Integer)
    file_hash = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(
        db.DateTime,
        default=db.func.current_timestamp(),
        onupdate=db.func.current_timestamp(),
    )

    # Relationship back to ExperimentalPlan
    experimental_plan = db.relationship(
        "ExperimentalPlan",
        foreign_keys=[experiment_plan_id],
        backref=db.backref("documents", lazy=True),
    )

    def serialize(self):
        """
        This method converts the Document instance into a dictionary,
        so it can be easily converted to JSON format.
        """
        return {
            "id": self.id,
            "original_file_name": self.original_file_name,
            "s3_url": self.s3_url,
            "content_type": self.content_type,
            "file_size": self.file_size,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
