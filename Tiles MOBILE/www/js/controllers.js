'use strict';

/* Controllers */

angular.module('tiles.controllers', [])

.controller('TilesCtrl', ['$scope', '$ionicPopup', '$timeout', 'mqttClient', 'tilesApi', function($scope, $ionicPopup, $timeout, mqttClient, tilesApi) {

    var serverConnectionTimeout = 10000; // 10 seconds

    $scope.connectedToServer = false;
    $scope.serverConnectStatusMsg = 'Click to connect to server';
    
    $scope.mqttConnectionData = {
        username: tilesApi.username,
        host: tilesApi.host.address,
        port: tilesApi.host.mqttPort
    }

    // Called when the client has connected to a broker
    $scope.$on('connect', function(){
        setServerConnectionStatus('Connected to ' + tilesApi.host.address + ':' + tilesApi.host.mqttPort, true);
        for (var i = 0; i < $scope.devices.length; i++) {
            var device = $scope.devices[i];
            if (device.connected) {
                mqttClient.registerDevice(device.id);
            }
        }
    });

    // Called when a command is received from the broker
    $scope.$on('command', function(event, deviceId, command){
        for (var i = 0; i < $scope.devices.length; i++) {
            var device = $scope.devices[i];
            if (device.id == deviceId) {
                device.ledOn = (command.activation == 'on');
                $scope.$apply();
                $scope.sendData(device);
            }
        }
    });

    $scope.$on('offline', function() {
        setServerConnectionStatus('Client gone offline', false);
    });

    $scope.$on('close', function() {
        setServerConnectionStatus('Disconnected from server', false);
    });

    $scope.$on('reconnect', function(){
        setServerConnectionStatus('A reconnect is started', false);
    });

    $scope.$on('error', function(event, error){
        setServerConnectionStatus('Error: ' + error, false);
    });

    $scope.showConnectMQTTPopup = function() {
        var serverConnectionPopup = $ionicPopup.show({
            template: 'Username:<input type="text" ng-model="mqttConnectionData.username">Host:<input type="text" ng-model="mqttConnectionData.host">Port:<input type="number" ng-model="mqttConnectionData.port">',
            title: 'Connect to MQTT broker',
            subTitle: 'Enter username, host address and port number',
            scope: $scope,
            buttons: [{
                text: 'Cancel'
            }, {
                text: '<b>Connect</b>',
                type: 'button-positive',
                onTap: function(e) {
                    tilesApi.setUsername($scope.mqttConnectionData.username);
                    tilesApi.setHostAddress($scope.mqttConnectionData.host);
                    tilesApi.setHostMqttPort($scope.mqttConnectionData.port);
                    
                    // Connect to MQTT server/broker
                    mqttClient.connect($scope.mqttConnectionData.host, $scope.mqttConnectionData.port);
                    setServerConnectionStatus('Connecting...', false);
                    $timeout(function() {
                        if (!$scope.connectedToServer) {
                            setServerConnectionStatus('Failed to connect to server', false);
                            mqttClient.endConnection();
                        }
                    }, serverConnectionTimeout);
                }
            }]
        });
    };

    function getDeviceSpecificTopic(deviceId, isEvent){
        var type = isEvent ? 'evt' : 'cmd';
        return 'tiles/' + type + '/' + tilesApi.username + '/' + deviceId;
    }

    function setServerConnectionStatus(msg, connected){
        console.log(msg);
        $scope.serverConnectStatusMsg = msg;
        $scope.connectedToServer = connected;
    }

    $scope.devices = [
        /*{'name': 'TI SensorTag','id': '01:23:45:67:89:AB', 'rssi': -79, 'advertising': null},
        {'name': 'Some OtherDevice', 'id': 'A1:B2:5C:87:2D:36', 'rssi': -52, 'advertising': null}*/
    ];

    var rfduino = {
        serviceUUID: '2220',
        receiveCharacteristic: '2221',
        sendCharacteristic: '2222',
        disconnectCharacteristic: '2223'
    };

    var arrayBufferToString = function(buf) {
        return String.fromCharCode.apply(null, new Uint8Array(buf));
    };

    var DataReceiver = function DataReceiver(device) {
        this.onData = function(data) { // Data received from RFduino
            var receivedEventAsString = arrayBufferToString(data);
            console.log('Received event: ' + receivedEventAsString);
            
            if (receivedEventAsString === 'btnON') {
                device.buttonPressed = true;
                $scope.$apply();
            } else if (receivedEventAsString === 'btnOFF') {
                device.buttonPressed = false;
                $scope.$apply();
            }

            var message = tilesApi.getEventMapping(device.id, receivedEventAsString);
            if (message == null) {
                console.log('No mapping found for event: ' + receivedEventAsString + ' from ' + device.id);
            } else {
                console.log('JSON Message to be sent: ' + JSON.stringify(message));
                mqttClient.sendEvent(device.id, message);
            }
            
        }
    }

    var isNewDevice = function(discoveredDevice) {
        for (var i = 0; i < $scope.devices.length; i++) {
            if ($scope.devices[i].id == discoveredDevice.id) return false;
        }
        return true;
    }

    var app = {
        onDiscoverDevice: function(device) {
            console.log('Device discovered: '+device);
            device.connected = false;
            if (isNewDevice(device)) {
                $scope.devices.push(device);
            }
        },
        onError: function(reason) {
            alert('ERROR: ' + reason);
        }
    };

    $scope.sendData = function(device) { // Send data to RFduino
        var success = function() {
            console.log('Data sent successfully.');
        };

        var failure = function() {
            alert('Failed writing data to the RFduino');
        };

        var data = new Uint8Array(1);
        data[0] = device.ledOn ? 0x1 : 0x0;

        ble.writeWithoutResponse(device.id, rfduino.serviceUUID, rfduino.sendCharacteristic, data.buffer, success, failure);
    };

    $scope.doRefresh = function() {
        // Scan for devices if Bluetooth is enabled.
        // Otherwise, prompt the user to enable Bluetooth.
        ble.isEnabled(
            function() {
                console.log("Bluetooth is enabled");
                ble.scan([], 5, app.onDiscoverDevice, app.onError); // Scan for devices
            },
            function() {
                console.log("Bluetooth is NOT enabled");
                ble.enable(function() {
                    console.log("Bluetooth has been enabled");
                }, function() {
                    console.log("Bluetooth is still NOT enabled");
                });
            }
        );

        $scope.$broadcast('scroll.refreshComplete');
    };

    $scope.connect = function(device) {
        ble.connect(device.id,
            function() {
                device.ledOn = false;
                device.connected = true;
                tilesApi.loadEventMappings(device.id);
                var receiver = new DataReceiver(device);
                ble.startNotification(device.id, rfduino.serviceUUID, rfduino.receiveCharacteristic, receiver.onData, app.onError);
                $scope.$apply();
                mqttClient.registerDevice(device.id);
            },
            function() {
                alert('Failure!')
            });
    };

    $scope.disconnect = function(device) {
        ble.disconnect(device.id,
            function() {
                device.connected = false;
                $scope.$apply();
                mqttClient.unregisterDevice(device.id);
            },
            function() {
                alert('Failure!')
            });
    };

    $scope.fetchEventMappings = function(device) {
        tilesApi.fetchEventMappings(device.id, function(fetchedEventMappings){
            alert(JSON.stringify(fetchedEventMappings));
        });
    }

}]);