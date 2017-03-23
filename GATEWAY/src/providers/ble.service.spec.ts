import { inject, TestBed, async } from '@angular/core/testing';
import { Http, BaseRequestOptions } from '@angular/http';
import { MockBackend } from '@angular/http/testing';
import { Events } from 'ionic-angular';
import { Storage } from '@ionic/storage';
import { TilesApi } from './tilesApi.service';
import { MqttClient } from './mqttClient';
import { BleService } from './ble.service';
import { DevicesService }from './devices.service';
import { UtilsService }from './utils.service';
import { StorageMock } from '../mocks';
import { BLE } from 'ionic-native';
import { Observable } from 'rxjs';

import * as bleReturnValue from '../fixtures/bleDevice.json';
import * as virtualTile from '../fixtures/virtualTIle.json';

describe('bleService', () => {

  let bleService: BleService = null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        Events,
        {
          provide: Storage,
          useClass: StorageMock
        },
        MockBackend,
        BaseRequestOptions,
        {
          provide : Http,
          useFactory: (backendInstance: MockBackend, defaultOptions: BaseRequestOptions) => {
            return new Http(backendInstance, defaultOptions);
          },
          deps: [MockBackend, BaseRequestOptions],
        },
        DevicesService,
        UtilsService,
        TilesApi,
        MqttClient,
        BleService,
        BLE,
      ],
    });
  });

  beforeEach(inject([BleService], (temp: BleService) => {
    bleService = temp;
  }));

  afterEach(() => {
    bleService = null;
  });

  it('should create an instance of the BleService', () => {
    expect(bleService).toBeTruthy;
  });

  describe('scanForDevices(virtualTiles: VirtualTile[]): void', () => {
    it('should check if BLE is enabled, scan for BLE-devices and have the tilesApi convert and store them', () => {
      spyOn(bleService, 'scanBLE').and.returnValue(Observable.of(bleReturnValue));
      bleService.scanForDevices([virtualTile]);
      expect(bleService['scanBLE']).toHaveBeenCalled;
    });
  });

  describe('scanBLE(virtualTiles: VirtualTile[]): void', () => {
    it('should scan for BLE-devices and have the tilesApi convert and store them', () => {
      spyOn(BLE, 'scan').and.returnValue(Observable.of(bleReturnValue));
      bleService.scanBLE([virtualTile]);
      expect(BLE['scan']).toHaveBeenCalled;
    });
  });

  describe('connect(device: Device): void', () => {

  });

  describe('startDeviceNotification(device: Device): void', () => {

  });

  describe('disconnect(device: Device): void', () => {

  });

  describe('sendData(device: Device, dataString: string): void', () => {

  });

});