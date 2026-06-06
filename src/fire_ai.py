import os
import cv2
import requests
import urllib.request
from ultralytics import YOLO
from flask import Flask, Response
from flask_cors import CORS
import threading

app = Flask(__name__)
CORS(app) # Cho phép Web Dashboard (chạy cổng 8080) lấy ảnh từ cổng 5000

# 1. Cấu hình AI
MODEL_URL = "https://huggingface.co/keremberke/yolov8m-fire-detection/resolve/main/best.pt"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE = os.path.join(SCRIPT_DIR, "fire_model.pt")

print("Đang kiểm tra mô hình AI...")
if not os.path.exists(MODEL_FILE):
    print("Chưa có mô hình. Đang cố gắng tải mô hình Fire Detection từ HuggingFace...")
    try:
        req = urllib.request.Request(MODEL_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(MODEL_FILE, 'wb') as out_file:
            out_file.write(response.read())
        print("Tải mô hình thành công!")
    except Exception as e:
        print(f"Lỗi khi tải mô hình Lửa: {e}")
        print("Máy chủ HuggingFace có thể yêu cầu đăng nhập. Hệ thống sẽ tạm dùng mô hình YOLOv8 mặc định (yolov8n.pt) để bạn test Camera!")
        print("=> ĐỂ NHẬN DIỆN LỬA THẬT: Hãy tải file best.pt từ https://github.com/MuhammadMoinFaisal/FireDetectionYOLOv8/ tree/main, lưu vào thư mục này với tên 'fire_model.pt'.")
        MODEL_FILE = os.path.join(SCRIPT_DIR, "yolov8n.pt") # Fallback sang mô hình gốc (sẽ tự tải)

print("Đang nạp mô hình YOLO...")
model = YOLO(MODEL_FILE)
cap = cv2.VideoCapture(0)

# 2. Cấu hình IoT Blynk
BLYNK_TOKEN = "j4pRYkAyzAoefb2LjHQGLJxqhBd5jbaj"
BLYNK_UPDATE_URL = f"https://blynk.cloud/external/api/update?token={BLYNK_TOKEN}&V2="

fire_in_previous_frame = False
fire_consecutive_frames = 0
safe_consecutive_frames = 0

def send_blynk_alert(is_fire):
    try:
        if is_fire:
            print("🔥 PHÁT HIỆN LỬA! Báo động lên Blynk...")
            requests.get(BLYNK_UPDATE_URL + "CÓ LỬA", timeout=3)
        else:
            print("✅ Đã an toàn. Hủy báo động...")
            requests.get(BLYNK_UPDATE_URL + "An toàn", timeout=3)
    except Exception as e:
        pass

def generate_frames():
    global fire_in_previous_frame, fire_consecutive_frames, safe_consecutive_frames
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        # Dự đoán
        results = model(frame, conf=0.45, verbose=False)
        fire_detected = False
        
        # Phân tích kết quả
        for r in results:
            for box in r.boxes:
                # Nếu dùng fire_model.pt (chỉ có lửa), hoặc dùng yolov8n.pt (class 67 là điện thoại để test)
                cls_id = int(box.cls[0])
                if box.conf[0] > 0.45:
                    if "yolov8n.pt" in MODEL_FILE and cls_id == 67: # Cell phone làm giả lập lửa
                        fire_detected = True
                    elif "yolov8n.pt" not in MODEL_FILE: # Mô hình lửa thật
                        fire_detected = True
                    
        # Cập nhật lên Blynk nếu thay đổi trạng thái (có chống nhiễu / Debounce)
        if fire_detected:
            fire_consecutive_frames += 1
            safe_consecutive_frames = 0
        else:
            safe_consecutive_frames += 1
            fire_consecutive_frames = 0

        # Phải phát hiện lửa liên tục 3 frame mới báo (tránh nhiễu)
        if fire_consecutive_frames >= 3 and not fire_in_previous_frame:
            threading.Thread(target=send_blynk_alert, args=(True,)).start()
            fire_in_previous_frame = True
            
        # Phải an toàn liên tục 15 frame mới hủy báo (tránh chớp tắt ngọn lửa)
        elif safe_consecutive_frames >= 15 and fire_in_previous_frame:
            threading.Thread(target=send_blynk_alert, args=(False,)).start()
            fire_in_previous_frame = False

        # Vẽ hình chữ nhật cảnh báo
        annotated_frame = results[0].plot()
        if fire_detected:
            cv2.putText(annotated_frame, "CANH BAO CHAY!", (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)

        # Chuyển đổi sang JPEG để stream
        ret, buffer = cv2.imencode('.jpg', annotated_frame)
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == "__main__":
    print("--- SERVER CAMERA AI ĐANG CHẠY TRÊN CỔNG 5000 ---")
    app.run(host='0.0.0.0', port=5000, debug=False)
