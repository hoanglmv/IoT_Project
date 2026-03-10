# Voice AI Agent Project (ESP32-S3)

Dự án Trợ lý Ảo bằng Giọng nói sử dụng module ESP32-S3, giao tiếp âm thanh I2S và API của OpenAI.

## Tính năng chính
- Ghi âm qua Microphone I2S (INMP441)
- Lấy văn bản từ API Speech-to-Text (OpenAI Whisper)
- Lấy câu trả lời LLM từ API Chat Completions
- Phát âm thanh phản hồi qua Amply I2S (MAX98357A)

## Cấu trúc thư mục chuyên nghiệp
```text
IoT_Project/
├── src/                  # Mã nguồn chính
│   ├── main.cpp          # File thực thi chính
│   ├── audio_in/         # Module điều khiển mic
│   │   └── audio_in.cpp/.h   
│   ├── audio_out/        # Module điều khiển loa
│   │   └── audio_out.cpp/.h  
│   └── openai_client/    # Module kết nối mạng OpenAI
│       └── openai_client.cpp/.h 
├── config/               # Chứa các file cấu hình
│   └── config.example.h  # Template thông tin mạng và API keys
├── platformio.ini        # Cấu hình cho PlatformIO
├── README.md                 # Tài liệu này
└── .gitignore                # File Git ẩn các cache build và config bảo mật
```

## Hướng dẫn cài đặt

### Bước 1: Chuẩn bị thông tin cấu hình
Vào thư mục `config/`, đổi tên file `config.example.h` thành `config.h`. (File `config.h` đã được đưa vào list `.gitignore` để tránh bị lộ API key khi đẩy lên GitHub).
Sau đó vào file `config.h` thay đổi SSID WiFi, Mật khẩu, và OpenAI API Key.

### Bước 2: Setup Môi trường
Với cấu trúc thư mục mới (`src/` và `config/`), dự án được thiết kế chuyên biệt để chạy chạy trên **PlatformIO**.

#### Sử dụng PlatformIO (Khuyến nghị)
1. Cài đặt extension PlatformIO trong VSCode.
2. Mở thư mục gốc `IoT_Project` bằng VSCode.
3. PlatformIO sẽ tự động tải thư viện cần thiết dựa trên file `platformio.ini`.
4. Nhấn Build & Upload.

## Lối thiết kế phần cứng (Pinout)
- **INMP441 (Micro)**: SCK (GPIO14), WS (GPIO4), SD (GPIO1)
- **MAX98357A (Loa)**: LRC (GPIO10), BCLK (GPIO7), DIN (GPIO6)
- **Nút nhấn PTT**: Chân tin hiệu (GPIO2), nối GND
- **Đèn LED RGB**: Đỏ (GPIO13), Xanh (GPIO9), Xanh dương (GPIO8)
