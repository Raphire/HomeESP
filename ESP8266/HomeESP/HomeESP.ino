#include <ESPHelper.h>
#include <ESPHelperFS.h>
#include <ESPHelperWebConfig.h>
#include <Metro.h>
#include <NewRemoteTransmitter.h>
#include <DHT.h>
#include <hp_BH1750.h>

#define INTERNAL_LED        2
#define RF_PIN              2
#define DHT_PIN             14
#define LED_PIN             12
#define BUTTON_PIN          13

#define DHT_TYPE            DHT22

#define HOSTNAME            "Home-ESP"
#define OTA_PASSWORD        "Home-ESP"
#define SSID                "Default-Network"
#define NETWORK_PASS        "Default-Password"
#define MQTT_HOST           "Default-MQTT-Host"
#define MQTT_USERNAME       "Default-MQTT-User"
#define MQTT_PASS           "Default-MQTT-Password"
#define MQTT_PORT           1883
#define WILL_MESSAGE        "offline"

#define HOME_ESP_CONFIG     "/homeESPConfig.json"

#define MAX_KAKU_UNITS      5

// MQTT Topics
#define DISCOVERY_TOPIC     "home-esp/discovery"
#define DISCOVERY_CB_TOPIC  "home-esp/discovery/callback"
char PARAM_REQUEST_TOPIC[96];
char CONFIG_REQUEST_TOPIC[96];

char STATUS_TOPIC[96];
char RESTART_TOPIC[96];
char UPTIME_TOPIC[96];
char CONFIG_TOPIC[96];
char CONFIG_SET_TOPIC[96];

char TEMP_TOPIC[96];
char HMDTY_TOPIC[96];
char LIGHTSENS_TOPIC[96];
char LIGHT_TOPIC[96];
char LIGHT_TOGGLE_TOPIC[96];
char KAKU_TOPIC[96];
char KAKU_UNITS_TOPIC[MAX_KAKU_UNITS][96];
char KAKU_UNITS_TOGGLE_TOPIC[MAX_KAKU_UNITS][96];

netInfo config;
ESPHelper MyESP;
ESP8266WebServer WebServer(80);
ESPHelperWebConfig ConfigPage(&WebServer, "/config");

netInfo DefaultNet = { .mqttHost = MQTT_HOST,
                       .mqttUser = MQTT_USERNAME,
                       .mqttPass = MQTT_PASS,
                       .mqttPort = MQTT_PORT,
                       .ssid = SSID,
                       .pass = NETWORK_PASS,
                       .otaPassword = OTA_PASSWORD,
                       .hostname = HOSTNAME
                     };

// AP mode setup
char BroadcastSSID[16];
const char* BroadcastPASS = "";
IPAddress BroadcastIP = {192, 168, 1, 1};

// Initialize DHT sensor
DHT MyDHT(DHT_PIN, DHT_TYPE);

/// Initialize BH1750 sensor
hp_BH1750 BH1750;

// Setup timeout and intervals
Metro ConnectTimeout = Metro(20000);
Metro PublishInterval = Metro(4000);
Metro DHTReadInterval = Metro(2000);
Metro ConfigInterval = Metro(100);

// Global variables
bool ConnectedToBroker = false;
bool Interupted = false;
bool lightSensorConnected = false;
bool LightState = false;
bool* KakuState;
float Temperature;
float Humidity;
float LightIntensity;

// Configuration parameters
char TempMin[8];
char TempMax[8];
char HmdtyMin[8];
char HmdtyMax[8];
char LightsensMin[8];
char LightsensMax[8];
char KakuAddress[16];
char KakuUnits[160];
char Sensors[128];
char Actuators[128];


ICACHE_RAM_ATTR void handleInterrupt() {
  Interupted = true;
}


// Checks for interrupt and starts AP mode
bool checkForInterrupt() {
  if(Interupted) {
    char bufString[16];
  
    itoa(random(1000, 9999), bufString, 10);
    concat("HomeESP-", bufString, BroadcastSSID);

    Serial.print("Starting broadcast (AP) mode with SSID: ");
    Serial.println(BroadcastSSID);
    
    MyESP.broadcastMode(BroadcastSSID, BroadcastPASS, BroadcastIP);
    MyESP.OTA_setPassword(config.otaPassword);
    MyESP.OTA_setHostname(config.hostname);
    MyESP.OTA_enable();

    return true;
  }
  return false;
}


