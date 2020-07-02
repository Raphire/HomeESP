bool createHomeESPConfig(const char* filename,
                         const char* _tempMin,
                         const char* _tempMax,
                         const char* _hmdtyMin,
                         const char* _hmdtyMax,
                         const char* _lightsensMin,
                         const char* _lightsensMax,
                         const char* _sensors,
                         const char* _actuators,
                         const char* _kakuAddress,
                         const char* _kakuUnits) {

  StaticJsonDocument<JSON_SIZE> jsonBuffer;

  jsonBuffer["tempMin"] = _tempMin;
  jsonBuffer["tempMax"] = _tempMax;
  jsonBuffer["hmdtyMin"] = _hmdtyMin;
  jsonBuffer["hmdtyMax"] = _hmdtyMax;
  jsonBuffer["lightsensMin"] = _lightsensMin;
  jsonBuffer["lightsensMax"] = _lightsensMax;
  jsonBuffer["sensors"] = _sensors;
  jsonBuffer["actuators"] = _actuators;
  jsonBuffer["kakuAddress"] = _kakuAddress;
  jsonBuffer["kakuUnits"] = _kakuUnits;

  return ESPHelperFS::saveConfig(jsonBuffer, filename);
}


int8_t validateHomeESPConfig(const char* filename) {
  StaticJsonDocument<JSON_SIZE> jsonBuffer;
  
  if(!ESPHelperFS::loadFile(filename, &jsonBuffer)) {
    return CANNOT_PARSE;
  }
  
  JsonObject json = jsonBuffer.as<JsonObject>();

  if(json.size() == 0) {
    return NO_CONFIG;
  }

  //check to make sure all netInfo keys exist
  if(!json.containsKey("tempMin") || !json.containsKey("tempMax")
      || !json.containsKey("hmdtyMin") || !json.containsKey("hmdtyMax")
      || !json.containsKey("lightsensMin") || !json.containsKey("lightsensMax")
      || !json.containsKey("sensors") || !json.containsKey("actuators")
      || !json.containsKey("kakuAddress") || !json.containsKey("kakuUnits")) {

    Serial.println("HomeESP config is incomplete!");

    return INCOMPLETE;
  }
  return GOOD_CONFIG;
}
