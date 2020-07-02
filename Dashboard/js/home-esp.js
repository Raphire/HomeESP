let username;
let password;
let host;
let port;
let useSSL;
let rememberHost;
let mqtt;
let reconnectTimeout = 2000;
let devices = { list: [] };
let alerts = [];
let alertCounter = 0;
let verboseMode = false;
let requestInterval;
let sparkResizeTimeout;
let deferredPrompt;
let sensors = [ "temp", "hmdty", "lightsens" ];
let actuators = [ "light" ];

function initiateConnection(loginUser, loginPass, loginHost, loginPort, loginSSL, loginRemember) {
  username = loginUser;
  password = loginPass;
  host = loginHost;
  port = parseInt(loginPort);
  useSSL = loginSSL;
  rememberHost = loginRemember;

  // Disable the login button & add a loading indicator
  $("#loginButton").prop("disabled", true);
  $("#loginButton").html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...');

  MQTTconnect();
};

function MQTTconnect() {
  if(typeof path == "undefined") {
    path = '/ws';
  }

  mqtt = new Paho.MQTT.Client(host, port, path, "HomeESP-" + parseInt(Math.random() * 100, 10));

  let options = {
    timeout: 3,
    useSSL: useSSL,
    userName: username,
    password: password,
    cleanSession: true,
    onSuccess: onConnect,
    onFailure: function(message) {
      clearInterval(requestInterval);
      clearAlerts();

      alert("Connection failed: " + message.errorMessage);

      devices.list.forEach(device => $('#' + device + 'Modal').modal('hide'));
      $('#discoveryModal').modal('hide');

      // Re-enable the login button & remove the loading indicator
      $("#loginButton").prop("disabled", false);
      $("#loginButton").html("<i class='fa fa-sign-in-alt mr-2' aria-hidden='true'></i>Connect");
      
      // Switch from dashboard to login
      $('#loginWrapper').removeClass('hidden');
      $('#dashboardWrapper').addClass('hidden');
    }
  };

  mqtt.onConnectionLost = onConnectionLost;
  mqtt.onMessageArrived = onMessageArrived;
  mqtt.connect(options);
};

function onConnect() {
  // Save the host/port input if the remember box was checked
  if(rememberHost) {
    localStorage['host'] = host;
    localStorage['port'] = port;
    localStorage['useSSL'] = useSSL;
  } else if(localStorage['host'] != null) {
    delete localStorage['host'];
    delete localStorage['port'];
    delete localStorage['useSSL'];
  }

  console.log('Connected to %s:%s%s', host, port,path);
  $('#statusLabel').html('Connected to ' + host + ':' + port + path);

  // Initialize all existing devices
  if(localStorage[host] != null && localStorage[host].length >= 3) {
    devices.list = JSON.parse(localStorage[host]);
    devices.list.forEach(device => initDevice(device));
  } else {
    publishMessage('home-esp', '/discovery');
    $("#discoveryModal").modal();
  }

  mqtt.subscribe('home-esp/discovery/callback', {qos: 0});

  requestInterval = setInterval(function() {devices.list.forEach(device => publishMessage(device, "/params/get"))}, 5000);

  $(window).resize(function() {
    clearTimeout(sparkResizeTimeout);
    sparkResizeTimeout = setTimeout(function() {devices.list.forEach(device => updateSparkline(device))}, 100);
  });

  // Switch from login to dashboard
  $('#loginWrapper').addClass('hidden');
  $('#dashboardWrapper').removeClass('hidden');
  document.getElementById("navbarName").textContent = username;
};

function onConnectionLost(response) {
  setTimeout(MQTTconnect, reconnectTimeout);
  console.error("Connection lost: %s Attempting to reconnect...", response.errorMessage);
  $('#statusLabel').html("Connection lost: " + response.errorMessage + " Attempting to reconnect...");
};

function publishMessage(device, topic, payload = "", retain = false) {
  message = new Paho.MQTT.Message(payload);
  message.destinationName = device + topic;
  message.retained = retain;

  mqtt.send(message);
};

