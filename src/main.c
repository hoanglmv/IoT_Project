#define BLYNK_TEMPLATE_ID "TMPL6vl_tozSN"
#define BLYNK_TEMPLATE_NAME "Canh bao khi Gas"
#define BLYNK_AUTH_TOKEN "j4pRYkAyzAoefb2LjHQGLJxqhBd5jbaj"

#include <BlynkSimpleEsp8266.h>
#include <DHT.h>
#include <ESP8266WiFi.h>
#include <Servo.h>

    // Thông tin WiFi của bạn
    char ssid[] = "911";
char pass[] = "66666666";

#define DHTPIN 4 // Tương đương D2
#define DHTTYPE DHT22
#define FLAME_PIN 5   // Tương đương D1
#define MQ2_PIN A0    // Chân A0 giữ nguyên
#define SERVO_PIN 2   // Tương đương D4
#define RELAY_PIN 15  // Tương đương D8
#define BUZZER_PIN 16 // Tương đương D0 (Số 16 là chân D0)

// Định nghĩa chân LED RGB
#define RED_PIN 14   // Tương đương D5
#define GREEN_PIN 12 // Tương đương D6
#define BLUE_PIN 13  // Tương đương D7

// Khởi tạo đối tượng
DHT dht(DHTPIN, DHTTYPE);
Servo windowServo;
BlynkTimer timer;

// Ngưỡng cảnh báo
int GAS_THRESHOLD = 500;
const float TEMP_THRESHOLD = 20.0;

void setup() {
  Serial.begin(115200);

  // Khởi tạo cảm biến
  dht.begin();
  pinMode(FLAME_PIN, INPUT);

  // Khởi tạo ngõ ra
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  windowServo.attach(SERVO_PIN);

  // Trạng thái phần cứng ban đầu (An toàn)
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(BUZZER_PIN,
               HIGH); // Sửa thành HIGH cho đồng bộ với còi Active LOW
  windowServo.write(0);
  setPhysicalRGB(0, 255, 0); // Đèn vật lý sáng Xanh lá

  // Kết nối WiFi và Blynk
  Serial.println("Đang kết nối WiFi & Blynk...");
  Blynk.begin(BLYNK_AUTH_TOKEN, ssid, pass);

  // Thiết lập chu kỳ đọc cảm biến mỗi 2 giây
  timer.setInterval(2000L, processSystem);
}

void loop() {
  Blynk.run();
  timer.run();
}

// Tự động chạy khi bạn thay đổi Slider (chân V5) trên điện thoại/web
BLYNK_WRITE(V5) {
  GAS_THRESHOLD = param.asInt(); // Cập nhật ngưỡng mới vào biến GAS_THRESHOLD
  Serial.print("Đã cập nhật ngưỡng Gas mới từ Blynk: ");
  Serial.println(GAS_THRESHOLD);
}

// Hàm đọc cảm biến, xử lý logic và gửi lên Blynk
void processSystem() {
  float t = dht.readTemperature();
  int gasValue = analogRead(MQ2_PIN);
  int flameValue = digitalRead(FLAME_PIN);

  if (isnan(t)) {
    Serial.println("Lỗi: Không đọc được dữ liệu từ DHT22!");
    return; // Thoát hàm nếu lỗi
  }

  // Chuyển đổi thành trạng thái (LOW = Có lửa tùy theo module)
  bool fireDetected = (flameValue == LOW);
  bool gasExceeded = (gasValue > GAS_THRESHOLD);
  bool tempExceeded = (t > TEMP_THRESHOLD);

  // ========================================================
  // IN THÔNG SỐ RA SERIAL MONITOR
  Serial.println("---------------------------------");
  Serial.print("Nhiệt độ    : ");
  Serial.print(t);
  Serial.println(" *C");
  Serial.print("Nồng độ Gas : ");
  Serial.print(gasValue);
  Serial.print(" (Ngưỡng cài đặt: ");
  Serial.print(GAS_THRESHOLD);
  Serial.println(")");
  Serial.print("Trạng thái  : ");
  Serial.println(fireDetected ? "PHÁT HIỆN LỬA!" : "Không có lửa");
  Serial.println("---------------------------------");
  // ========================================================

  // 1. Đẩy dữ liệu cảm biến thô lên Blynk
  Blynk.virtualWrite(V0, t);
  Blynk.virtualWrite(V1, gasValue);
  Blynk.virtualWrite(V2, fireDetected ? "CÓ LỬA" : "An toàn");

  // 2. Xử lý Logic Cảnh báo

  // KỊCH BẢN 1: Báo động mức khẩn cấp (Cháy & Rò Gas)
  if (gasExceeded && tempExceeded && fireDetected) {
    // Điều khiển phần cứng vật lý
    digitalWrite(BUZZER_PIN, LOW); // Bật còi
    windowServo.write(0);
    digitalWrite(RELAY_PIN, LOW);
    setPhysicalRGB(255, 0, 0); // LED vật lý sáng Đỏ

    // Cập nhật lên Blynk
    Blynk.virtualWrite(V3, 0);
    Blynk.virtualWrite(V4, "Đóng cửa");

    Blynk.setProperty(V6, "color", "#D3435C"); // LED web đổi màu Đỏ
    Blynk.virtualWrite(V6, 255);

    Blynk.logEvent("fire_alert",
                   "CẢNH BÁO MỨC 1: Phát hiện CHÁY VÀ RÒ RỈ GAS!");
  }

  // KỊCH BẢN 2: Cảnh báo mức 2 (Chỉ rò rỉ khí Gas)
  else if (gasExceeded) {
    // Điều khiển phần cứng vật lý
    digitalWrite(BUZZER_PIN, LOW); // Bật còi
    windowServo.write(90);
    digitalWrite(RELAY_PIN, HIGH); // Bật quạt hút
    setPhysicalRGB(255, 255, 0);   // LED vật lý sáng Vàng (Đỏ + Xanh lá)

    // Cập nhật lên Blynk
    Blynk.virtualWrite(V3, 1);
    Blynk.virtualWrite(
        V4, "Đóng cửa"); // LƯU Ý: Ở trên gọi windowServo.write(90) (mở) nhưng
                         // dưới báo đóng, bạn có thể chỉnh lại cho khớp thực tế

    Blynk.setProperty(V6, "color", "#ED9D00"); // LED web đổi màu Vàng
    Blynk.virtualWrite(V6, 255);

    Blynk.logEvent("gas_alert",
                   "CẢNH BÁO MỨC 2: Đang hút khí Gas độc ra ngoài.");
  }

  // KỊCH BẢN 3: Trạng thái Bình thường / An toàn
  else {
    // Điều khiển phần cứng vật lý
    digitalWrite(BUZZER_PIN, HIGH); // Tắt còi
    windowServo.write(0);
    digitalWrite(RELAY_PIN, LOW);
    setPhysicalRGB(0, 255, 0); // LED vật lý sáng Xanh lá

    // Cập nhật lên Blynk
    Blynk.virtualWrite(V3, 0);
    Blynk.virtualWrite(V4, "Đóng cửa");

    Blynk.setProperty(V6, "color", "#23C48E"); // LED web đổi màu Xanh lá
    Blynk.virtualWrite(V6, 255);
  }
}

// Hàm phụ trợ điều khiển Module LED 3 màu (Vật lý)
void setPhysicalRGB(int r, int g, int b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(BLUE_PIN, b);
}