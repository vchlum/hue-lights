'use strict';

/**
 * phue
 * JavaScript library for Philips Hue sync boxes.
 *
 * @author Václav Chlumský
 * @copyright Copyright 2023, Václav Chlumský.
 */

 /**
 * @license
 * The MIT License (MIT)
 *
 * Copyright (c) 2023 Václav Chlumský
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import GObject from 'gi://GObject';
import * as HueSyncBoxApi from './phuesyncboxapi.js';
import * as Utils from './utils.js';

/**
 * PhueSyncBox class for controlling multiple sync boxes.
 *
 * @class PhueSyncBox
 * @constructor
 * @return {Object} instance
 */
 export var PhueSyncBox =  GObject.registerClass({
    GTypeName: "PhueSyncBox",
    Properties: {
        'async': GObject.ParamSpec.boolean("async", "async", "async", GObject.ParamFlags.READWRITE, false),
    },
    Signals: {
        "registration-complete": {},
        "registration-failed": {}
    }
}, class PhueSyncBox extends GObject.Object {

    _init(mainDir, props={}) {
        super._init(props);

        this.syncboxes = {};
        this.instances = {};
        this._tmpInstance = null;
        this.data = {};
        this._connectionTimeout = 2;
        this._mainDir = mainDir
        this.discoverSyncBox = new HueSyncBoxApi.DiscoverySyncBox(mainDir);
    }

    set async(value) {
        this._asyncMode = value;
    }

    get async() {
        return this._asyncMode;
    }

    /**
     * Set connection timeout for all bridges
     * 
     * @method setConnectionTimeout
     * @param {Number} sec timeout in seconds
     */
    setConnectionTimeout(sec) {

        this._connectionTimeout = sec;

        for (let i in this.instances) {
            this.instances[i].setConnectionTimeout(sec);
        }
    }

    /**
     * Enable asynchronous requests for all bridges.
     * 
     * @method enableAsyncMode
     */
    enableAsyncMode() {
        this._asyncMode = true;
        for (let i in this.instances) {
            this.instances[i].enableAsyncRequest();
        }
    }

    /**
     * Disable asynchronous requests for all bridges.
     * 
     * @method disableAsyncMode
     */
    disableAsyncMode() {
        this._asyncMode = false;

        for (let i in this.instances) {
            this.instances[i].disableAsyncRequest();
        }
    }

    /**
     * Check if bridge with bridgeid is connected,
     * and refreshes info about bridge.
     * 
     * @method checkBridge
     * @private
     * @param {String} bridgeid which bridge we use here
     */
     checkSyncBox(id) {

        Utils.logDebug(`Checking sync box: ${id}`);

        if (this.syncboxes[id] !== undefined &&
            this.syncboxes[id]["ip"] !== undefined) {
            /* update IP in case it has been changed */
            this.instances[id].ip = this.syncboxes[id]["ip"];
        }

        let res = this.instances[id].getDeviceState();

        if (this.instances[id].checkError()) {

            Utils.logError(`Sync box ${id} check failed.`);
            return;
        }

        if (res["device"] !== undefined) {
            if (res["device"]["name"] !== undefined) {
                this.syncboxes[id]["name"] = res["device"]["name"];
            }

            if (res["device"]["ipAddress"] !== undefined) {
                this.syncboxes[id]["ipAddress"] = res["device"]["ipAddress"];
            }
        }

        this.data[id] = res;
    }

    /**
     * Add new synbox into the pool by the IP address.
     * 
     * @method addSyncBoxManual
     * @param {String} ip IP address of a new bridge
     * @return {Boolean} success of adding
     */
    addSyncBoxManual(ipAddress) {

        Utils.logDebug(`Trying to manualy add a sync box ip: ${ipAddress}`);

        let instance = new HueSyncBoxApi.PhueSyncBox(this._mainDir, {ip: ipAddress});

        if (this._asyncMode) {
            instance.enableAsyncRequest();
        }

        instance.setConnectionTimeout(this._connectionTimeout);

        instance.connect(
            "registration-complete",
            () => {
                let id = instance.id;
                this._tmpInstance = null;
                this.syncboxes[id] = {};
                this.syncboxes[id]["name"] = instance.name;
                this.syncboxes[id]["ip"] = instance.ip;
                this.syncboxes[id]["registrationId"] = instance._registrationID;
                this.syncboxes[id]["accessToken"] = instance._accessToken;
                this.instances[id] = instance;
                this.emit("registration-complete");
            }
        );

        instance.connect(
            "registration-failed",
            () => {
                this._tmpInstance = null;
                this.emit("registration-failed");
            }
        );

        this._tmpInstance = instance;
        instance.createRegistration();
    }

    cancelAdding() {
        if (this._tmpInstance !== null) {
            this._tmpInstance.stopRegistration();
        }
    }

    /**
     * Check all bridges and try to connect to them.
     * If bridge button pressed discovered brodge will be connected.
     * 
     * @method checkBridges
     * @return {Object} dictionary with data of all bridges.
     */
    checkSyncBoxes(discovered = []) {

        for (let i in discovered) {
            let id = discovered[i]["uniqueId"];

            if (this.syncboxes[id] === undefined) {
                this.syncboxes[id] = {
                    "name": discovered[i]["name"],
                    "ip": discovered[i]["ipAddress"]
                };
            }
        }
        Utils.logDebug(`Discovered sync boxes: ${JSON.stringify(discovered)}`);
        Utils.logDebug(`Checking for available sync boxes.`);

        for (let id in this.syncboxes) {
            let instance;

            if (this.instances[id] === undefined) {
                Utils.logDebug(`Creating syncbox: ${id}`);

                instance = new HueSyncBoxApi.PhueSyncBox(
                    this._mainDir,
                    {
                        ip: this.syncboxes[id]["ip"],
                    }
                );

                if (this._asyncMode) {
                    instance.enableAsyncRequest();
                }

                instance.setConnectionTimeout(this._connectionTimeout);

                this.instances[id] = instance;
            } else {
                instance = this.instances[id];
            }

            if (this.syncboxes[id]["accessToken"] !== undefined) {
                instance.setAccessToken(
                    this.syncboxes[id]["accessToken"]
                );
            }

            if (this.syncboxes[id]["registrationId"] !== undefined) {
                instance.setRegistrationID(
                    this.syncboxes[id]["registrationId"]
                );
            }

            this.checkSyncBox(id);

        }

        return this.data;
    }
});