function onMessageArrived(message) {
  let topic = message.destinationName;
  let payload = message.payloadString;
  let retain = message.retained;

  if(verboseMode) {
    console.log("Topic: %s, Message payload: %s, Retain: %s", topic, payload, retain);
  }

  let today = new Date();
  let timestamp = ("0" + today.getHours()).slice(-2) + ":" + ("0" + today.getMinutes()).slice(-2) + ":" + ("0" + today.getSeconds()).slice(-2);
  $('#lastContactLabel').html("Today at " + timestamp);

  let msg = topic.split('/');
  let device = msg[0];
  let parameter = msg[1];

  switch(parameter) {
    case 'status':
      if(payload == 'online') {
        if(!devices[device].deviceConnected) {
          if(devices[device].deviceConnected != null) {
            addAlert(device + " has connected", 'fas fa-2x fa-align-center fa-wifi text-secondary mx-15');
          }

          devices[device].deviceConnected = true;
          
          $('#' + device + 'ConnectionLabel').text('Connected');
          $('#' + device + 'ConnectionLabel').removeClass('badge-danger').addClass('badge-success');
          $('#' + device + 'RestartButton').prop('disabled', false);
          $('#' + device + 'ConfigureButton').prop('disabled', false);
          
          addParametersToConfig(device);

          if(!devices[device].configRead) {
            publishMessage(device, "/config/get");
          }
          publishMessage(device, "/params/get");
        }
      } else {
        if(devices[device].deviceConnected || devices[device].deviceConnected == null) {
          if(devices[device].deviceConnected != null) {
            addAlert(device + " has disconnected", 'fas fa-2x fa-align-center fa-wifi-slash text-secondary mx-15');
          }

          devices[device].configRead = false;
          devices[device].deviceConnected = false;

          $('#' + device + 'ConnectionLabel').text('Not connected');
          $('#' + device + 'ConnectionLabel').removeClass('badge-success').addClass('badge-danger');
          $('#' + device + 'RestartButton').prop('disabled', true);
          $('#' + device + 'ConfigureButton').prop('disabled', true);

          for(unit in devices[device].kakuUnits) {
            $("#" + device + unit + "KakuCard").remove();
            mqtt.unsubscribe(device + '/kaku/' + unit);
          }

          if(devices[device].sensors != null) {
            devices[device].sensors.forEach(function(sensor) {
              $("#" + device + sensor + "Card").remove();
              mqtt.unsubscribe(device + '/' + sensor);
            });
          }

          if(devices[device].actuators != null) {
            devices[device].actuators.forEach(function(actuator) {
              $("#" + device + actuator + "Card").remove();
              mqtt.unsubscribe(device + '/' + actuator);
            });
          }
        }
      }
      break;
    case 'uptime':
      $('#' + device + 'UptimeLabel').html("(Uptime: " + payload + " min)");
      if(!devices[device].deviceConnected) {
        devices[device].deviceConnected = null;
        publishMessage(device, "/status", "online", true);
      }
      break;
    case 'temp':
      updateSparkCard(device, parameter, 'temperature', '°C', 'fas fa-3x fa-align-center fa-thermometer-half text-secondary ml-23 mr-3', 'fas fa-3x fa-align-center fa-thermometer-empty text-danger ml-23 mr-3',
                    'fas fa-3x fa-align-center fa-thermometer-full text-danger ml-23 mr-3', payload, devices[device].tempMin, devices[device].tempMax);
      break;
    case 'hmdty':
      updateSparkCard(device, parameter, 'humidity', '%', 'fas fa-3x fa-align-center fa-humidity text-secondary ml-15 mr-23', 'far fa-3x fa-align-center fa-humidity text-danger ml-15 mr-23',
                    'fas fa-3x fa-align-center fa-humidity text-danger ml-15 mr-23', payload, devices[device].hmdtyMin, devices[device].hmdtyMax);
      break;
    case 'lightsens':
      updateSparkCard(device, parameter, 'light intensity', ' lux', 'fas fa-3x fa-align-center fa-sun text-secondary ml-0 mr-1', 'far fa-3x fa-align-center fa-sun text-danger mr-1',
                    'fas fa-3x fa-align-center fa-sun text-danger mr-1', payload.split(".")[0], devices[device].lightSensMin, devices[device].lightSensMax);
      break;
    case 'light':
      updateCard(device, parameter, payload);
      break;
    case 'kaku':
      if(msg.length >= 3){
        updateCard(device, 'Kaku', payload, msg[2]);
      }
      break;
    case 'config':
      if(!devices[device].configRead) {
        devices[device].configRead = true;
        let jsonBuffer = JSON.parse(payload);

        $('#' + device + 'ConfigTempMin').val(jsonBuffer['tempMin']);
        $('#' + device + 'ConfigTempMax').val(jsonBuffer['tempMax']);
        $('#' + device + 'ConfigHmdtyMin').val(jsonBuffer['hmdtyMin']);
        $('#' + device + 'ConfigHmdtyMax').val(jsonBuffer['hmdtyMax']);
        $('#' + device + 'ConfigLightSensMin').val(jsonBuffer['lightsensMin']);
        $('#' + device + 'ConfigLightSensMax').val(jsonBuffer['lightsensMax']);
        $('#' + device + 'ConfigKakuAddress').val(jsonBuffer['kakuAddress']);

        devices[device].tempMin = jsonBuffer['tempMin'];
        devices[device].tempMax = jsonBuffer['tempMax'];
        devices[device].hmdtyMin = jsonBuffer['hmdtyMin'];
        devices[device].hmdtyMax = jsonBuffer['hmdtyMax'];
        devices[device].lightSensMin = jsonBuffer['lightsensMin'];
        devices[device].lightSensMax = jsonBuffer['lightsensMax'];

        $('#' + device + 'ConfigParameters').empty();

        if ("sensors" in jsonBuffer) {
          initParameter(device, JSON.parse(jsonBuffer['sensors']), "sensors");
        }

        if ("actuators" in jsonBuffer) {
          initParameter(device, JSON.parse(jsonBuffer['actuators']), "actuators");
        }

        if ("kakuUnits" in jsonBuffer) {
          devices[device].kakuUnits = JSON.parse(jsonBuffer['kakuUnits']);

          $('#' + device + 'ConfigKakuUnits').empty();

          for (unit in devices[device].kakuUnits) {
            addCardToDeviceSection(device, unit, "Kaku");
            mqtt.subscribe(device + "/kaku/" + unit, {qos: 0});

            $('#' + device + 'ConfigKakuUnits').append($('<option>', {value:unit, text:"[" + unit + "] " + devices[device].kakuUnits[unit]}));
          }

          devices[device].kakuUnitsBuffer = Object.assign({}, devices[device].kakuUnits);
        }
      }
      break;
    case 'discovery':
      // Check if device is already in the selection box
      let discoveryDevices = document.getElementById("discoveryDevices");

      for (i = 0; i < discoveryDevices.options.length; i++) {
        if(discoveryDevices.options[i].value == payload) {
          return;
        }
      }

      // Check if the device is already added to dashboard
      for (existingDevice in devices.list) {
        if(devices.list[existingDevice] == payload) {
          return;
        }
      }

      // If device is new, add it to the selection box
      $('#discoveryDevices').append($('<option>', {value:payload, text:payload}));
      break;
    default: 
      console.log('Received data does not match any MQTT topic.'); 
      break;
  }
};

