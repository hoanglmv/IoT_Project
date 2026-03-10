#include "audio_in.h"
#include "config.h"
#include <driver/i2s.h>

#define I2S_PORT I2S_NUM_0

static uint8_t* audio_buffer = nullptr;
static size_t audio_size = 0;
static bool is_recording = false;
static TaskHandle_t recordTaskHandle = NULL;

void record_task(void* pvParameters) {
  size_t bytes_read = 0;
  size_t max_bytes = MAX_RECORDING_TIME * SAMPLE_RATE * (BITS_PER_SAMPLE / 8) * NUM_CHANNELS;
  
  if (audio_buffer == nullptr) {
    // Allocate buffer in PSRAM for audio recording
    audio_buffer = (uint8_t*)heap_caps_malloc(max_bytes, MALLOC_CAP_8BIT | MALLOC_CAP_SPIRAM);
  }
  
  if (audio_buffer == NULL) {
    Serial.println("ERROR: Failed to allocate PSRAM for recording!");
    is_recording = false;
    recordTaskHandle = NULL;
    vTaskDelete(NULL);
    return;
  }
  
  audio_size = 0;
  
  while (is_recording && audio_size < max_bytes) {
    // Read directly into PSRAM buffer
    i2s_read(I2S_PORT, (char*)(audio_buffer + audio_size), 1024, &bytes_read, portMAX_DELAY);
    audio_size += bytes_read;
    
    // Slight delay to yield task
    vTaskDelay(pdMS_TO_TICKS(1));
  }
  
  Serial.printf("Recorded %d bytes\n", audio_size);
  is_recording = false;
  recordTaskHandle = NULL;
  vTaskDelete(NULL);
}

bool audio_in_init() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 1024,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };
  
  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_MIC_SCK,
    .ws_io_num = I2S_MIC_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_MIC_SD
  };
  
  esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) return false;
  
  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) return false;
  
  i2s_zero_dma_buffer(I2S_PORT);
  return true;
}

void audio_in_start_recording() {
  if (is_recording) return;
  is_recording = true;
  xTaskCreatePinnedToCore(record_task, "RecordTask", 4096, NULL, 5, &recordTaskHandle, 1);
}

void audio_in_stop_recording() {
  is_recording = false;
  while (recordTaskHandle != NULL) {
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

bool audio_in_is_recording() {
  return is_recording;
}

uint8_t* audio_in_get_buffer() {
  return audio_buffer;
}

size_t audio_in_get_size() {
  return audio_size;
}
