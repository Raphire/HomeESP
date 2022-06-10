# HomeESP
HomeESP is a simple standalone home automation solution using the ESP8266, it allows you to monitor, control and configure compatible devices through a user friendly dashboard. 

This project is a proof-of-concept, as such, there are some limitations. For example, the type of sensors and actuators and their pinouts are static and cannot be configured in the dashboard. However, if you have programming experience it should be quite easy to adapt and expand this project to suit your own needs.

![Dashboard](/Images/dashboard.jpeg)

## Dependencies
HomeESP requires the following libraries to be installed:
* [ESPHelper](https://github.com/Raphire/ESPHelper) (Make sure to use my fork, as the original is not compatible with newer versions of ArduinoJSON)
* [Metro](https://www.pjrc.com/teensy/td_libs_Metro.html)
* [Pubsubclient](https://github.com/knolleary/pubsubclient)
* [ArduinoJson 6.x](https://github.com/bblanchon/ArduinoJson)

HomeESP also makes use of the following libraries for the sensors and RF transmitter:
* [Newremoteswitch](https://github.com/1technophile/NewRemoteSwitch)
* [DHT](https://github.com/adafruit/DHT-sensor-library)
* [HP_bh1750](https://github.com/Starmbi/hp_BH1750)

In addition to those libraries, make sure that you have the ESP core files installed aswell:
* [ESP8266 Arduino Core](https://github.com/esp8266/Arduino) (Tested with v2.7.4)

## Installation & Setup
You can download HomeESP by clicking the green download button above, and then "Download ZIP". This zipfile contains the dashboard and HomeESP device firmware. You will need these files in a bit, but first we will need to setup an MQTT broker.

### 1. MQTT Broker
Download and install an MQTT broker that supports websocket connections, such as mosquitto or hiveMQ. 

Create login credentials for both yourself (Which will be used to login to the dashboard) and your devices (one login can be used for all devices), the exact way to do this varies depending on which broker you want to use.

Enable websockets in your broker configuration and assign a port, this websocket port is required to login to the dashboard later. The devices will use the default MQTT port (usually 1883) for communicating with the MQTT broker.

NOTE: If you deploy the dashboard on a webserver with HTTPS you must also use websockets with SSL, this means your MQTT broker needs an SSL certificate and be configured accordingly. 

More info on how to install and setup your MQTT server can be found on their respective websites:
* [Mosquitto](https://mosquitto.org/)
* [HiveMQ](https://www.hivemq.com/)

### 2. Getting The Dashboard Ready
**Installation for use on local machine:** <br>
Unzip the downloaded file and place the 'Dashboard' folder on your device, the dashboard can be opened by opening the index.html file.

**Installation for web deployment:** <br>
Unzip the downloaded file and place the contents of the dashboard folder in the root of your webserver, next simply navigate to your IP address or domain.

### 3. Connect Everything To The Device(s)
Time to connect all the components to the ESP board, a handy table with pinouts is shown below. The pinouts for the components are static, but all of the sensors and components are optional, meaning you can use a device with only a temperature/humidity sensor attached for example. 

Tip: Use [this webpage](https://randomnerdtutorials.com/esp8266-pinout-reference-gpios/) as a pinout reference for your specific ESP board.

Name | Type | Connected to GPIO
------------ | -------------  | -------------
[DHT11/DHT22](https://cdn-learn.adafruit.com/downloads/pdf/dht.pdf) | Temperature and humidity sensor (Input) | 14
[BH1750](https://microcontrollerslab.com/bh1750-interfacing-with-arduino-measure-light/) | Light intensity sensor (Input) | 4 & 5 (I2C)
Button | Input | 13
[RF Transmitter 433MHz](https://randomnerdtutorials.com/decode-and-send-433-mhz-rf-signals-with-arduino/) | KaKu Compatible RF 433MHz (Output) | 2
LED | Output | 12

Example with D1 Mini:
![Pinout example](/Images/pinoutexample.png)

### 4. Installing Device Firmware
**Note: It is recommended to use the [Arduino IDE](https://www.arduino.cc/en/software) for this step.**

Connect the ESP board to your computer.

Navigate to the ESP8266 folder inside the HomeESP folder you just downloaded, and open the HomeESP.ino file inside with the Arduino IDE.

Select the correct board variant from Arduino IDE -> Tools -> Board.

Click the upload button, it should now start compiling and uploading. Keep an eye on the console output to make sure this happened correctly. If it fails, check whether you have all of the required libraries, the ESP8266 Arduino Core installed (Tested with v2.7.4) and selected the correct board type.

### 5. Device Configuration
Once the upload is complete, wait a few seconds and press the button that is connected to GPIO 13 of the device. The device will now enter a broadcast mode, which allows you to connect to your device directly via wifi. Look for any open network with the name "HomeESP" followed by 4 random numbers, and connect to it.

Next, open your webbrowser and navigate to the device configuration page: [http://192.168.1.1/config](http://192.168.1.1/config). It should look something like this:

![Device Setup](/Images/deviceconfig.png)

Here you can enter the desired hostname for the device, network info (Wifi SSID & password) and the MQTT username and password for your device, the MQTT port can be left at 1883 (which is the default for most MQTT brokers).

Click save, your device should now automatically restart and connect to your network and MQTT broker. 

### 6. Logging Into The Dashboard
Open the dashboard and enter the login details that you created in step 1. 

Enter the hostname of your mqtt broker and the websocket port that you configured in step 1 and click login.

Once you succesfully login you should be greeted with the discovery tool, this allows you to quickly add any devices that are currently connected to the MQTT broker, if your device does not show up right away you can press the green refresh button. Select all of the devices that you would like to add and click 'Add selected devices'.

![Device Discovery Tool](/Images/discoverytool.jpeg)

Done! Your devices should now show up on the dashboard!

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