function addParametersToConfig(device) {
  let select = document.getElementById(device + 'ConfigAddParameter');
  let length = select.options.length;

  for (i = length-1; i >= 0; i--) {
    select.options[i] = null;
  }

  $('#' + device + 'ConfigAddParameter').append($('<option>', {value:"", text:"Select a parameter"}));

  sensors.forEach(function(sensor) {
    let paramName = getParamName(sensor);
    $('#' + device + 'ConfigAddParameter').append($('<option>', {value:sensor, text:paramName}));
  });

  actuators.forEach(function(actuator) {
    let paramName = getParamName(actuator);
    $('#' + device + 'ConfigAddParameter').append($('<option>', {value:actuator, text:paramName}));
  });
};

function subscribeToDevice(device) {
  mqtt.subscribe(device + '/status', {qos: 1});
  mqtt.subscribe(device + '/uptime', {qos: 0});
  mqtt.subscribe(device + '/config', {qos: 0});
  mqtt.subscribe(device + '/kaku', {qos: 0});
};

function unsubscribeFromDevice(device) {
  mqtt.unsubscribe(device + '/status');
  mqtt.unsubscribe(device + '/uptime');
  mqtt.unsubscribe(device + '/config');
  mqtt.unsubscribe(device + '/kaku');

  for (unit in devices[device].kakuUnits) {
    mqtt.unsubscribe(device + "/kaku/" + unit);
  }

  if(devices[device].sensors != null) {
    devices[device].sensors.forEach(function(sensor) {
      mqtt.unsubscribe(device + '/' + sensor);
    });
  }

  if(devices[device].actuators != null) {
    devices[device].actuators.forEach(function(actuator) {
      mqtt.unsubscribe(device + '/' + actuator);
    });
  }
};

