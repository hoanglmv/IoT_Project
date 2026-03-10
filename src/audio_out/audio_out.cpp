#include "audio_out.h"
#include "config.h"

// Requires library: "ESP8266Audio" by earlephilhower
// Ensure it's installed via Library Manager in Arduino IDE
#include <AudioFileSourcePROGMEM.h>
#include <AudioGeneratorMP3.h>
#include <AudioOutputI2S.h>

static AudioFileSourcePROGMEM *file = NULL;
static AudioGeneratorMP3 *mp3 = NULL;
static AudioOutputI2S *out = NULL;
static bool is_playing = false;

bool audio_out_init() {
  // Use I2S_NUM_1 for output, I2S_NUM_0 is used for mic
  out = new AudioOutputI2S(1, 1);
  
  // Set pinout: BCLK, LRC, DIN
  out->SetPinout(I2S_SPK_BCLK, I2S_SPK_LRC, I2S_SPK_DIN);
  out->SetGain(1.0); // Full volume (from 0.0 to 1.0)
  
  mp3 = new AudioGeneratorMP3();
  return true;
}

bool audio_out_play_mp3(const uint8_t* mp3_data, size_t size) {
  if (is_playing && mp3->isRunning()) {
    mp3->stop();
  }
  
  if (file != NULL) {
    delete file;
    file = NULL;
  }
  
  if (mp3_data == NULL || size == 0) {
    return false;
  }
  
  file = new AudioFileSourcePROGMEM(mp3_data, size);
  is_playing = mp3->begin(file, out);
  
  if (!is_playing) {
    Serial.println("ERROR: Failed to begin MP3 decoding");
  }
  
  return is_playing;
}

void audio_out_loop() {
  if (is_playing) {
    if (mp3->isRunning()) {
      if (!mp3->loop()) {
        mp3->stop();
        is_playing = false;
        Serial.println("MP3 Playback finished");
      }
    } else {
      is_playing = false;
    }
  }
}

bool audio_out_is_playing() {
  return is_playing;
}
