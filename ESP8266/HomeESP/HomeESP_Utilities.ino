void concat(const char* a, const char* b, char* out) {
  strcpy(out, a);
  strcat(out, b);
}

void restartDevice() {
  Serial.println("Restarting...");
  MyESP.publish(STATUS_TOPIC, WILL_MESSAGE, 1);
  delay(200);
  ESP.restart();
}