// Attempt to load a network configuration from the filesystem
void loadConfig() {
  // Check for a good config file and start ESPHelper with the file stored on the ESP
  if (ESPHelperFS::begin()) {
    Serial.println("Filesystem loaded, loading config...");
    if (ESPHelperFS::validateConfig("/netConfig.json") == GOOD_CONFIG) {
      delay(10);
      MyESP.begin("/netConfig.json");
    }
    // If no good config can be loaded (no file/corruption/etc.) then
    // attempt to generate a new config and restart the module
    else {
      Serial.println("Could not load config, saving new config from default values and restarting...");
      delay(10);
      ESPHelperFS::createConfig(&DefaultNet, "/netConfig.json");
      ESPHelperFS::end();
      ESP.restart();
    }
  }

  // If the filesystem cannot be started, just fail over to the
  // built in network config hardcoded in here
  else {
    Serial.println("Could not load filesystem, proceeding with default config values...");
    delay(10);
    MyESP.begin(&DefaultNet);
  }

  // Load the netInfo from espHelper
  config = MyESP.getNetInfo();

  uint16_t size = 1024;
  MyESP.setBufferSize(size);
}


// Attempt to load a network configuration from the filesystem
void loadHomeESPConfig() {
  // Check for a good config file and load the contents into memory
  if (ESPHelperFS::begin()) {
    Serial.println("Filesystem loaded, loading HomeESP config...");
    if (validateHomeESPConfig(HOME_ESP_CONFIG) == GOOD_CONFIG) {
      String loadedVal;
      delay(10);

      loadedVal = ESPHelperFS::loadKey("tempMin", HOME_ESP_CONFIG);
      loadedVal.toCharArray(TempMin, loadedVal.length() + 1);
      
      loadedVal = ESPHelperFS::loadKey("tempMax", HOME_ESP_CONFIG);
      loadedVal.toCharArray(TempMax, loadedVal.length() + 1);

      loadedVal = ESPHelperFS::loadKey("hmdtyMin", HOME_ESP_CONFIG);
      loadedVal.toCharArray(HmdtyMin, loadedVal.length() + 1);
      
      loadedVal = ESPHelperFS::loadKey("hmdtyMax", HOME_ESP_CONFIG);
      loadedVal.toCharArray(HmdtyMax, loadedVal.length() + 1);

      loadedVal = ESPHelperFS::loadKey("lightsensMin", HOME_ESP_CONFIG);
      loadedVal.toCharArray(LightsensMin, loadedVal.length() + 1);
      
      loadedVal = ESPHelperFS::loadKey("lightsensMax", HOME_ESP_CONFIG);
      loadedVal.toCharArray(LightsensMax, loadedVal.length() + 1);
      
      loadedVal = ESPHelperFS::loadKey("sensors", HOME_ESP_CONFIG);
      loadedVal.toCharArray(Sensors, loadedVal.length() + 1);
      
      loadedVal = ESPHelperFS::loadKey("actuators", HOME_ESP_CONFIG);
      loadedVal.toCharArray(Actuators, loadedVal.length() + 1);

      loadedVal = ESPHelperFS::loadKey("kakuAddress", HOME_ESP_CONFIG);
      loadedVal.toCharArray(KakuAddress, loadedVal.length() + 1);

      loadedVal = ESPHelperFS::loadKey("kakuUnits", HOME_ESP_CONFIG);
      loadedVal.toCharArray(KakuUnits, loadedVal.length() + 1);
    }
    // If no good config can be loaded (no file/corruption/etc.) then
    // attempt to generate a new config and restart the module
    else {
      Serial.println("Could not load HomeESP config, saving new HomeESP config from default values and restarting...");
      delay(10);

      StaticJsonDocument<JSON_SIZE> jsonBuffer;

      jsonBuffer["0"] = "Ventilator";
    
      char kakuUnitsBuffer[160];
      serializeJson(jsonBuffer, kakuUnitsBuffer);

      char* defaultSensors = "[\"temp\",\"hmdty\",\"lightsens\"]";
      char* defaultActuators = "[\"light\"]";

      createHomeESPConfig(HOME_ESP_CONFIG, "15", "30", "30", "70", "100", "5000", defaultSensors, defaultActuators, "35905642", kakuUnitsBuffer);
      ESPHelperFS::end();
      ESP.restart();
    }
  }
}