function addDeviceToDashboard(device) {
  if(document.getElementById(device + "DeviceSection") == null) {
    // Create a copy of the template device section and insert it into the dashboard body
    let parentDiv = $("#dashboardBody");
    let template = $("#deviceSectionTemplate").html();
    let newDiv = $(template);
    newDiv.attr("id", device + "DeviceSection");
    newDiv.appendTo(parentDiv);
    
    let newDivHtml = $("#" + device + "DeviceSection").html();
    $("#" + device + "DeviceSection").html(newDivHtml.replace(/templateDevice/g, device));
  }
};

function addCardToDeviceSection(device, parameter, parameterType = "") {
  if(document.getElementById(device + parameter + parameterType + "Card") == null) {
    // Create a copy of the template kaku card and insert it into the device card body
    let parentDiv = $("#" + device + "CardBody");
    let template = $("#cardTemplate").html();
    let newDiv = $(template);
    newDiv.attr("id", device + parameter + parameterType + "Card");
    newDiv.appendTo(parentDiv);

    let paramName;
    let paramTopic;
    let paramIcon = getParamIcon(parameter);

    if(parameterType == "Kaku") {
      paramName = devices[device].kakuUnits[parameter];
      paramTopic = "kaku/" + parameter;
    } else {
      paramName = getParamName(parameter);
      paramTopic = parameter;
    }

    let newDivHtml = $("#" + device + parameter + parameterType + "Card").html();
    $("#" + device + parameter + parameterType + "Card").html(newDivHtml.replace(/templateDevice/g, device));
    newDivHtml = $("#" + device + parameter + parameterType + "Card").html();
    $("#" + device + parameter + parameterType + "Card").html(newDivHtml.replace(/templateParam/g, parameter + parameterType));
    newDivHtml = $("#" + device + parameter + parameterType + "Card").html();
    $("#" + device + parameter + parameterType + "Card").html(newDivHtml.replace(/templateName/g, paramName));
    newDivHtml = $("#" + device + parameter + parameterType + "Card").html();
    $("#" + device + parameter + parameterType + "Card").html(newDivHtml.replace(/templateTopic/g, paramTopic));
    $('#' + device + parameter + parameterType + "CardIcon").removeClass("fa-question").addClass(paramIcon);
  }
};

function addSparkCardToDeviceSection(device, parameter) {
  if(document.getElementById(device + parameter + "Card") == null) {
    // Create a copy of the template kaku card and insert it into the device card body
    let parentDiv = $("#" + device + "CardBody");
    let template = $("#sparkCardTemplate").html();
    let newDiv = $(template);
    newDiv.attr("id", device + parameter + "Card");
    newDiv.appendTo(parentDiv);

    devices[device][parameter + "History"] = [];

    let paramName = getParamName(parameter);
    let paramIcon = getParamIcon(parameter);

    let newDivHtml = $("#" + device + parameter + "Card").html();
    $("#" + device + parameter + "Card").html(newDivHtml.replace(/templateDevice/g, device));
    newDivHtml = $("#" + device + parameter + "Card").html();
    $("#" + device + parameter + "Card").html(newDivHtml.replace(/templateParam/g, parameter));
    newDivHtml = $("#" + device + parameter + "Card").html();
    $("#" + device + parameter + "Card").html(newDivHtml.replace(/templateName/g, paramName));
    $('#' + device + parameter + "CardIcon").removeClass("fa-question").addClass(paramIcon);
  }
};

function updateCard(device, cardName, payload, unit = "") {
  $('#' + device + unit + cardName + 'State').html('(Raw value: ' + payload + ')');

  if(payload == 'on') {
    $('#' + device + unit + cardName + 'Label').text('On');
    $('#' + device + unit + cardName + 'Label').removeClass('badge-danger').addClass('badge-success');
    $('#' + device + unit + cardName + 'Toggle').removeClass('fa-toggle-off').addClass('fa-toggle-on');
  } else {
    $('#' + device + unit + cardName + 'Label').text('Off');
    $('#' + device + unit + cardName + 'Label').removeClass('badge-success').addClass('badge-danger');
    $('#' + device + unit + cardName + 'Toggle').removeClass('fa-toggle-on').addClass('fa-toggle-off');
  }
};

