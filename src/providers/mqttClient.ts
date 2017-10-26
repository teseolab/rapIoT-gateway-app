/*
  This file contains a provider to handle the mqtt connection. Mainly it is a
  client that will send and recieve messages to the server broker which is read
  by the cloud app.
*/

import { Injectable } from '@angular/core';
import { BackgroundFetch } from '@ionic-native/background-fetch';
import { Alert, AlertController, Events } from 'ionic-angular';
import * as mqtt from 'mqtt';

import { Logger } from './logger.service';
import { TilesApi } from './tilesApi.service';
import { CommandObject, Device, LoginData, UtilsService } from './utils.service';


@Injectable()
export class MqttClient {
  public client;
  public mqttConnectionData: LoginData;
  private publishOpts = { retain: true };
  private connectionTimeout: number = 10000; // 10 seconds
  private errorAlert: Alert;
  constructor(private alertCtrl: AlertController,
              public backgroundFetch: BackgroundFetch,
              private events: Events,
              public logger: Logger,
              public tilesApi: TilesApi,
              public utils: UtilsService) {
    this.setConnectionData();
    // Configure background check for IOS, we are not sure if this plugin
    // is working as we haven't been able to test it.
    this.backgroundFetch.configure({ stopOnTerminate: false })
        .then(() => {
          if (this.mqttConnectionData.user !== undefined ||
              this.mqttConnectionData.host !== undefined ||
              this.mqttConnectionData.port !== undefined ) {
            this.connect();
            this.backgroundFetch.finish();
          }
        })
        .catch(err => {
          console.log('Error initializing background fetch', err);
        });
    // Create a standard error-alert to show when something goes wrong
    this.errorAlert = this.alertCtrl.create({
     buttons: [{
        text: 'Dismiss',
      }],
      enableBackdropDismiss: true,
      subTitle: 'An error occured with the mqtt client that is responsible' +
                'for sending and recieving messages to the application.' +
                'Make sure the host address and port is correct. \n',
      title: 'Mqtt error',
    });
  }

  /**
   * Set the connection information
   * @param {LoginData} mqttConnectionData - the login credentials
   */
  public setConnectionData = (mqttConnectionData: LoginData = null): void => {
      this.mqttConnectionData = mqttConnectionData === null
                              ? this.tilesApi.getLoginData()
                              : this.mqttConnectionData = mqttConnectionData;
  }

  /**
   * Returns a subscription topic for the specific device
   * @param {string} deviceId - the ID of the device
   * @param {boolean} isEvent - true if we are sending an event
   */
  public getDeviceSpecificTopic = (deviceId: string, isEvent: boolean): string => {
    const type = isEvent ? 'evt' : 'cmd';
    const activeApp = this.tilesApi.getActiveApp();
    return `tiles/${type}/${this.mqttConnectionData.user}/${activeApp._id}/${deviceId}`;
  }

  /**
   * Create a connection to the server and return a javascript promise
   * @param {string} user - the user name
   * @param {string} host - the host url / ip
   * @param {number} port - the port to send to
   */
  public connect = (): void => {
    if (this.mqttConnectionData === undefined ||  this.mqttConnectionData === null) {
      this.setConnectionData();
    }

    // Check if a previous server connection exists and end it if it does
    if (this.client) {
      this.client.end();
    }

    // Instantiate a mqtt-client from the host and port
    this.client = mqtt.connect({
      host: this.mqttConnectionData.host,
      port: this.mqttConnectionData.port,
      keepalive: 0, // tslint:disable-line
    });

    // Handle events being sent from the broker on topics the client is subscribed to
    this.client.on('message', (topic, message) => {
      try {
        const response = JSON.parse(message);
        const command: CommandObject = new CommandObject(response.name, response.properties);
        if (command) {
          const virtualTileName = topic.split('/')[4];
          const logEntry = `Got message from cloud to device: ${virtualTileName} ${this.utils.getCommandObjectAsString(command)}`;
          this.logger.addToLog(logEntry);
          this.events.publish('command', virtualTileName, command);
        }
      } finally {} // tslint:disable-line
    });

    this.client.on('error', error => {
      this.logger.addToLog('MQTT-error occured');
      this.errorAlert.present();
    });

    this.client.on('connect', () => {
      clearTimeout(failedConnectionTimeout);
      this.events.publish('serverConnected');
      this.logger.addToLog('Connected to MQTT-broker');
    });

    this.client.on('offline',   () => this.logger.addToLog('MQTT-broker offline'));
    this.client.on('close',     () => this.logger.addToLog('Closed connection to MQTT-broker'));
    this.client.on('reconnect', () => this.logger.addToLog('MQTT-broker reconnecting'));

    // Ends the connection attempt if the timeout rus out
    const failedConnectionTimeout = setTimeout(() => {
      if (this.client) {
        this.client.end();
      }
    }, this.connectionTimeout);
  }

  /**
   * Register a device as active at the server and subscribe to messages
   * for the device topic
   * @param {Device} device - the device to register
   */
  public registerDevice = (device: Device): void => {
    if (this.client) {
      const virtualTiles = this.tilesApi.getConnectedVirtualTiles(device.tileId);
      virtualTiles.forEach(tile => {
        this.client.publish(
          this.getDeviceSpecificTopic(device.tileId, true) + '/active',
          'true',
          this.publishOpts,
        );
        this.client.publish(
          this.getDeviceSpecificTopic(device.tileId, true) + '/name',
          tile.virtualName,
          this.publishOpts,
        );
        this.client.subscribe(
          this.getDeviceSpecificTopic(device.tileId, false),
        );
      });
    }
  }

  /**
   * Set the device to inctive at the server and unsubscribe to messages
   * from the device
   * @param {Device} device - the device to unregister
   */
  public unregisterDevice = (device: Device): void => {
    if (this.client) {
      this.client.publish(
        this.getDeviceSpecificTopic(device.tileId, true) + '/active',
        'false',
        this.publishOpts,
      );
      this.client.unsubscribe(
        this.getDeviceSpecificTopic(device.tileId, false),
      );
    }
  }

  /**
   * Send an event to the server
   * @param {string} deviceId - the ID of the device to register
   * @param {CommandObject} event - An event represented as a CommandObject (name, params...)
   */
  public sendEvent = (deviceId: string, event: CommandObject): void => {
    if (this.client) {
      const virtualTiles = this.tilesApi.getConnectedVirtualTiles(deviceId);
      // publish the event to the device topic which is listened to by the server-application
      virtualTiles.forEach(tile => {
        event.name = tile.virtualName;
        this.client.publish(
          this.getDeviceSpecificTopic(deviceId, true),
          JSON.stringify(event),
          this.publishOpts,
          err => {
            if (err !== undefined) {
              this.errorAlert.present();
            }
          },
        );
      });
    } else {
      this.errorAlert.present();
    }
  }

  /**
   * Run a background update for IOS. This will run every 15 minutes at most and less when
   * the phone thinks it is less likely to be used (at night, etc.). There is nothing to do to
   * make it run more often as this is set by apple. (As of 22.03.2017)
   */
  public startBackgroundFetch = () => {
    this.backgroundFetch.start();
  }

  /**
   * Stop background update for IOS
   */
  public stopBackgroundFetch = () => {
    this.backgroundFetch.stop();
  }
}
