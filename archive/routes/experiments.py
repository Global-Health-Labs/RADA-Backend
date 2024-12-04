from flask import Blueprint, jsonify, request
from models.index import ExperimentalPlan, MasterMix, User
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import db
from models.index import Role

experiments = Blueprint("experiments", __name__)


@experiments.route("/experiments", methods=["GET"])
@jwt_required()
def get_experiments():
    # get current user from jwt
    current_user = get_jwt_identity()
    experiments = []

    # find user in database
    user = User.query.filter_by(id=current_user["id"]).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    role = Role.query.get(user.role_id)

    if not role:
        return jsonify({"error": "Role not found"}), 404

    # if user is admin or supervisor, return all experiments
    if role.name in ["admin", "supervisor"]:
        experiments = ExperimentalPlan.query.order_by(ExperimentalPlan.created_at).all()
    else:
        experiments = (
            ExperimentalPlan.query.filter_by(owner_id=user.id)
            .order_by(ExperimentalPlan.created_at)
            .all()
        )

    experiments_data = []
    for experiment in experiments:
        owner_user = User.query.filter_by(id=experiment.owner_id).first()

        if owner_user:
            owner_full_name = owner_user.fullname
        else:
            owner_full_name = "Owner not found"

        experiment_data = {
            "id": experiment.id,
            "nameOfExperimentalPlan": experiment.name_of_experimental_plan,
            "numOfSampleConcentrations": experiment.num_of_sample_concentrations,
            "numOfTechnicalReplicates": experiment.num_of_technical_replicates,
            "mastermixVolumePerReaction": experiment.mastermix_volume_per_reaction,
            "sampleVolumePerReaction": experiment.sample_volume_per_reaction,
            "pcrPlateSize": experiment.pcr_plate_size,
            "masterMixes": [],
            "ownerFullName": owner_full_name,
            "createdAt": experiment.created_at,
            "updatedAt": experiment.updated_at,
        }

        # Sort master mixes by created_at
        sorted_mastermixes = sorted(
            experiment.master_mixes, key=lambda mm: mm.order_index
        )

        for mastermix in sorted_mastermixes:
            mastermix_data = {
                "id": mastermix.id,
                "orderIndex": mastermix.order_index,
                "nameOfMasterMix": mastermix.name_of_mastermix,
                "recipes": [],
            }

            # Sort recipes by created_at
            sorted_recipes = sorted(mastermix.recipes, key=lambda r: r.order_index)

            for recipe in sorted_recipes:
                recipe_data = {
                    "id": recipe.id,
                    "orderIndex": recipe.order_index,
                    "finalSource": recipe.final_source,
                    "unit": recipe.unit,
                    "finalConcentration": recipe.final_concentration,
                    "tipWashing": recipe.tip_washing,
                    "stockConcentration": recipe.stock_concentration,
                    "liquidType": recipe.liquid_type,
                    "dispenseType": recipe.dispense_type,
                }
                mastermix_data["recipes"].append(recipe_data)

            experiment_data["masterMixes"].append(mastermix_data)

        experiments_data.append(experiment_data)

    return jsonify(experiments_data)


@experiments.route("/experiments/<string:experiment_id>", methods=["GET"])
@jwt_required()
def get_experiment(experiment_id):
    # Query for the specific experiment by its ID
    experiment = ExperimentalPlan.query.get(experiment_id)
    if not experiment:
        return jsonify({"error": "Experiment not found"}), 404

    experiment_data = {
        "id": experiment.id,
        "nameOfExperimentalPlan": experiment.name_of_experimental_plan,
        "numOfSampleConcentrations": experiment.num_of_sample_concentrations,
        "numOfTechnicalReplicates": experiment.num_of_technical_replicates,
        "mastermixVolumePerReaction": experiment.mastermix_volume_per_reaction,
        "sampleVolumePerReaction": experiment.sample_volume_per_reaction,
        "pcrPlateSize": experiment.pcr_plate_size,
        "masterMixes": [],
    }

    sorted_mastermixes = sorted(experiment.master_mixes, key=lambda mm: mm.order_index)

    for mastermix in sorted_mastermixes:
        mastermix_data = {
            "id": mastermix.id,
            "nameOfMasterMix": mastermix.name_of_mastermix,
            "orderIndex": mastermix.order_index,
            "recipes": [],
        }

        sorted_recipes = sorted(mastermix.recipes, key=lambda r: r.order_index)

        for recipe in sorted_recipes:
            recipe_data = {
                "id": recipe.id,
                "orderIndex": recipe.order_index,
                "finalSource": recipe.final_source,
                "unit": recipe.unit,
                "finalConcentration": recipe.final_concentration,
                "tipWashing": recipe.tip_washing,
                "stockConcentration": recipe.stock_concentration,
                "liquidType": recipe.liquid_type,
                "dispenseType": recipe.dispense_type,
            }
            mastermix_data["recipes"].append(recipe_data)

        experiment_data["masterMixes"].append(mastermix_data)

    return jsonify(experiment_data)


