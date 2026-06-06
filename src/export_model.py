import os
from ultralytics import YOLO

script_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(script_dir, "fire_model.pt")

print(f"Loading model {model_path}...")
model = YOLO(model_path)

print(f"Model classes: {model.names}")

print("Exporting to ONNX...")
model.export(format="onnx", imgsz=640)
print("Export complete.")