void setupConnection() {
  loadConfig();
  loadHomeESPConfig();

  // Setup other ESPHelper info and enable OTA updates
  MyESP.setHopping(false);
  MyESP.OTA_setHostname(config.hostname);
  MyESP.OTA_setPassword(config.otaPassword);
  MyESP.OTA_enable();

  // Assign the MQTT topics
  concat(config.hostname, "/status", STATUS_TOPIC);
  concat(config.hostname, "/restart", RESTART_TOPIC);
  concat(config.hostname, "/uptime", UPTIME_TOPIC);
  concat(config.hostname, "/config", CONFIG_TOPIC);
  concat(CONFIG_TOPIC, "/set", CONFIG_SET_TOPIC);
  concat(CONFIG_TOPIC, "/get", CONFIG_REQUEST_TOPIC);
  concat(config.hostname, "/params/get", PARAM_REQUEST_TOPIC);
  concat(config.hostname, "/temp", TEMP_TOPIC);
  concat(config.hostname, "/hmdty", HMDTY_TOPIC);
  concat(config.hostname, "/lightsens", LIGHTSENS_TOPIC);
  concat(config.hostname, "/light", LIGHT_TOPIC);
  concat(LIGHT_TOPIC, "/toggle", LIGHT_TOGGLE_TOPIC);
  concat(config.hostname, "/kaku/", KAKU_TOPIC);

  // Setup MQTT Callback & Subscriptions
  MyESP.setMQTTCallback(callback);
  MyESP.addSubscription(DISCOVERY_TOPIC);
  MyESP.addSubscription(PARAM_REQUEST_TOPIC);
  MyESP.addSubscription(CONFIG_REQUEST_TOPIC);
  MyESP.addSubscription(RESTART_TOPIC);
  MyESP.addSubscription(CONFIG_SET_TOPIC);
  MyESP.addSubscription(LIGHT_TOGGLE_TOPIC);

  int count = 0;
  const char* buf = KakuUnits;
  StaticJsonDocument<JSON_SIZE> jsonBuffer;
  deserializeJson(jsonBuffer, buf);
  
  for (JsonPair keyValue : jsonBuffer.as<JsonObject>()) {
    concat(KAKU_TOPIC, keyValue.key().c_str(), KAKU_UNITS_TOPIC[count]);
    concat(KAKU_UNITS_TOPIC[count], "/toggle", KAKU_UNITS_TOGGLE_TOPIC[count]);
    
    MyESP.addSubscription(KAKU_UNITS_TOGGLE_TOPIC[count]);
    count++;
  }

  // Reinitialize KakuState with the correct size if the device has any kaku units
  if (count > 0) {
    delete [] KakuState;
    KakuState = new bool[count] {false};
  }

  // Setup last will and testament
  MyESP.setWill(STATUS_TOPIC, WILL_MESSAGE, 1, 1);

  Serial.println("Connecting to network...");
  delay(10);
  
  // Connect to wifi before proceeding. If this fails start AP broadcast mode
  while (MyESP.loop() < WIFI_ONLY) {
    if(checkForInterrupt()) {
      return;
    }
    delay(10);
  }

  Serial.println("Wifi connection established!");
  Serial.println(String("To connect to this device go to " + String(MyESP.getIP())));
}


void setup() {
  Serial.begin(115200);
  Serial.println("Starting up, please wait...");

  pinMode(INTERNAL_LED, OUTPUT);     
  digitalWrite(INTERNAL_LED, HIGH);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  pinMode(DHT_PIN, INPUT);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), handleInterrupt, RISING);

  setupConnection();

  // Initialize status and config page
  ConfigPage.fillConfig(&config);
  ConfigPage.begin(config.hostname);

  WebServer.begin();
  WebServer.on("/", HTTP_GET, handleStatus);

  // Initialize sensors
  MyDHT.begin();
  
  lightSensorConnected = BH1750.begin(BH1750_TO_GROUND);
  BH1750.start();
}


