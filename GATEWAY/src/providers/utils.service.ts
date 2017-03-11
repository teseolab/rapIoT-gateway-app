import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { Events } from 'ionic-angular';

/** 
 * Class to describe the structure of a command 
 */
export class CommandObject {
  name: string;
  properties: string;
}

/**
 * Class for the devices, this makes it possible to specify the
 * device type in typescript to avoid getting invalid device-objects
 */
export class Device {
  id: string;
  tileId: string; // IOS and android gets different id from the ble, so we use the tilename as a seond id
  name: string;
  connected: boolean;
  ledOn: boolean;
  buttonPressed?: boolean;
  loading: boolean;
}

/**
 * Class to describe the structure of a virtual tile
 */
export class VirtualTile {
  _id: string;
  virtualName: string;
  application: string;
  tile: any;
  __v: number;
}


@Injectable()
export class UtilsService {
  constructor(public storage: Storage,
              public events: Events) {

  };

  /**
   * Convert a string to an attay of bytes
   */
  convertStringtoBytes = (str: String): any => {
    try {
      console.log('Attempting to send data to device via BLE.');
      let dataArray = new Uint8Array(str.length);
      for(let i = 0; i < str.length; i ++){
        dataArray[i] = str.charCodeAt(i);
      }
      return dataArray;
    } catch (err) {
      console.log('Converting string of data to bytes unsuccessful!')
      return null;
    };
  };

  /** 
   * Create a new object that has all the attributes from both inputobjects
   * @param {any} obj1 - The first object
   * @param {any} obj2 - The second object
   */
  extendObject = (obj1: any, obj2: any): any => {
    let extended = {};
    for (let attrname of obj1) {
      extended[attrname] = obj1[attrname];
    }
    for (let attrname of obj2) {
      if (extended[attrname] !== undefined) {
        extended[attrname] = obj2[attrname];
      } else {
        // Adds a 1 to the key if the key already exists
        extended[attrname + '1'] = obj2[attrname];
      }
    }
    return extended;
  };
};

export default { CommandObject, Device, UtilsService, VirtualTile };
