#ifndef AUDIO_OUT_H
#define AUDIO_OUT_H

#include <Arduino.h>

bool audio_out_init();
bool audio_out_play_mp3(const uint8_t* mp3_data, size_t size);
void audio_out_loop();
bool audio_out_is_playing();

#endif // AUDIO_OUT_H
