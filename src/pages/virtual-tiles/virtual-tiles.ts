/*
  This file contains the superficial logic for the virtual tiles page
*/

import { Component } from '@angular/core';
import { AlertController, Events, NavController, NavParams } from 'ionic-angular';

import { BleService } from '../../providers/ble.service';
import { DevicesService } from '../../providers/devices.service';
import { TilesApi } from '../../providers/tilesApi.service';
import { Application, Device, UtilsService, VirtualTile } from '../../providers/utils.service';
/*
  Generated class for the VirtualTiles page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/

@Component({
  selector: 'page-virtual-tiles',
  templateUrl: 'virtual-tiles.html',
})
export class VirtualTilesPage {
  public applicationTitle: string;
  public virtualTiles: VirtualTile[];
  public activeApp: Application;
  public appOnlineStatusMsg: string;
  private devices: Device[];

  constructor(public alertCtrl: AlertController,
              public events: Events,
              public navCtrl: NavController,
              public navParams: NavParams,
              public bleService: BleService,
              public devicesService: DevicesService,
              public utils: UtilsService,
              public tilesApi: TilesApi) {
    this.events.subscribe('updateDevices', () => {
      this.devices = this.devicesService.getDevices();
      this.setVirtualTiles();
    });
  }

  /**
   * Called when the refresher is triggered by pulling down on the view of
   * virtualTiles
   */
  public refreshVirtualTiles = (refresher: any): void => {
    this.devices = this.devicesService.getDevices();
    this.setVirtualTiles();
    this.bleService.checkBleEnabled();
    // Makes the refresher run for 1.25 secs
    setTimeout(() => {
      refresher.complete();
    }, 2000);
  }

  /**
   * Called when the pair button is pushed on the view of the the
   * the virtual tiles.
   * @param {VirtualTile} virtualTile - the target device
   */
  public pairTilePopUp = (virtualTile: VirtualTile): void => {
    const deviceRadioButtons = this.devices.map(device => {
      return {type: 'radio', name: 'deviceId', value: device.tileId, label: device.name};
    });
    if (this.devices.length > 0) {
      this.alertCtrl.create({
      title: 'Pair to physical tile',
      inputs: deviceRadioButtons, // tslint:disable-line
      buttons: [{ // tslint:disable-line
        text: 'Cancel',
        role: 'cancel', // tslint:disable-line
        },
        {
          text: 'Pair',
          handler: data => { // tslint:disable-line
            this.tilesApi.pairDeviceToVirtualTile(data, virtualTile._id)
                                    .then(res => this.setVirtualTiles());
          },
        }],
      }).present();
    } else {
      this.alertCtrl.create({
        buttons: ['Dismiss'],
        message: 'No physical tiles nearby.',
        title: 'Pair to physical tile' }).present();
    }
  }

  /**
   * Called when the unpair button is pushed from the
   * virtual tiles view.
   * @param {VirtualTile} virtualTile - the target device
   */
  public unpairTile = (virtualTile: VirtualTile): void => {
    this.tilesApi.pairDeviceToVirtualTile(null, virtualTile._id)
                           .then(res => this.setVirtualTiles());
  }

  /**
   * Toggle the appOnline for the application on/off. Prompts for info
   * about action and also changes the text on the button.
   */
  public toggleAppOnline = (): void => {
    let descriptionMsg = 'Are you sure you wish to ' + (this.activeApp.appOnline ? 'stop the currently running ' : 'start the currently stopped ') + 'application?';
    let confirm = this.alertCtrl.create({
      title: this.activeApp.appOnline ? 'Stop Application?' : 'Start Application?',
      message: descriptionMsg, // tslint:disable-line
      buttons: [
        {
          text: 'Cancel',
          handler: () => { // tslint:disable-line
            console.log('Cancel clicked');
          },
        },
        {
          text: this.activeApp.appOnline ? 'Stop' : 'Start',
          handler: () => { // tslint:disable-line
            this.tilesApi.toggleAppOnline(this.activeApp).then(res => {
              this.appOnlineStatusMsg = res.appOnline ? 'Stop Application' : 'Start Application';
            });
          },
        },
      ],
    });
    confirm.present();
  }

  /**
   * Called when the page has entered. Updates devices lists
   */
  public ionViewWillEnter = () => {    // A id variable is stored in the navParams, and .get set this value to the local variable id
    this.activeApp = this.navParams.get('app');
    this.tilesApi.setActiveApp(this.navParams.get('app'));
    this.appOnlineStatusMsg = this.activeApp.appOnline ? 'Stop application' : 'Start application';
    // Sets the title of the page (found in virtual-tiles.html) to id, capitalized.
    this.applicationTitle = this.utils.capitalize(this.activeApp._id);
    this.devices = this.devicesService.getDevices();
    this.setVirtualTiles();
    this.bleService.checkBleEnabled();
  }

  /**
   * Set the virtual tiles equal to the ones stores for the app
   */
  private setVirtualTiles = (): void => {
    // We want to set the virtual tiles before getting as the database (ex pairing) might have changed
    this.tilesApi.setVirtualTiles().then(res => {
      this.virtualTiles = this.tilesApi.getVirtualTiles();
    });
  }

}

