void handleStatus() {
  WebServer.send(200, "text/html", \
              String("<html>\
                        <header>\
                        <title>Device Status</title>\
                        <style body=\"text-align:center;\"font-family:verdana;\"></style>\
                        </header>\
                        <body style=\"background-color:#00dfff;\"><font style=\"font-family:verdana;\">\
                          <center>\
                            <p><h3 style=\"text-align:center;\"><span style=\"color:#0a4f75;\"><strong>ESP8266 Device Status</strong></span></h3>\
                            <hr />\
                            <strong>Device Name:</strong> " + String(MyESP.getHostname()) + "</br>\
                            <strong>Connected SSID:</strong> " + String(MyESP.getSSID()) + "</br>\
                            <strong>Device IP:</strong> " + String(MyESP.getIP()) + "</br>\
                            <strong>Uptime (ms):</strong> " + String(millis()) + "</br>\
                            </br>\
                            <a href=" + String("/config") + ">Configure device</a></p>\
                          </center>\
                        </body>\
                      </html>"));
}
