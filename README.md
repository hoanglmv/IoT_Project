# Voice AI Agent Project (ESP32-S3)

Dự án Trợ lý Ảo bằng Giọng nói sử dụng module ESP32-S3, giao tiếp âm thanh I2S và API của OpenAI.

## Tính năng chính
- Ghi âm qua Microphone I2S (INMP441)
- Lấy văn bản từ API Speech-to-Text (OpenAI Whisper)
- Lấy câu trả lời LLM từ API Chat Completions
- Phát âm thanh phản hồi qua Amply I2S (MAX98357A)

## Cấu trúc Hệ thống
```text
IoT_Project/
├── src/                  # Mã nguồn ESP32 (C++)
├── config/               # Cấu hình chứa IP Server và Mạng cho ESP32
├── backend/              # Node.js Express Server (Nhận Âm thanh -> Gọi OpenAI -> Trả MP3)
│   ├── server.js         
│   ├── db.js             # SQLite3 xử lý lịch sử Chat
│   └── .env.example      # Nơi nhập OPENAI_API_KEY
├── frontend/             # React Dashboard (Theo dõi lịch sử và cấu hình Agent)
│   └── src/App.js        
├── platformio.ini        
└── README.md                 
```

## Hướng dẫn Vận hành toàn hệ thống

### 1. Khởi động Web Backend (Node.js)
Backend đóng vai trò làm Proxy ẩn API Key và ghi log lịch sử hội thoại lên Database.
1. Mở Terminal, di chuyển vào thư mục `backend/`
2. Đổi tên `backend/.env.example` thành `.env`, mở lên và điền `OPENAI_API_KEY` của bạn.
3. Chạy `npm install` để tải gói phụ thuộc.
4. Chạy `npm start`. (Server sẽ khởi động ở cổng `3000`).
5. **Quan trọng:** Tìm địa chỉ IP máy tính trong mạng Local (ví dụ: `192.168.1.100`), IP này cần được nạp vào khai báo cấu hình ESP32.

### 2. Khởi động Web Frontend (React Dashboard)
1. Mở Terminal khác, chuyển vào thư mục `frontend/`
2. Chạy `npm install`
3. Chạy `npm start`
4. Truy cập `http://localhost:3001` trên trình duyệt để mở bảng Dashboard quản lý Voice AI theo thời gian thực.
5. *(Khuyên dùng)*: Mở icon Settings góc trên phải để nhập *System Prompt* (Định hình tính cách cho trợ lý).

### 3. Cập nhật và Nạp Firmware lên ESP32
1. Vào thư mục `config/`, đổi tên `config.example.h` thành `config.h`. 
2. Thay đổi thông tin mạng WiFi. Tại mục `BACKEND_IP`, **thay thế bằng địa chỉ IP máy tính** của bạn (đã lấy ở bước 1).
3. Mở mã nguồn `IoT_Project` bằng **PlatformIO** (VSCode).
4. Nhấn Build & Upload để nạp Firmware mới xuống module.

## Lối thiết kế phần cứng (Pinout)
- **INMP441 (Micro)**: SCK (GPIO14), WS (GPIO4), SD (GPIO1)
- **MAX98357A (Loa)**: LRC (GPIO10), BCLK (GPIO7), DIN (GPIO6)
- **Nút nhấn PTT**: Chân tin hiệu (GPIO2), nối GND
- **Đèn LED RGB**: Đỏ (GPIO13), Xanh (GPIO9), Xanh dương (GPIO8)
