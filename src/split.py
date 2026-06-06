import os

model_path = r"d:\Project\IoT_Project\web-dashboard\public\model\fire_model.onnx"
chunk_size = 14 * 1024 * 1024 # 14 MB chunks (under 15MB Vercel limit)

with open(model_path, "rb") as f:
    part_num = 1
    while True:
        chunk = f.read(chunk_size)
        if not chunk:
            break
        with open(f"{model_path}.part{part_num}", "wb") as out_f:
            out_f.write(chunk)
        print(f"Created part {part_num} ({len(chunk)} bytes)")
        part_num += 1

print("Done splitting!")