function updateSparkCard(device, cardName, cardDesc, cardUnit, alertIcon, alertIconUnder, alertIconOver, valCurrent, valMin, valMax) {
  if(devices[device][cardName + "History"] == null) {
    devices[device][cardName + "History"] = [];
  }

  let historyBuffer = devices[device][cardName + "History"];
  
  $('#' + device + cardName + 'Raw').html('(Raw value: ' + valCurrent + ')');
          
  let deviceVal = parseFloat(valCurrent);
  let deviceValMin = parseFloat(valMin);
  let deviceValMax = parseFloat(valMax);
  let deviceValOld = historyBuffer.length >= 1 ? parseFloat(historyBuffer[historyBuffer.length - 1]) : undefined;

  if(deviceVal >= deviceValMin && deviceVal <= deviceValMax) {
    $('#' + device + cardName + 'Label').addClass('badge-secondary').removeClass('badge-danger');
    $('#' + device + cardName + 'Label').html(valCurrent + cardUnit);

    if(deviceValOld < deviceValMin || deviceValOld > deviceValMax) {
      addAlert(device + " " + cardDesc  + " has returned to within the normal limits", alertIcon);
    }
  } else {
    $('#' + device + cardName + 'Label').addClass('badge-danger').removeClass('badge-secondary');
    $('#' + device + cardName + 'Label').html('<i class="fas fa-exclamation-triangle"></i> ' + valCurrent + cardUnit);

    if(deviceVal < deviceValMin  && (deviceValOld == null || deviceValOld >= deviceValMin)) {
      addAlert(device + " " + cardDesc  + " is below the minimum threshold!", alertIconUnder);
    } else if(deviceVal > deviceValMax && (deviceValOld == null || deviceValOld <= deviceValMax)) {
      addAlert(device + " " + cardDesc  + " exceeds the maximum threshold!", alertIconOver);
    }
  } 

  historyBuffer.push(parseFloat(valCurrent));
  if(historyBuffer.length >= 30) {
    historyBuffer.shift();
  }

  $('.' + device + cardName + 'Sparkline').sparkline(historyBuffer, {
    type: 'line',
    width: calcSparkWidth(device, cardName),
    height: '40'});
};

function initDevice(device) {
  devices[device] = { deviceConnected: null, configRead: false, sensors: [], sensorsBuffer: [], actuators: [], actuatorsBuffer: [], kakuUnits: {}, kakuUnitsBuffer: {} };
  subscribeToDevice(device);
  addDeviceToDashboard(device);
};

function initParameter(device, parameters, parameterType) {
  devices[device][parameterType] = parameters;
  devices[device][parameterType + "Buffer"] = [];

  if(devices[device][parameterType] != null) {
    devices[device][parameterType].forEach(function(deviceParam) {
      if(parameterType == "sensors") {
        addSparkCardToDeviceSection(device, deviceParam);
      } else if(parameterType == "actuators") {
        addCardToDeviceSection(device, deviceParam);
      }
      addParameterToConfig(device, deviceParam);
      mqtt.subscribe(device + '/' + deviceParam, {qos: 0});
    });
  }

  devices[device][parameterType + "Buffer"]= devices[device][parameterType].slice();
};

function addDevice(device) {
  if(device != "") {
    if(devices.list.indexOf(device) == -1) {
      let tempList = [];
      
      if(localStorage[host] != null) {
        tempList = JSON.parse(localStorage[host]);
      }
      
      tempList.push(device);
      localStorage[host] = JSON.stringify(tempList);
      devices.list = JSON.parse(localStorage[host]);
      
      initDevice(device)
    } else {
      alert("Error: A device with this name already exists!");
    }
  }
};

function initDiscovery() {
  $('#discoveryDevices').empty();
  publishMessage('home-esp', '/discovery');
};

function addSelectedDevices() {
  $("#discoveryModal").modal("toggle");

  $("#discoveryDevices :selected").each(function() {
    addDevice($(this).val());
  });
};