// Handles incoming MQTT messages
void callback(char* topic, byte* payload, unsigned int length) {
  char newPayload[length + 1];
  
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");

  if (length > 0) {
    for (int i = 0; i < length; i++) {
      Serial.print((char)payload[i]);
      newPayload[i] = (char)payload[i];
    }
    
    newPayload[length] = '\0';
  }

  Serial.println();

  if (strcmp(topic, PARAM_REQUEST_TOPIC) == 0) {
    publishParameters();
  }
  else if (strcmp(topic, LIGHT_TOGGLE_TOPIC) == 0) {
    toggleLight();
    publishLightStatus();
  }
  else if (strcmp(topic, CONFIG_REQUEST_TOPIC) == 0) {
    if (ConfigInterval.check()) {
        ConfigInterval.reset();
        publishConfig();
    }
  }
  else if (strcmp(topic, RESTART_TOPIC) == 0) {
    restartDevice();
  }
  else if (strcmp(topic, DISCOVERY_TOPIC) == 0) {
    MyESP.publish(DISCOVERY_CB_TOPIC, config.hostname);
  }
  else if (strcmp(topic, CONFIG_SET_TOPIC) == 0) {
    char kakuUnitsBuffer[160];
    char sensorBuffer[128];
    char actuatorBuffer[128];
    StaticJsonDocument<JSON_SIZE> jsonBuffer;
    deserializeJson(jsonBuffer, newPayload, length);

    serializeJson(jsonBuffer["kakuUnits"], kakuUnitsBuffer);
    serializeJson(jsonBuffer["sensors"], sensorBuffer);
    serializeJson(jsonBuffer["actuators"], actuatorBuffer);

    createHomeESPConfig(HOME_ESP_CONFIG, jsonBuffer["tempMin"], jsonBuffer["tempMax"], jsonBuffer["hmdtyMin"], jsonBuffer["hmdtyMax"], 
                        jsonBuffer["lightsensMin"], jsonBuffer["lightsensMax"], sensorBuffer, actuatorBuffer, jsonBuffer["kakuAddress"], kakuUnitsBuffer);
    restartDevice();
  }
  else {
    int count = 0;
    const char* buf = KakuUnits;
    StaticJsonDocument<JSON_SIZE> jsonBuffer;
    deserializeJson(jsonBuffer, buf);
    
    for (JsonPair keyValue : jsonBuffer.as<JsonObject>()) {
      if (strcmp(topic, KAKU_UNITS_TOGGLE_TOPIC[count]) == 0) {
        toggleKaku(keyValue.key().c_str(), count);
        publishKakuStatus();
      }

      count++;
    }
  }
}


void manageESPHelper(int wifiStatus) {
  // If the unit is broadcasting or connected to wifi then reset the timeout vars
  if (wifiStatus == BROADCAST || wifiStatus >= WIFI_ONLY) {
    ConnectTimeout.reset();

    // Check if the Connection status has changed.
    // If Status changed to FULL_CONNECTION publish "online" status message on STATUS_TOPIC
    if (ConnectedToBroker != (wifiStatus == FULL_CONNECTION)) {
      ConnectedToBroker = wifiStatus == FULL_CONNECTION;
      if (ConnectedToBroker) {
        Serial.print("Full Connection established. Publishing connection status on topic ");
        Serial.println(STATUS_TOPIC);
        
        MyESP.publish(STATUS_TOPIC, "online", true);
      }
      digitalWrite(INTERNAL_LED, !ConnectedToBroker);
    }
  }
  // Otherwise check for a timeout condition and handle setting up broadcast
  else if(wifiStatus < WIFI_ONLY) {
    if(ConnectTimeout.check()) {
      restartDevice();
    }
  }

  // Handle saving a new network config
  if (ConfigPage.handle()) {
    Serial.println("Saving new network config and restarting...");
    MyESP.saveConfigFile(ConfigPage.getConfig(), "/netConfig.json");
    delay(500);
    ESP.restart();
  }
}


void loop() {
  manageESPHelper(MyESP.loop());

  if (DHTReadInterval.check()) {
    DHTReadInterval.reset();
    
    Humidity = MyDHT.readHumidity();
    Temperature = MyDHT.readTemperature();
  }
  
  if (lightSensorConnected && BH1750.hasValue() == true) {    
    LightIntensity = BH1750.getLux();
    BH1750.start();
  }

  yield();
}


void toggleLight() {
  LightState = !LightState;

  if (LightState) {
    digitalWrite(LED_PIN, HIGH);
  }
  else {
    digitalWrite(LED_PIN, LOW);
  }
}


void toggleKaku(const char* unit, int index) {
  KakuState[index] = !KakuState[index];

  NewRemoteTransmitter transmitter(atoi(KakuAddress), RF_PIN, 260);
  transmitter.sendUnit(atoi(unit), KakuState[index]);
}
