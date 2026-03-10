#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "config.h"
#include "audio_in.h"
#include "audio_out.h"
#include "openai_client.h"

enum SystemState {
  STATE_IDLE,
  STATE_RECORDING,
  STATE_TRANSCRIBING,
  STATE_THINKING,
  STATE_SPEAKING,
  STATE_ERROR
};

SystemState currentState = STATE_IDLE;
bool buttonPressed = false;
String lastTranscription = "";

void setLED(bool r, bool g, bool b) {
  // Common Anode LED: LOW is ON, HIGH is OFF
  digitalWrite(LED_R, r ? LOW : HIGH);
  digitalWrite(LED_G, g ? LOW : HIGH);
  digitalWrite(LED_B, b ? LOW : HIGH);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Status LED Pins
  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  setLED(false, false, false); // Turn off all LEDs

  // Button Pin
  pinMode(BTN_PIN, INPUT_PULLUP);
  
  Serial.println("\n=== ESP32-S3 Voice AI Agent ===");

  if (psramInit()) {
    Serial.printf("PSRAM initialized. Total size: %d bytes\n", ESP.getPsramSize());
  } else {
    Serial.println("ERROR: No PSRAM found! Project requires PSRAM.");
  }

  // Connect to Wi-Fi
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  setLED(true, true, false); // Yellow while initialising connection
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP Address: " + WiFi.localIP().toString());
  
  // Hardware component Init
  if (!audio_in_init()) {
    Serial.println("Failed to init audio input!");
    currentState = STATE_ERROR;
  }
  if (!audio_out_init()) {
    Serial.println("Failed to init audio output!");
    currentState = STATE_ERROR;
  }
  
  openai_client_init();

  if (currentState != STATE_ERROR) {
    currentState = STATE_IDLE;
  }
}

void loop() {
  // Audio out needs continuous execution even while idle
  audio_out_loop(); 

  // Capture Button handling (Active Low)
  bool btnState = (digitalRead(BTN_PIN) == LOW);
  
  if (btnState && !buttonPressed && currentState == STATE_IDLE) {
    buttonPressed = true;
    currentState = STATE_RECORDING;
    audio_in_start_recording();
    Serial.println(">> RECORDING STARTED");
  } else if (!btnState && buttonPressed && currentState == STATE_RECORDING) {
    buttonPressed = false;
    audio_in_stop_recording();
    currentState = STATE_TRANSCRIBING;
    Serial.println(">> RECORDING STOPPED");
  }

  // Manage State Machine
  switch (currentState) {
    case STATE_IDLE:
      setLED(false, false, true); // BLUE mode (Idle)
      break;
      
    case STATE_RECORDING:
      setLED(false, true, false); // GREEN mode (Listening)
      break;
      
    case STATE_TRANSCRIBING:
      setLED(true, true, false); // YELLOW mode (Processing)
      Serial.println("Uploading audio to Whisper API...");
      lastTranscription = openai_transcribe(audio_in_get_buffer(), audio_in_get_size());
      
      if (lastTranscription.length() > 0) {
        Serial.println("User: " + lastTranscription);
        currentState = STATE_THINKING;
      } else {
        Serial.println("Error: Speech recognition failed.");
        currentState = STATE_IDLE; // Reset to idle
      }
      break;
      
    case STATE_THINKING:
      setLED(true, false, true); // PURPLE mode (Thinking response/LLM)
      Serial.println("Sending to OpenAI Chat Completions...");
      {
        String aiResponse = openai_chat(lastTranscription);
        Serial.println("AI: " + aiResponse);
        
        if (aiResponse.length() > 0) {
          Serial.println("Converting text to speech...");
          uint8_t* mp3_buf = NULL;
          size_t mp3_size = 0;
          
          if (openai_tts(aiResponse, &mp3_buf, &mp3_size)) {
            Serial.printf("TTS API Response: %d bytes\n", mp3_size);
            if (audio_out_play_mp3(mp3_buf, mp3_size)) {
              currentState = STATE_SPEAKING;
            } else {
              // Free buffer if playback logic failed to start
              openai_free_tts_buffer();
              currentState = STATE_IDLE;
            }
          } else {
            Serial.println("Failed to get TTS audio.");
            currentState = STATE_IDLE;
          }
        } else {
          currentState = STATE_IDLE;
        }
      }
      break;
      
    case STATE_SPEAKING:
      setLED(true, true, true); // WHITE mode (Speaking)
      if (!audio_out_is_playing()) {
        Serial.println(">> SPEAKING FINISHED");
        openai_free_tts_buffer();
        currentState = STATE_IDLE;
      }
      break;
      
    case STATE_ERROR:
      setLED(true, false, false); // RED (System Error)
      delay(500);
      setLED(false, false, false);
      delay(500);
      break;
  }
}