function configureDevice(device, configTempMin, configTempMax, configHmdtyMin, configHmdtyMax, configLightSensMin, configLightSensMax, configKakuAddress) {
  if(parseInt(configTempMin) < parseInt(configTempMax) && parseInt(configHmdtyMin) < parseInt(configHmdtyMax) && parseInt(configLightSensMin) < parseInt(configLightSensMax)) {
    $("#" + device + "Modal").modal("toggle");

    let message = {'kakuAddress': configKakuAddress, 'kakuUnits': devices[device].kakuUnitsBuffer, 
                   'sensors': devices[device].sensorsBuffer, 'actuators': devices[device].actuatorsBuffer,
                   'tempMin': configTempMin, 'tempMax': configTempMax, 
                   'hmdtyMin': configHmdtyMin, 'hmdtyMax': configHmdtyMax,
                   'lightsensMin': configLightSensMin, 'lightsensMax': configLightSensMax};
                
    publishMessage(device, "/config/set", JSON.stringify(message));
  } else {
    alert("Error: The minimum threshold cannot be greater than or equal to the maximum threshold!");
  }
};

function removeDevice(device) {
  if(device != "") {
    // Unsubscribe from device topics
    unsubscribeFromDevice(device);

    // Remove device variables
    delete devices[device];

    // Remove device from the list
    let tempList = JSON.parse(localStorage[host]);
    const index = tempList.indexOf(device);
    if(index > -1) {
        tempList.splice(index, 1);
    }
    localStorage[host] = JSON.stringify(tempList);
    devices.list = JSON.parse(localStorage[host]);
    
    // Remove device from the dashboard
    document.getElementById(device + "DeviceSection").remove();
  }
};

function addKakuToConfig(device, unitNr, unitName) {
  if(Object.keys(devices[device].kakuUnitsBuffer).length < 5) {
    if(!(unitNr in devices[device].kakuUnitsBuffer)) {
      $('#' + device + 'ConfigKakuUnits').append($('<option>', {value:unitNr, text:"[" + unitNr + "] " + unitName}));
      $('#' + device + 'ConfigAddUnitForm').trigger("reset");
      devices[device].kakuUnitsBuffer[unitNr] = unitName;
    } else {
      alert("Error: A unit with this unit number already exists for this device!");
    }
  } else {
    alert("Error: You can't add more than 5 Click-On-Click-Off units to this device");
  }
};

function addParameterToConfig(device, parameter) {
  let paramType = sensors.indexOf(parameter) >= 0 ? "sensorsBuffer" : "actuatorsBuffer";
  if(devices[device].sensorsBuffer.length + devices[device].actuatorsBuffer.length < 8) {
    if(devices[device][paramType].indexOf(parameter) < 0) {
      let paramName = getParamName(parameter);

      $('#' + device + 'ConfigParameters').append($('<option>', {value:parameter, text:paramName}));
      devices[device][paramType].push(parameter);

      $('#' + device + 'ConfigAddParameter option[value=' + parameter + ']').remove();
    } else {
      alert("Error: This parameter already exists for this device!");
    } 
  } else {
    alert("Error: You can't add more than 8 parameters to this device");
  }
};

function removeSelectedKakuUnits(device) {
  $("#" + device + "ConfigKakuUnits :selected").each(function() {
    $("#" + device + "ConfigKakuUnits option[value='" + $(this).val() + "']").remove();
    delete devices[device].kakuUnitsBuffer[$(this).val()];
  });
};

function removeSelectedParameters(device) {
  $("#" + device + "ConfigParameters :selected").each(function() {
    let index = devices[device].sensorsBuffer.indexOf($(this).val());

    if (index >= 0) {
      devices[device].sensorsBuffer.splice(index, 1);
    } else {
      index = devices[device].actuatorsBuffer.indexOf($(this).val());

      if (index >= 0) {
        devices[device].actuatorsBuffer.splice(index, 1);
      }
    }

    let paramName = getParamName($(this).val());

    $('#' + device + 'ConfigAddParameter').append($('<option>', {value:$(this).val(), text:paramName}));
    $("#" + device + "ConfigParameters option[value='" + $(this).val() + "']").remove();
  });
};

