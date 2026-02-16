"""UE5 editor script for assembling CityMap scene layout.

Run from Unreal Editor Python console:
    py "<project>/Scripts/setup_city_map.py"
"""

import json
import os
import unreal

PROJECT_DIR = unreal.Paths.project_dir()
DATA_PATH = os.path.join(PROJECT_DIR, "Content", "Data", "Buildings.json")
MAP_PATH = "/Game/Maps/CityMap/CityMap"


def load_buildings():
    with open(DATA_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def ensure_level_exists():
    editor_level_lib = unreal.EditorLevelLibrary
    if not unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
        tools = unreal.AssetToolsHelpers.get_asset_tools()
        level_factory = unreal.WorldFactory()
        tools.create_asset("CityMap", "/Game/Maps/CityMap", unreal.World, level_factory)
    editor_level_lib.load_level(MAP_PATH)


def spawn_ground_and_roads():
    editor = unreal.EditorLevelLibrary
    mesh = unreal.load_asset("/Engine/BasicShapes/Plane")
    material = unreal.load_asset("/Engine/BasicShapes/BasicShapeMaterial")

    ground = editor.spawn_actor_from_object(mesh, unreal.Vector(1800, 1800, -20), unreal.Rotator(0, 0, 0))
    ground.set_actor_scale3d(unreal.Vector(40, 40, 1))

    road_centers = [
        unreal.Vector(1800, 0, 0),
        unreal.Vector(1800, 1800, 0),
        unreal.Vector(1800, 3600, 0),
        unreal.Vector(0, 1800, 0),
        unreal.Vector(1800, 1800, 0),
        unreal.Vector(3600, 1800, 0),
    ]

    for idx, loc in enumerate(road_centers):
        road = editor.spawn_actor_from_object(mesh, loc, unreal.Rotator(0, 0 if idx < 3 else 90, 0))
        road.set_actor_label(f"Road_{idx+1}")
        road.set_actor_scale3d(unreal.Vector(8, 2.2, 1))
        if material:
            smc = road.get_component_by_class(unreal.StaticMeshComponent)
            smc.set_material(0, material)


def spawn_building_block(name, location, prompt_text):
    editor = unreal.EditorLevelLibrary
    mesh = unreal.load_asset("/Engine/BasicShapes/Cube")

    building = editor.spawn_actor_from_object(mesh, unreal.Vector(*location), unreal.Rotator(0, 0, 0))
    building.set_actor_label(f"B_{name.replace(' ', '_')}")
    building.set_actor_scale3d(unreal.Vector(4, 4, 10))

    # Add name sign as text render component
    text_component = unreal.TextRenderComponent(building)
    text_component.set_editor_property("text", unreal.Text(name))
    text_component.set_editor_property("horizontal_alignment", unreal.HorizTextAligment.EHTA_CENTER)
    text_component.set_editor_property("world_size", 70)
    text_component.set_editor_property("relative_location", unreal.Vector(0, 0, 600))
    building.add_instance_component(text_component)
    text_component.register_component()

    # Add interaction zone
    zone = unreal.BoxComponent(building)
    zone.set_editor_property("box_extent", unreal.Vector(200, 200, 160))
    zone.set_editor_property("relative_location", unreal.Vector(0, -260, 90))
    zone.set_editor_property("component_tags", ["EnterZone", prompt_text])
    building.add_instance_component(zone)
    zone.register_component()


def main():
    city_data = load_buildings()
    ensure_level_exists()
    spawn_ground_and_roads()

    for b in city_data["buildings"]:
        spawn_building_block(b["name"], b["location"], city_data["enter_prompt"])

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("CityMap created: third person district with 10 interactive building blocks.")


if __name__ == "__main__":
    main()
