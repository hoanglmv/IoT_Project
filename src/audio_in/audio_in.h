#ifndef AUDIO_IN_H
#define AUDIO_IN_H

#include <Arduino.h>

bool audio_in_init();
void audio_in_start_recording();
void audio_in_stop_recording();
bool audio_in_is_recording();
uint8_t* audio_in_get_buffer();
size_t audio_in_get_size();

#endif // AUDIO_IN_H