function addAlert(message, icon) {
  // Create a copy of the alert template and insert it into the alert body
  let parentDiv = $("#alertBody");
  let template = $("#alertItemTemplate").html();
  let newDiv = $(template);
  newDivId = "alertItem" + alertCounter;
  newDiv.attr("id", newDivId);
  newDiv.prependTo(parentDiv);
  
  let newDivHtml = $("#alertItem" + alertCounter).html();
  $("#alertItem" + alertCounter).html(newDivHtml.replace(/templateAlertItem/g, newDivId));

  // Add content to the new alert item
  let today = new Date();
  let timestamp = today.toLocaleDateString() + " - " + ("0" + today.getHours()).slice(-2) + ":" + ("0" + today.getMinutes()).slice(-2) + ":" + ("0" + today.getSeconds()).slice(-2);
  document.getElementById(newDivId + "Time").textContent = timestamp;
  $("#" + newDivId + "Content").html(message);
  $("#" + newDivId + "Icon").html('<i class="' + icon + '"></i>');
  $('#' + newDivId).addClass("dropdown-item");

  alertCounter++;
  alerts.unshift(newDivId);

  // Remove the oldest alert if there are more than 5 alerts
  if(alerts.length > 20) {
    let oldAlert = alerts.pop();
    document.getElementById(oldAlert).remove();
  }

  document.getElementById("alertBadge").textContent = parseInt(alerts.length);
};

function clearAlerts() {
  alerts.forEach(alert => document.getElementById(alert).remove());
  document.getElementById("alertBadge").textContent = "";
  alerts = [];
};

function calcSparkWidth(device, parameter) {
  let size;

  try {
    size = document.getElementById(device + parameter + 'CardBody').clientWidth - 
           document.getElementById(device + parameter +  'CardTitle').clientWidth - 
           document.getElementById(device + parameter +  'CardBadge').clientWidth - 
           document.getElementById(device + parameter +  'CardIcon').clientWidth - 80;
  }
  catch {
    if(verboseMode){
      console.error("Unable to calculate proper width for " + parameter + " of " + device);
    }
    size = 130;
  }

  return size;
};

function updateSparkline(device) {
  devices[device].sensors.forEach(function(parameter){
    $('.' + device + parameter + 'Sparkline canvas').css("width", calcSparkWidth(device, parameter));
  });
};

function toggleVerboseMode(isEnabled) {
  verboseMode = isEnabled;

  if(verboseMode) {
    console.log("Verbose logging enabled");
    $('#dropDownVerboseEnable').addClass('hidden');
    $('#dropDownVerboseDisable').removeClass('hidden');
  } else {
    console.log("Verbose logging disabled");
    $('#dropDownVerboseEnable').removeClass('hidden');
    $('#dropDownVerboseDisable').addClass('hidden');
  }
};

function getParamName(parameter) {
  switch(parameter){
    case "temp":
      return "Temperature";
    case "hmdty":
      return "Humidity";
    case "lightsens":
      return "Light Intensity";
    case "light":
      return "LED";
    default:
      return "";
  }
}

function getParamIcon(parameter) {
  switch(parameter){
    case "temp":
      return "fa-temperature-high";
    case "hmdty":
      return "fa-humidity";
    case "lightsens":
      return "fa-sun";
    case "light":
      return "fa-lightbulb";
    default:
      return "fa-plug";
  }
}

$(document).ready(function() {
  document.getElementById("installButton").addEventListener('click', () => {
    $('#installButton').addClass('hidden');
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice
    .then((choiceResult) => {
      deferredPrompt = null;
    });
  });

  document.getElementById("dropDownClearAlerts").addEventListener('click', () => {
    clearAlerts();
  });

  document.querySelectorAll('.discovery-refresh').forEach(function(element) {
    element.addEventListener('click', () => {
      initDiscovery();
    });
  });

  document.getElementById("dropDownVerboseEnable").addEventListener('click', () => {
    toggleVerboseMode(true);
  });

  document.getElementById("dropDownVerboseDisable").addEventListener('click', () => {
    toggleVerboseMode(false);
  });

  document.getElementById("dropDownLogout").addEventListener('click', () => {
    window.location.reload();
  });
  
  // Add event listener for the PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default install prompt of the browser
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI with install button on navbar
    $('#installButton').removeClass('hidden');
  });

  // Register service worker, if it is supported by the browser
  if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
    .catch(function(error) {
      if(verboseMode){
        console.error('Service worker registration failed, error:', error);
      }
    });
  }

  // Prefill host/port
  if(localStorage["host"] != null) {
    document.getElementById("loginHost").value = localStorage["host"];
    document.getElementById("loginPort").value = localStorage["port"];
    document.getElementById("loginSSL").checked = localStorage["useSSL"] === "true";
    document.getElementById("loginRemember").checked = true;
  }
});