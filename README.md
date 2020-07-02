# HomeESP
HomeESP is a simple home automation solution for the ESP8266, which allows you to monitor, control and configure compatible devices through a user friendly dashboard.

## Dependencies
HomeESP requires the following libraries to be installed:
* [ESPHelper](https://github.com/Raphire/ESPHelper) (Make sure to use my fork, as the original is not compatible with newer versions of ArduinoJSON)
* [Metro](https://www.pjrc.com/teensy/td_libs_Metro.html)
* [Pubsubclient](https://github.com/knolleary/pubsubclient)
* [ArduinoJson 6.x](https://github.com/bblanchon/ArduinoJson)

HomeESP also makes use of the following libraries for the sensors and RF transmitter:
* [Newremoteswitch](https://bitbucket.org/fuzzillogic/433mhzforarduino/wiki/Home)
* [DHT](https://github.com/adafruit/DHT-sensor-library)
* [HP_bh1750](https://github.com/Starmbi/hp_BH1750)

In addition to those libraries, make sure that you have the ESP core files installed aswell:
* [ESP8266 Arduino Core](https://github.com/esp8266/Arduino)

## Installation
### 1. MQTT Broker
Download and install an MQTT broker, such as mosquitto or hiveMQ. 

Next create login credentials for both yourself and your devices.

The dashboard connects to the broker via websockets, but this is generally not enabled by default. As such, make sure that your broker supports websocket connections and enable them. 

NOTE: If you deploy the dashboard on an HTTPS server most webbrowsers will require you make use of websockets with SSL, this means your MQTT broker needs an SSL certificate and be configured accordingly. 

More info on how to do this can be found on their respective websites:
* [Mosquitto](https://mosquitto.org/)
* [HiveMQ](https://www.hivemq.com/)

### 2. Dashboard
Click the "Clone or download" button above, next click "Download ZIP".

**Local use:** <br>
Unzip the downloaded file and place the 'Dashboard' folder on your device, next open the index.html file inside to start.

**Web deployment:** <br>
Unzip the downloaded file and place the contents of the dashboard folder in the root of your webserver, next simply navigate to your IP address or domain.

### 3. Connect Everything to Device
Connect all components to the ESP board. You can use [this webpage](https://randomnerdtutorials.com/esp8266-pinout-reference-gpios/) as a pinout reference.

Name | Type | Connected to GPIO
------------ | -------------  | -------------
DHT11/DHT22 | Temperature and humidity sensor (Input) | 14
BH1750 | Light intensity sensor (Input) | 4 & 5 (I2C)
Button | Input | 13
RF Transmitter | Output | 2
LED | Output | 12


### 4. Install Device Firmware
Connect the ESP board to your computer.

Open the ESP8266 folder, and open the HomeESP.ino file inside with the Arduino IDE.

Make sure you have all of the required libraries, and the ESP8266 Arduino Core installed.

Select the correct board variant from Arduino IDE -> Tools -> Board.

Click Upload.

### 5. Device Setup
Once the upload is complete the device, press the button that is connected to GPIO 13. The device will now enter a broadcast mode, which allows you to connect to your device directly via wifi. Look for any open network with the name HomeESP followed by 4 random numbers, and connect to it.

Next, open your webbrowser and navigate to the device configuration page: [http://192.168.1.1/config](http://192.168.1.1/config).

Lastly, enter the desired hostname, network info and MQTT broker details for your device and click save.

Your device should now automatically restart, and connect to your network and MQTT broker. 

### 6. Done!
Open the dashboard and enter the login details that you created in step 1. 

Enter the hostname of your broker and the websocket port that you configured in step 1 and click login.

Once you succesfully login you should be greeted with the discovery tool, this allows you to quickly add any devices that are currently connected to the MQTT broker, if your device does not show up right away try to click the green refresh button. Select all of the devices that you would like to add and click 'Add selected devices'.

## HomeESP Protocol (V2.1)
The HomeESP dashboard and devices use the MQTT protocol (A lightweight publish/subscribe protocol) to communicate with one another. MQTT clients communicate by subscribing and publishing messages to specific topics, which may also contain a payload. All topics used by HomeESP are laid out in the table below.

Topic | Description | Payload Type | Example Payload
------------ | -------------  | ------------- | -------------
home-esp/discover | Request all Home-ESP devices to respond on callback topic
home-esp/discover/callback | Contains device name | string | "Livingroom"
\<device\>/status	| Connection status of the device with the MQTT broker
\<device\>/restart	| Restart the node
\<device\>/uptime	| Device uptime [s] | string \<int\> | 806
\<device\>/config	| A JSON object containing the configuration parameters of the device:<br>•	tempMin<br>•	tempMax<br>•	hmdtyMin<br>•	hmdtyMax<br>•	lightsensMin<br>•	lightsensMax<br>•	sensors<br>•	actuators<br>•	kakuAddress<br>•	kakuUnits | JSON string
\<device\>/config/set | Set the configuration parameters of the device (see above) | JSON string
\<device\>/config/get | Request the device configuration parameters (see above)
\<device\>/params/get | Request the following parameters from the device: <br>•	\<device\>/temp<br>•	\<device\>/hmdty<br>•	\<device\>/lightsens<br>•	\<device\>/light<br>•	\<device\>/kaku/\<unit\> (of all units)
\<device\>/temp | Latest temperature measurement [°C] | string \<float\> | 22.30
\<device\>/hmdty | Latest humidity measurement [%] | string \<float\> | 50.90
\<device\>/lightsens | Latest light intensity measurement [lux] | string \<float\> | 324.29
\<device\>/light | Current state of the light ["on"/"off"] | string | "on"
\<device\>/light/toggle | Toggle the state of the light
\<device\>/kaku/\<unit\> | Current state of the specified unit ["on"/"off"] | string | "off"
\<device\>/kaku/\<unit\>/toggle | Toggle the state of the specified kaku unit
