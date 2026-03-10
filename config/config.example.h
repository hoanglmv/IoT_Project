#ifndef CONFIG_H
#define CONFIG_H

// ==========================================
// WiFi Configuration
// ==========================================
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// ==========================================
// OpenAI API Configuration
// ==========================================
#define OPENAI_API_KEY  "sk-proj-YOUR_OPENAI_API_KEY_HERE"

// ==========================================
// Audio Sampling Parameters
// ==========================================
#define SAMPLE_RATE     16000
#define NUM_CHANNELS    1
#define BITS_PER_SAMPLE 16

// Maximum recording time in seconds
// Requires PSRAM (Example: 10s * 16000Hz * 2bytes = 320KB)
#define MAX_RECORDING_TIME 10 

// ==========================================
// Hardware Pinout (ESP32-S3)
// ==========================================

// I2S Microphone (INMP441)
#define I2S_MIC_SCK     14
#define I2S_MIC_WS      4
#define I2S_MIC_SD      1

// I2S Amplifier (MAX98357A)
#define I2S_SPK_LRC     10
#define I2S_SPK_BCLK    7
#define I2S_SPK_DIN     6

// UI Elements
// Common Anode LED (LOW = ON, HIGH = OFF)
#define LED_R           13
#define LED_G           9
#define LED_B           8

// Push Button (Active LOW)
#define BTN_PIN         2

#endif // CONFIG_H
