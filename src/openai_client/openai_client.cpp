#include "openai_client.h"
#include "config.h"

// Requires standard libraries and ArduinoJson
// Ensure "ArduinoJson" is installed via Library Manager
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

static WiFiClient *client = NULL;
static uint8_t* tts_buffer = NULL;

void openai_client_init() {
  client = new WiFiClient();
}

// Helper to construct WAV header for the PCM raw data payload
void create_wav_header(uint8_t* header, uint32_t dataSize) {
  uint32_t fileSize = dataSize + 36;
  uint32_t sampleRate = SAMPLE_RATE;
  uint16_t numChannels = NUM_CHANNELS;
  uint16_t bitsPerSample = BITS_PER_SAMPLE;
  uint32_t byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  uint16_t blockAlign = numChannels * (bitsPerSample / 8);

  header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
  memcpy(header + 4, &fileSize, 4);
  header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
  header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
  uint32_t fmtSize = 16;
  memcpy(header + 16, &fmtSize, 4);
  uint16_t audioFormat = 1; // PCM
  memcpy(header + 20, &audioFormat, 2);
  memcpy(header + 22, &numChannels, 2);
  memcpy(header + 24, &sampleRate, 4);
  memcpy(header + 28, &byteRate, 4);
  memcpy(header + 32, &blockAlign, 2);
  memcpy(header + 34, &bitsPerSample, 2);
  header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
  memcpy(header + 40, &dataSize, 4);
}

String openai_transcribe(const uint8_t* audio_pcm, size_t length) {
  if (audio_pcm == NULL || length == 0) return "";
  if (client == NULL) openai_client_init();
  
  String url = "http://" + String(BACKEND_IP) + ":" + String(BACKEND_PORT) + "/api/stt";
  String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  
  String head = "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"audio\"; filename=\"audio.wav\"\r\n";
  head += "Content-Type: audio/wav\r\n\r\n";
  
  String tail = "\r\n--" + boundary + "--\r\n";
  
  uint8_t wav_header[44];
  create_wav_header(wav_header, length);
  
  uint32_t totalLength = head.length() + 44 + length + tail.length();
  
  if (!client->connect(BACKEND_IP, String(BACKEND_PORT).toInt())) {
    Serial.println("Connection to Local Backend failed!");
    return "";
  }
  
  client->print("POST /api/stt HTTP/1.1\r\n");
  client->print("Host: " + String(BACKEND_IP) + "\r\n");
  client->print("Content-Type: multipart/form-data; boundary=" + boundary + "\r\n");
  client->print("Content-Length: " + String(totalLength) + "\r\n\r\n");
  
  // Write HTTP Body
  client->print(head);
  client->write(wav_header, 44);
  
  // Stream raw audio data
  size_t bytes_written = 0;
  while (bytes_written < length) {
    size_t chunk = length - bytes_written > 2048 ? 2048 : length - bytes_written;
    client->write(audio_pcm + bytes_written, chunk);
    bytes_written += chunk;
  }
  
  client->print(tail);
  
  // Await response
  while (client->connected() && !client->available()) {
    delay(10);
  }
  
  String response = "";
  bool isBody = false;
  int openBraceCount = 0;
  
  // Read and extract valid JSON payload from HTTP response body
  while (client->available()) {
    String line = client->readStringUntil('\n');
    if (line == "\r" && !isBody) {
      isBody = true;
    } else if (isBody) {
      response += line + "\n";
    }
  }
  client->stop();

  if (response.length() == 0) return "";
  
  // Skip leading chunk sizes if chunked transfer occurs
  int jsonStart = response.indexOf('{');
  if (jsonStart >= 0) {
    response = response.substring(jsonStart);
  }
  
  DynamicJsonDocument doc(2048);
  DeserializationError err = deserializeJson(doc, response);
  if (err) {
    Serial.print("Deserialize failed: ");
    Serial.println(err.c_str());
    Serial.println(response);
    return "";
  }
  return doc["text"].as<String>();
}

String openai_chat(String userInput) {
  // Now handled by Backend during TTS endpoint to save trips
  return "Backend processing...";
}

bool openai_tts(String text, uint8_t** out_mp3_buffer, size_t* out_size) {
  if (client == NULL) openai_client_init();
  
  if (tts_buffer != NULL) {
    openai_free_tts_buffer();
  }

  HTTPClient http;
  String url = "http://" + String(BACKEND_IP) + ":" + String(BACKEND_PORT) + "/api/chat_tts";
  http.begin(*client, url);
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(1024);
  doc["text"] = text;
  
  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);
  if (httpCode == HTTP_CODE_OK) {
    WiFiClient* stream = http.getStreamPtr();
    size_t capacity = 100 * 1024; // Allocate initially 100KB on PSRAM
    tts_buffer = (uint8_t*)heap_caps_malloc(capacity, MALLOC_CAP_8BIT | MALLOC_CAP_SPIRAM);
    
    if (tts_buffer == NULL) {
      Serial.println("TTS Error: Failed to allocate initial PSRAM");
      http.end();
      return false;
    }
    
    size_t written = 0;
    
    // Read stream bytes progressively. Adjust for HTTP chunked stream behaviors.
    while (http.connected() || stream->available()) {
      if (stream->available()) {
        int bytesToRead = stream->available();
        
        // Reallocate memory block if nearing capacity limit
        if (written + bytesToRead > capacity) { 
           size_t oldCapacity = capacity;
           capacity += 50 * 1024; // Grow iteratively by 50KB chunks
           tts_buffer = (uint8_t*)heap_caps_realloc(tts_buffer, capacity, MALLOC_CAP_8BIT | MALLOC_CAP_SPIRAM);
           
           if (tts_buffer == NULL) {
             Serial.println("TTS Error: Reallocation failed, file might be too large");
             http.end();
             return false;
           }
        }
        
        int c = stream->readBytes(tts_buffer + written, bytesToRead);
        written += c;
      }
      delay(1);
    }
    
    *out_mp3_buffer = tts_buffer;
    *out_size = written;
    http.end();
    return true;
  } else {
    Serial.printf("TTS API Stream Return Code Error: %d\n", httpCode);
  }
  
  http.end();
  return false;
}

void openai_free_tts_buffer() {
  if (tts_buffer != NULL) {
    heap_caps_free(tts_buffer);
    tts_buffer = NULL;
  }
}
