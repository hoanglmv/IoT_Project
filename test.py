import time
import network
import urequests as requests
from machine import I2S, Pin, reset
import gc

# Thông tin WiFi
WIFI_SSID = "Phòng 1001_5G"
WIFI_PASSWORD = "Qhp10133"

# Thông tin OpenAI API
OPENAI_API_KEY = "your-openai-api-key-here"  # TODO: set this before running, do NOT commit real keys
OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions"

# Mạch ESP32-S3 sử dụng các chân GPIO cho I2S
WS_PIN = 4
SCK_PIN = 5
SD_PIN = 6

# Chân BOOT trên ESP32-S3 (thường là GPIO 0)
BOOT_PIN = 0

# Biến trạng thái
is_recording = False
audio_data = bytearray()

# Hàm kết nối WiFi
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print("Đang kết nối WiFi...")
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        while not wlan.isconnected():
            pass
    print("Đã kết nối WiFi:", wlan.ifconfig())

# Hàm gửi âm thanh đến OpenAI
def send_to_openai(audio_bytes):
    print("Đang gửi âm thanh đến OpenAI...")
    # Tạo header
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "audio/wav"  # Sử dụng định dạng wav để dễ xử lý ngầm định
    }
    
    # Tạo file wav header (giả sử 16kHz, 1 channel, 16 bit PCM)
    # Đây là cách tạo header wav tối giản để Whisper có thể nhận dạng
    sample_rate = 16000
    byte_rate = sample_rate * 2  # 1 channel, 16 bits (2 bytes)
    data_size = len(audio_bytes)
    chunk_size = 36 + data_size
    
    wav_header = bytearray([
        0x52, 0x49, 0x46, 0x46,  # "RIFF"
        chunk_size & 0xFF, (chunk_size >> 8) & 0xFF, (chunk_size >> 16) & 0xFF, (chunk_size >> 24) & 0xFF,
        0x57, 0x41, 0x56, 0x45,  # "WAVE"
        0x66, 0x6D, 0x74, 0x20,  # "fmt "
        16, 0, 0, 0,             # Subchunk1Size (16 for PCM)
        1, 0,                    # AudioFormat (1 for PCM)
        1, 0,                    # NumChannels (1 mono)
        sample_rate & 0xFF, (sample_rate >> 8) & 0xFF, (sample_rate >> 16) & 0xFF, (sample_rate >> 24) & 0xFF,
        byte_rate & 0xFF, (byte_rate >> 8) & 0xFF, (byte_rate >> 16) & 0xFF, (byte_rate >> 24) & 0xFF,
        2, 0,                    # BlockAlign (2 bytes for 16-bit mono)
        16, 0,                   # BitsPerSample (16 bits)
        0x64, 0x61, 0x74, 0x61,  # "data"
        data_size & 0xFF, (data_size >> 8) & 0xFF, (data_size >> 16) & 0xFF, (data_size >> 24) & 0xFF
    ])
    
    # Ghép header với dữ liệu âm thanh
    payload = wav_header + audio_bytes
    
    # Thực hiện request với multipart/form-data
    # Do urequests không hỗ trợ multipart/form-data tốt, ta cần tự build payload
    # Tuy nhiên, OpenAI cho phép gửi trực tiếp file âm thanh nếu Content-Type là audio/wav
    try:
        response = requests.post(
            OPENAI_URL,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            # API Whisper cần được cấu trúc multipart, nhưng để đơn giản trên MCU
            # ta dùng cơ chế parse raw binary với parameter model trong header nếu hỗ trợ,
            # hoặc phải build multipart payload. Dưới đây là cách build multipart:
            data=build_multipart("whisper-1", payload) 
            # (Hàm build_multipart sẽ được định nghĩa bên dưới)
        )
        print("Phản hồi từ OpenAI:", response.text)
        response.close()
    except Exception as e:
        print("Lỗi khi gửi đến OpenAI:", e)

def build_multipart(model_name, file_data):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    
    # Phần model
    body = f"--{boundary}\r\n"
    body += f"Content-Disposition: form-data; name=\"model\"\r\n\r\n"
    body += f"{model_name}\r\n"
    
    # Phần file
    body += f"--{boundary}\r\n"
    body += f"Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n"
    body += f"Content-Type: audio/wav\r\n\r\n"
    
    # Chuyển string thành bytes và nối với dữ liệu file
    body_bytes = body.encode('utf-8') + file_data
    
    # Kết thúc
    end_boundary = f"\r\n--{boundary}--\r\n"
    body_bytes += end_boundary.encode('utf-8')
    
    # Để gửi multipart chuẩn xác, ta cần cập nhật header Content-Type ở request post
    # Thay vì pass trực tiếp vào headers của request.post ở trên, ta sẽ override nó
    global _multipart_headers
    _multipart_headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": f"multipart/form-data; boundary={boundary}"
    }
    return body_bytes

