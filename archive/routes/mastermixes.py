from flask import Blueprint, jsonify, request
from models.index import MasterMix, MasterMixRecipe
from db import db
from flask_jwt_extended import jwt_required

mastermixes = Blueprint("mastermixes", __name__)


@mastermixes.route("/mastermixes/<string:mastermixId>/recipes", methods=["POST"])
@jwt_required()
def add_or_update_recipes_to_mastermix(mastermixId):
    mastermix = MasterMix.query.get(mastermixId)
    if not mastermix:
        return jsonify({"error": "MasterMix not found"}), 404

    # Delete existing recipes
    MasterMixRecipe.query.filter_by(mastermix_id=mastermixId).delete()

    # Get the new recipes from the request
    recipes_data = request.get_json()

    # if recipes_data is empty array, remove all recipes and remove the mastermix
    if not recipes_data:
        db.session.delete(mastermix)
        db.session.commit()
        return jsonify({"message": "Mastermix deleted"}), 200

    if not isinstance(recipes_data, list):
        recipes_data = [recipes_data]

    # Start order_index from 1 for the new recipes
    current_order_index = 1

    processed_recipes = []
    for recipe_data in recipes_data:
        recipe = create_recipe(mastermixId, recipe_data, current_order_index)
        db.session.add(recipe)
        processed_recipes.append(recipe)
        current_order_index += 1

    # Commit the changes including the deletion of old recipes and addition of new ones
    db.session.commit()

    return jsonify([serialize_recipe(recipe) for recipe in processed_recipes]), 201


def create_recipe(mastermix_id, recipe_data, order_index):
    return MasterMixRecipe(
        mastermix_id=mastermix_id,
        final_source=recipe_data.get("finalSource"),
        unit=recipe_data.get("unit"),
        final_concentration=recipe_data.get("finalConcentration"),
        tip_washing=recipe_data.get("tipWashing"),
        stock_concentration=recipe_data.get("stockConcentration"),
        liquid_type=recipe_data.get("liquidType"),
        dispense_type=recipe_data.get("dispenseType"),
        order_index=order_index,
    )


def serialize_recipe(recipe):
    def to_camel_case(snake_str):
        components = snake_str.split("_")
        return components[0] + "".join(x.title() for x in components[1:])

    return {to_camel_case(key): value for key, value in recipe.serialize().items()}


def serialize_recipe(recipe):
    def to_camel_case(snake_str):
        components = snake_str.split("_")
        return components[0] + "".join(x.title() for x in components[1:])

    return {
        to_camel_case(key): getattr(recipe, key)
        for key in [
            "id",
            "mastermix_id",
            "final_source",
            "unit",
            "final_concentration",
            "tip_washing",
            "stock_concentration",
            "liquid_type",
            "dispense_type",
            "order_index",
        ]
    }


@mastermixes.route("/mastermixes/<string:mastermixId>", methods=["DELETE"])
@jwt_required()
def delete_mastermix(mastermixId):
    mastermix = MasterMix.query.get(mastermixId)
    if not mastermix:
        return jsonify({"error": "Mastermix not found"}), 404

    # Store the experiment ID before deleting the mastermix for reordering purpose
    experiment_id = mastermix.experimental_plan_id
    order_index_to_update = mastermix.order_index

    db.session.delete(mastermix)
    db.session.commit()

    # Reorder the remaining mastermixes
    reorder_mastermixes(experiment_id, order_index_to_update)

    return jsonify({"message": "Mastermix deleted"}), 200


def reorder_mastermixes(experimental_plan_id, deleted_order_index):
    # Fetch all remaining MasterMixes with order_index greater than the deleted one
    mastermixes_to_reorder = (
        MasterMix.query.filter(
            MasterMix.experimental_plan_id == experimental_plan_id,
            MasterMix.order_index > deleted_order_index,
        )
        .order_by(MasterMix.order_index)
        .all()
    )

    # Decrement their order_index by 1
    for mastermix in mastermixes_to_reorder:
        mastermix.order_index -= 1

    db.session.commit()
