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

  return saveConfig(jsonBuffer, filename);
}


int8_t validateHomeESPConfig(const char* filename) {
  StaticJsonDocument<JSON_SIZE> jsonBuffer;
  
  if(!loadFile(filename, &jsonBuffer)) {
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

bool loadFile(const char* filename, JsonDocument* buffer){
  // Open file as read only
  File configFile = SPIFFS.open(filename, "r");

  // Check to make sure opening was possible
  if (!configFile) {
    Serial.println("Failed to open config file");
    configFile.close();
    return false;
  }

  // Make sure the config isnt too large to store in the JSON container
  size_t size = configFile.size();
  FSdebugPrint("JSON File Size: ");
  FSdebugPrintln(size);
  if (size > JSON_SIZE) {
    Serial.println("JSON File too large");
    return false;
  }

  DeserializationError error = deserializeJson(*buffer, configFile);
  if(error && size != 0){
      Serial.println("JSON File corrupt/could not be deserialized");
      return false;
  }

  // Close out the file and return true
  configFile.close();
  return true;
}

bool saveConfig(JsonDocument& json, const char* filename) {
  if(SPIFFS.exists(filename)){
    SPIFFS.remove(filename);
  }

  File configFile = SPIFFS.open(filename, "w");
  if (!configFile) {
    Serial.println("Failed to open config file for writing");
    return false;
  }

  serializeJson(json, configFile);

  configFile.close();
  return true;
}
