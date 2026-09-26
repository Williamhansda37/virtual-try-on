"""
prepare_glb.py
Blender Headless Python Script for Offline 3D Asset Preparation.

Usage:
  blender --background --python assets/scripts/prepare_glb.py -- \
    --input input_mesh.obj \
    --output output_optimized.glb \
    --category eyewear \
    --target-poly 5000
"""

import sys
import argparse

try:
    import bpy
    import mathutils
    BLENDER_AVAILABLE = True
except ImportError:
    BLENDER_AVAILABLE = False


def setup_args():
    # Pass arguments after '--' to argparse
    args = []
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1:]

    parser = argparse.ArgumentParser(description="Optimize 3D models for WebGL Virtual Try-On")
    parser.add_argument("--input", required=False, default="model.obj", help="Path to source 3D model")
    parser.add_argument("--output", required=False, default="model_optimized.glb", help="Target output GLB path")
    parser.add_argument("--category", default="eyewear", choices=["eyewear", "hat", "watch", "jewelry"])
    parser.add_argument("--target-poly", type=int, default=5000, help="Target polygon count for mobile GPU efficiency")
    return parser.parse_known_args(args)[0]


def clean_scene():
    """Removes default cube, cameras, and lights from scene."""
    if not BLENDER_AVAILABLE:
        print("[Offline Prep] Blender Python API not detected. Script will run in simulation mode.")
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_model(filepath):
    if not BLENDER_AVAILABLE:
        print(f"[Offline Prep] Simulated import of {filepath}")
        return None

    if filepath.endswith(".obj"):
        bpy.ops.wm.obj_import(filepath=filepath)
    elif filepath.endswith(".gltf") or filepath.endswith(".glb"):
        bpy.ops.import_scene.gltf(filepath=filepath)
    elif filepath.endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=filepath)
    else:
        raise ValueError(f"Unsupported format: {filepath}")

    return bpy.context.selected_objects[0] if bpy.context.selected_objects else None


def optimize_mesh(obj, target_poly):
    if not BLENDER_AVAILABLE or not obj:
        print(f"[Offline Prep] Simulated decimation to {target_poly} polygons.")
        return

    # Apply decimate modifier
    current_polys = len(obj.data.polygons)
    if current_polys > target_poly:
        ratio = target_poly / float(current_polys)
        mod = obj.modifiers.new(name="Decimate_TryOn", type='DECIMATE')
        mod.ratio = ratio
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        print(f"[Offline Prep] Reduced polycount from {current_polys} to {len(obj.data.polygons)}")


def align_to_origin(obj):
    if not BLENDER_AVAILABLE or not obj:
        print("[Offline Prep] Simulated origin centering and normal calculation.")
        return

    # Set origin to geometry center
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    obj.location = (0, 0, 0)

    # Recalculate outside normals
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def export_glb(output_path):
    if not BLENDER_AVAILABLE:
        print(f"[Offline Prep] Simulated export to {output_path} with Draco compression enabled.")
        return

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_apply=True
    )
    print(f"[Offline Prep] Exported optimized model to: {output_path}")


def main():
    args = setup_args()
    print("==================================================")
    print("3D Virtual Try-On Asset Preprocessor Pipeline")
    print(f"Input: {args.input}")
    print(f"Output: {args.output}")
    print(f"Target Polygons: {args.target_poly}")
    print("==================================================")

    clean_scene()
    obj = import_model(args.input)
    if obj:
        align_to_origin(obj)
        optimize_mesh(obj, args.target_poly)
    export_glb(args.output)
    print("[Offline Prep] Asset processing complete!")


if __name__ == "__main__":
    main()
