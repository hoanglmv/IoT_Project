#ifndef OPENAI_CLIENT_H
#define OPENAI_CLIENT_H

#include <Arduino.h>

void openai_client_init();
String openai_transcribe(const uint8_t* audio_pcm, size_t length);
String openai_chat(String userInput);
bool openai_tts(String text, uint8_t** out_mp3_buffer, size_t* out_size);
void openai_free_tts_buffer();

#endif // OPENAI_CLIENT_H