# Ghi đè hàm send_to_openai để dùng đúng header
def send_to_openai(audio_bytes):
    print("Đang gửi âm thanh đến OpenAI...")
    
    # ... (phần tạo wav header giữ nguyên) ...
    sample_rate = 16000
    byte_rate = sample_rate * 2
    data_size = len(audio_bytes)
    chunk_size = 36 + data_size
    
    wav_header = bytearray([
        0x52, 0x49, 0x46, 0x46, chunk_size & 0xFF, (chunk_size >> 8) & 0xFF, (chunk_size >> 16) & 0xFF, (chunk_size >> 24) & 0xFF,
        0x57, 0x41, 0x56, 0x45, 0x66, 0x6D, 0x74, 0x20, 16, 0, 0, 0, 1, 0, 1, 0,
        sample_rate & 0xFF, (sample_rate >> 8) & 0xFF, (sample_rate >> 16) & 0xFF, (sample_rate >> 24) & 0xFF,
        byte_rate & 0xFF, (byte_rate >> 8) & 0xFF, (byte_rate >> 16) & 0xFF, (byte_rate >> 24) & 0xFF,
        2, 0, 16, 0, 0x64, 0x61, 0x74, 0x61, data_size & 0xFF, (data_size >> 8) & 0xFF, (data_size >> 16) & 0xFF, (data_size >> 24) & 0xFF
    ])
    
    payload = wav_header + audio_bytes
    multipart_data = build_multipart("whisper-1", payload)
    
    try:
        response = requests.post(OPENAI_URL, headers=_multipart_headers, data=multipart_data)
        print("Phản hồi từ OpenAI:", response.text)
        response.close()
    except Exception as e:
        print("Lỗi:", e)


# Khởi tạo I2S
audio_in = I2S(
    0,
    sck=Pin(SCK_PIN),
    ws=Pin(WS_PIN),
    sd=Pin(SD_PIN),
    mode=I2S.RX,
    bits=32,
    format=I2S.MONO,
    rate=16000,
    ibuf=20000
)

# Khởi tạo nút BOOT
boot_button = Pin(BOOT_PIN, Pin.IN, Pin.PULL_UP)

# Xử lý ngắt (Interrupt) cho nút BOOT
def handle_boot_press(pin):
    global is_recording
    # Chống dội phím (debounce) bằng cách delay nhẹ
    time.sleep_ms(50)
    if pin.value() == 0:  # Nút được nhấn
        is_recording = not is_recording
        print("Trạng thái thu âm:", "BẤT ĐẦU" if is_recording else "KẾT THÚC")

boot_button.irq(trigger=Pin.IRQ_FALLING, handler=handle_boot_press)

# Kết nối mạng
# connect_wifi() # Bỏ comment khi bạn đã điền thông tin WiFi

print("Hệ thống sẵn sàng. Nhấn nút BOOT để bắt đầu/kết thúc thu âm.")

# Buffer trung gian để đọc âm thanh
buffer_size = 1024
temp_buffer = bytearray(buffer_size)

# Chuyển đổi 24-bit PCM (padding 32-bit) sang 16-bit PCM (bỏ qua 8 bit padding và 8 bit LSB)
# (INMP441 trả về dữ liệu 24-bit độ phân giải cao, để OpenAI nhận dễ dàng ta cover về 16-bit)
def convert_32_to_16(buf_32, bytes_read):
    buf_16 = bytearray(bytes_read // 2)
    for i in range(0, bytes_read, 4):
        # Lấy 16 bit chứa thông tin hữu ích nhất (Byte 2 và 3 trong chuỗi 4 byte)
        # Tùy thuộc vào endianness mà vị trí có thể khác nhau (thường mbedtls/esp-idf dùng little-endian)
        buf_16[i//2] = buf_32[i+2]
        buf_16[i//2 + 1] = buf_32[i+3]
    return buf_16

try:
    while True:
        if is_recording:
            num_bytes_read = audio_in.readinto(temp_buffer)
            if num_bytes_read > 0:
                # Chuyển đổi qua 16-bit PCM và thêm vào mảng chứa dữ liệu tổng
                audio_16bit = convert_32_to_16(temp_buffer, num_bytes_read)
                audio_data.extend(audio_16bit)
                
                # Để tránh tràn RAM (ESP32-S3 thường có vài trăm KB SRAM trống)
                # Dừng nếu thu âm quá dài (Vd: hơn 150KB ~ 5 giây 16kHz 16bit mono)
                if len(audio_data) > 150000:
                    print("Cảnh báo: Đã đạt giới hạn RAM bộ đệm âm thanh!")
                    is_recording = False
                    
        else:
            # Nếu vừa kết thúc thu âm và có dữ liệu
            if len(audio_data) > 0:
                print(f"Hoàn tất thu âm. Kích thước {len(audio_data)} bytes. Bắt đầu gửi...")
                # Nếu đã cấu hình WiFi và API Key thì gọi gửi OpenAI
                # send_to_openai(audio_data)
                
                # Giải phóng RAM
                audio_data = bytearray()
                gc.collect()
                print("Đã làm sạch RAM, sẵn sàng lần thu tiếp theo.")
                
        time.sleep_ms(10)
        
except KeyboardInterrupt:
    print("Thoát chương trình.")
finally:
    audio_in.deinit()