@experiments.route("/experiments", methods=["POST"])
@jwt_required()
def new_experiment():
    try:
        data = request.get_json()
        print("data: ", data)

        # get current user from jwt
        current_user = get_jwt_identity()

        print("current user: ", current_user)

        # create new experiment
        new_experiment = ExperimentalPlan(
            name_of_experimental_plan=data["nameOfExperimentalPlan"],
            num_of_sample_concentrations=data["numOfSampleConcentrations"],
            num_of_technical_replicates=data["numOfTechnicalReplicates"],
            mastermix_volume_per_reaction=data["mastermixVolumePerReaction"],
            sample_volume_per_reaction=data["sampleVolumePerReaction"],
            pcr_plate_size=data["pcrPlateSize"],
            owner_id=current_user["id"],
        )

        db.session.add(new_experiment)
        db.session.commit()

        # return new experiment
        return jsonify(new_experiment), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@experiments.route("/experiments/<string:experimentId>/mastermixes", methods=["POST"])
@jwt_required()
def add_mastermix(experimentId):
    # Fetch the experiment using the provided ID
    experiment = ExperimentalPlan.query.get(experimentId)
    if not experiment:
        return jsonify({"error": "Experiment not found"}), 404

    # Get the request data
    data = request.get_json()

    # Determine the next order index for the new MasterMix
    max_order_index = (
        db.session.query(db.func.max(MasterMix.order_index))
        .filter_by(experimental_plan_id=experimentId)
        .scalar()
    )
    next_order_index = 1 if max_order_index is None else max_order_index + 1

    # Create the new MasterMix with the calculated order index
    new_mastermix = MasterMix(
        name_of_mastermix=data["nameOfMasterMix"],
        experimental_plan_id=experimentId,
        order_index=next_order_index,
    )

    # Add the new MasterMix to the session and commit
    db.session.add(new_mastermix)
    db.session.commit()

    # Serialize the new MasterMix to return as a response
    response_data = {
        "id": new_mastermix.id,
        "name_of_mastermix": new_mastermix.name_of_mastermix,
        "experimental_plan_id": new_mastermix.experimental_plan_id,
        "order_index": new_mastermix.order_index,
        "created_at": new_mastermix.created_at.isoformat(),
        "updated_at": new_mastermix.updated_at.isoformat(),
    }

    return jsonify(response_data), 201


@experiments.route("/experiments/<string:experiment_id>", methods=["PATCH"])
@jwt_required()
def update_experiment(experiment_id):
    # Query for the specific experiment by its ID
    experiment = ExperimentalPlan.query.get(experiment_id)
    if not experiment:
        return jsonify({"error": "Experiment not found"}), 404

    data = request.get_json()
    print("data: ", data)

    # Update experiment fields if provided
    if "nameOfExperimentalPlan" in data:
        experiment.name_of_experimental_plan = data["nameOfExperimentalPlan"]
    if "numOfSampleConcentrations" in data:
        experiment.num_of_sample_concentrations = data["numOfSampleConcentrations"]
    if "numOfTechnicalReplicates" in data:
        experiment.num_of_technical_replicates = data["numOfTechnicalReplicates"]
    if "mastermixVolumePerReaction" in data:
        experiment.mastermix_volume_per_reaction = data["mastermixVolumePerReaction"]
    if "sampleVolumePerReaction" in data:
        experiment.sample_volume_per_reaction = data["sampleVolumePerReaction"]
    if "pcrPlateSize" in data:
        experiment.pcr_plate_size = data["pcrPlateSize"]

    print("experiment: ", experiment)

    db.session.commit()

    # Serialize updated experiment for response
    updated_experiment = {
        "id": experiment.id,
        "nameOfExperimentalPlan": experiment.name_of_experimental_plan,
        "numOfSampleConcentrations": experiment.num_of_sample_concentrations,
        "numOfTechnicalReplicates": experiment.num_of_technical_replicates,
        "mastermixVolumePerReaction": experiment.mastermix_volume_per_reaction,
        "sampleVolumePerReaction": experiment.sample_volume_per_reaction,
        "pcrPlateSize": experiment.pcr_plate_size,
    }

    return jsonify(updated_experiment), 200


@experiments.route("/experiments/<string:mastermix_id>/mastermixes", methods=["PATCH"])
@jwt_required()
def update_mastermix(mastermix_id):
    # Query for the specific experiment by its ID
    mastermix = MasterMix.query.get(mastermix_id)
    if not mastermix:
        return jsonify({"error": "MasterMix not found"}), 404

    data = request.get_json()

    # Update experiment fields if provided
    if "nameOfMasterMix" in data:
        mastermix.name_of_mastermix = data["nameOfMasterMix"]

    db.session.commit()

    # Serialize updated experiment for response
    updated_mastermix = {
        "id": mastermix.id,
        "nameOfMasterMix": mastermix.name_of_mastermix,
        "experimentalPlanId": mastermix.experimental_plan_id,
    }

    return jsonify(updated_mastermix), 200
