void publishConfig() {
  StaticJsonDocument<JSON_SIZE> jsonBuffer;

  jsonBuffer["tempMin"] = TempMin;
  jsonBuffer["tempMax"] = TempMax;
  jsonBuffer["hmdtyMin"] = HmdtyMin;
  jsonBuffer["hmdtyMax"] = HmdtyMax;
  jsonBuffer["lightsensMin"] = LightsensMin;
  jsonBuffer["lightsensMax"] = LightsensMax;
  jsonBuffer["sensors"] = Sensors;
  jsonBuffer["actuators"] = Actuators;
  jsonBuffer["kakuAddress"] = KakuAddress;
  jsonBuffer["kakuUnits"] = KakuUnits;

  char messageBuffer[768];
  serializeJson(jsonBuffer, messageBuffer);
  
  MyESP.publish(CONFIG_TOPIC, messageBuffer);
}


void publishParameters() {
  if(PublishInterval.check()) {
    PublishInterval.reset();

    publishUptime();
    publishKakuStatus();
    publishLightStatus();
    publishLightSensorStatus();
    publishDHTStatus();
  }
}


void publishUptime() {
  char pubString[64];
  long uptime = millis() / 60000; // Convert to minutes
  
  itoa(uptime, pubString, 10);
  MyESP.publish(UPTIME_TOPIC, pubString);
}


void publishKakuStatus() {
  char pubString[8];
  int count = 0;
  const char* buf = KakuUnits;
  StaticJsonDocument<JSON_SIZE> jsonBuffer;
  deserializeJson(jsonBuffer, buf);
  
  for(JsonPair keyValue : jsonBuffer.as<JsonObject>()) {
    if(KakuState[count]) {
      strncpy(pubString, "on", 10);
    }
    else {
      strncpy(pubString, "off", 10);
    }

    MyESP.publish(KAKU_UNITS_TOPIC[count], pubString);
    count++;
  }
}


void publishLightStatus() {
  char pubString[8];

  if(LightState) {
    strncpy(pubString, "on", 10);
  }
  else {
    strncpy(pubString, "off", 10);
  }

  MyESP.publish(LIGHT_TOPIC, pubString);
}


void publishLightSensorStatus() {
  if(lightSensorConnected) {
    char result[10];
  
    dtostrf(LightIntensity, 8, 2, result);
    MyESP.publish(LIGHTSENS_TOPIC, result);
  }
}


void publishDHTStatus() {
  char result[10];

  if(!isnan(Temperature)) {
    dtostrf(Temperature, 6, 2, result);
    MyESP.publish(TEMP_TOPIC, result);
  }

  if(!isnan(Humidity)) {
    dtostrf(Humidity, 6, 2, result);
    MyESP.publish(HMDTY_TOPIC, result);
  }
}
