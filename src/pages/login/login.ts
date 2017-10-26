/*
  This file contains the superficial logic for the login page
*/

import { Component } from '@angular/core';
import { Storage } from '@ionic/storage';
import { AlertController, ViewController } from 'ionic-angular';

import { MqttClient } from '../../providers/mqttClient';
import { TilesApi } from '../../providers/tilesApi.service';
import { LoginData, UtilsService } from '../../providers/utils.service';

@Component({
  selector: 'page-login',
  templateUrl: 'login.html',
})
export class LoginPage {
  public loginInfo = { user: '', host: '178.62.99.218', port: '8080', remember: false };

  constructor(private alertCtrl: AlertController,
              private mqttClient: MqttClient,
              private storage: Storage,
              private tilesApi: TilesApi,
              private utils: UtilsService,
              public viewCtrl: ViewController) {}

  /**
   * Connect to the mqttServer
   * @param {string} user - username
   * @param {string} host - api host address
   * @param {number} port - mqtt port number
   * @param {boolean} remember - if the login credentials should be remembered
   */
  public connectToServer = (user: string, host: string, port: number, remember: boolean): void => {
    if (this.utils.verifyLoginCredentials(user, host)) {
      this.tilesApi.isTilesUser(user, host).then(data => {
        if (data) {
          const loginData = new LoginData(user, host, port, remember);
          this.storage.set('loginData', loginData).then(res => {
            this.tilesApi.setLoginData(loginData);
            this.mqttClient.connect();
          });
          this.storage.set('loggedIn', loginData.remember); // TODO: not needed, but test after removing
          this.viewCtrl.dismiss('logged_in');
        } else {
          this.alertCtrl.create({
            // The username was not registered on the provided host server
            title: 'User not registered on host server',
            subTitle: 'Please try again.', // tslint:disable-line
            buttons: [{ // tslint:disable-line
              text: 'Dismiss',
            }],
          }).present();
        }
      });
    } else {
      // Logindata was formatted wrong
      this.alertCtrl.create({
        title: 'Invalid login credentials',
        subTitle: 'Please try again.', // tslint:disable-line
        buttons: [{ // tslint:disable-line
          text: 'Dismiss',
        }],
      }).present();
    }
  }

  /**
   * Passes the login credidentials from the login form to the connectToServer function.
   */
  public loginForm = (): void => {
    this.connectToServer(this.loginInfo.user.trim(), this.loginInfo.host.trim(), parseInt(this.loginInfo.port.trim(), 10), this.loginInfo.remember);
  }
}
