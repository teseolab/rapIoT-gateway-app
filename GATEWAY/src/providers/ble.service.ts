import { Injectable } from '@angular/core';
import { BLE } from 'ionic-native';
import { Events } from 'ionic-angular';
import 'rxjs/add/operator/toPromise';

import { MqttClient } from './mqttClient';
import { TilesApi, CommandObject } from './tilesApi.service';
import { Device }from './devices.service';

@Injectable()
export class BleService {

	rfduino = {
    serviceUUID: '2220',
    receiveCharacteristicUUID: '2221',
    sendCharacteristicUUID: '2222',
    disconnectCharacteristicUUID: '2223'
  };

  mockDevices = [
  	{'name': 'TI SensorTag','id': '01:23:45:67:89:AB', 'rssi': -79, 'advertising': null},
  	{'name': 'Some OtherDevice', 'id': 'A1:B2:5C:87:2D:36', 'rssi': -52, 'advertising': null}
  ];


  constructor(public events: Events,
              private mqttClient: MqttClient,
  						private tilesApi: TilesApi) {
  };

  /** 
   * Send data to a device using BLE
	 * @param {Device} device - the target device
	 * @param {string} dataString - the string of data to send to the device
	 */
  sendData = (device: Device, dataString: string) => {
  	try {
  	  	console.log('Attempting to send data to device via BLE.');

  	  	// Turns the dataString into an array of bytes
  	  	let dataArray = new Uint8Array(dataString.length);
  	  	for(let i = 0, l = dataString.length; i < l; i ++){
  	  		dataArray[i] = dataString.charCodeAt(i);
        }
      console.log('Bytes: ' + dataArray.length);

	  	// Attempting to send the array of bytes to the device
	  	BLE.writeWithoutResponse(device.id,
	  													 this.rfduino.serviceUUID,
	  													 this.rfduino.sendCharacteristicUUID,
	  													 dataArray.buffer)
			  		  .then( res => alert('Success sending the string: ' + dataString))
			  		  .catch( err => console.log('Failed when trying to send daata to the RFduino'));
  	} finally {};
  };

  /** 
   * Checking if bluetooth is enabled and enable on android if not
   */
  doRefresh = () => {
  	BLE.isEnabled()
		  		  .then( res => {
		   		 		console.log('Bluetooth is enabled');
		   		 		this.scanForDevices();
		   		 	})
		  		  .catch( err => {
		  		 		console.log('Bluetooth not enabled!');
		  		 		// NB! Android only!! IOS users has to be told to turn bluetooth on
		  		 		BLE.enable()
				  		 			  .then( res => console.log('Bluetooth has been enabled'))
				  		 			  .catch( err => console.log('Failed to enable bluetooth'));
		  		  });
  };

  /** 
   * Checking to see if any bluetooth devices are in reach
   */
  scanForDevices = () => {
		// The first param is the UUIDs to discover, this might
 		// be specified to only search for tiles.
 		return BLE.scan([], 30);
  };

  /**
   * Update the name of a device
	 * @param {Device} device - the target device
	 * @param {string} newName - The new name
	 */
  updateName = (device: Device, newName: string) => {
  	BLE.disconnect(device.id)
			  		.then( res => {
			  		 	device.connected = false;
			  		 	this.mqttClient.unregisterDevice(device);
			  		 	device.name = newName;
			  		 	this.connect(device);
			  		})
			  		.catch(err => console.log('Failed to update the name of device: ' + device.name));
  };

  /** 
   * Connect to a device
	 * @param {Device} device - the target device
	 */
  connect = (device: Device) => {
    //TODO: unsubscribe at some point
    //alert('connecting to device: ' + device.name)
  	BLE.connect(device.id)
  		  .subscribe( 
          res => {
    		  	// Setting information about the device
  	  		 	device.ledOn = false;
  	  		 	device.connected = true;
            device.buttonPressed = false;
  	        this.tilesApi.loadEventMappings(device.id);
            this.mqttClient.registerDevice(device);
            this.startDeviceNotification(device);
        },
        err => {
          console.log('Failed to connect to device ' + device.name)
        },
        () => {
          console.log('Connection attempt completed')
        });
  };

  /** 
   * Start getting notifications of events from a device
   * @param {Device} device - the id from the target device
   */
  startDeviceNotification = (device: Device) => {
    //alert('Starting notifications from device: ' + device.name);
    //TODO: unsubscribe at some point. Could return the subscriber and unsubscribe after a timeout
    BLE.startNotification(device.id, this.rfduino.serviceUUID, this.rfduino.receiveCharacteristicUUID)
      .subscribe( 
        res => {
          // Convert the bytes sent from the device into a string
          const responseString = ((String.fromCharCode.apply(null, new Uint8Array(res))).slice(0, -1)).trim();
          let message: CommandObject = this.tilesApi.getEventStringAsObject(responseString);
          //alert('Recieved event: ' + message.name + ' with properties: ' + message.properties);
          if (message === null) {
            alert('Found no mapping for event: ' + responseString);
          } else {
            // Switch on the event type of the message
            const eventType = message.properties[0];
            switch (eventType){
              case 'tap':
                device.buttonPressed = device.buttonPressed !== undefined
                                      ? !device.buttonPressed : true;
                alert('tappeti tap')
                break;
              case 'tilt':
                alert('You are tilting me!');
                break;
              default:
                alert('No response for ' + message.properties[0])
                break;
            }
            this.mqttClient.sendEvent(device.id, message);
          }
        },
        err => {
          console.log('Failed to start notification');
        },
        () => {
          console.log('Finished attempt to start getting notifications from device with id: ' + device.id);
        });
  };

  /** 
   * Disconnect from device
	 * @param {Device} device - the target device
	 */
  disconnect = (device: Device) => {
  	BLE.disconnect(device.id)
  					.then( res => {
  						device.connected = false;
  						this.mqttClient.unregisterDevice(device);
  					})
  					.catch( err => console.log('Failed to disconnect'))
  };
}

export default { BleService }
