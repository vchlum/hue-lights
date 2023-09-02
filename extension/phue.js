'use strict';

/**
 * phue
 * JavaScript library for Philips Hue bridges.
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


import * as HueApi from './phueapi.js';
import * as Utils from './utils.js';

/**
 * _Phue class for controlling multiple bridges.
 *
 * @class _Phue
 * @constructor
 * @private
 * @return {Object} instance
 */
class _Phue {

    constructor(asyncMode) {
        this.bridges = {};
        this.instances = {};
        this.data = {};
        this._connectionTimeout = 2;
        this._asyncMode = asyncMode;
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
     * @param {String} bridgeid which bridge we use here
     */
    checkBridge(bridgeid) {

        Utils.logDebug(`Checking bridge: ${bridgeid}`);

        if (this.bridges[bridgeid] !== undefined &&
            this.bridges[bridgeid]["ip"] !== undefined) {
            /* update IP in case it has been changed */
            this.instances[bridgeid].ip = this.bridges[bridgeid]["ip"];
        }

        let res = this.instances[bridgeid].getConfig();

        if (this.instances[bridgeid].checkError()) {

            Utils.logError(`Bridge ${bridgeid} check failed.`);
            return;
        }

        if (res["name"] !== undefined) {
            this.bridges[bridgeid]["name"] = res["name"];
        }

        if (res["mac"] !== undefined) {
            this.bridges[bridgeid]["mac"] = res["mac"];
        }

        this.data[bridgeid] = this.instances[bridgeid].getAll();
    }

    /**
     * Add new bridge into the pool by the IP address.
     * 
     * @method addBridgeManual
     * @param {String} ip IP address of a new bridge
     * @return {Boolean} success of adding
     */
    addBridgeManual(ipAddress) {

        Utils.logDebug(`Trying to manual add bridge ip: ${ipAddress}`);

        let instance = new HueApi.PhueBridge({ip: ipAddress});

        if (this._asyncMode) {
            instance.enableAsyncRequest();
        }

        instance.setConnectionTimeout(this._connectionTimeout);

        let res = instance.firstConnectBridge();

        if (instance.checkError()) {
            return false;
        }

        if (res.length > 0 && "success" in res[0]) {
            let username = res[0]["success"]["username"];
            let clientkey = res[0]["success"]["clientkey"];

            Utils.logDebug(`bridge connected (manual); new username: ${username} ip: ${ipAddress}`);

            res = instance.getConfig();

            if (instance.checkError()) {
                return false;
            }

            let bridgeid = res["bridgeid"].toLowerCase();

            this.bridges[bridgeid] = {
                "ip": ipAddress,
                "username": username,
                "name": res["name"],
                "mac": res["mac"]
            };

            if (clientkey !== undefined) {
                this.bridges[bridgeid]["clientkey"] = clientkey;

                Utils.logDebug(`bridge connected (manual); got clientkey: ${clientkey}`);
            }

            this.instances[bridgeid] = instance;
            return true;
        }
        return false;
    }

    /**
     * Check all bridges and try to connect to them.
     * If bridge button pressed discovered brodge will be connected.
     * 
     * @method checkBridges
     * @return {Object} dictionary with data of all bridges.
     */
    checkBridges(discover = true) {

        let known;
        let errs;
        let discovered = [];

        Utils.logDebug(`Checking for available bridges, discover: ${discover}`);

        if (discover)
            discovered = HueApi.discoverBridges();

        /* first, check for deleted bridges */
        for (let bridgeidInstance in this.instances) {
            known = false;
            for (let bridgeid in this.bridges) {
                if (bridgeid === bridgeidInstance) {
                    known = true;
                }
            }

            if (!known) {
                delete(this.instances[bridgeidInstance]);
            }
        }

        for (let i in discovered) {
            let bridgeid = discovered[i]["id"];

            if (this.bridges[bridgeid] !== undefined) {
                if (discovered[i]["internalipaddress"] !== this.bridges[bridgeid]["ip"]) {
                    this.bridges[bridgeid]["ip"] = discovered[i]["internalipaddress"];
                }

            } else {
                this.bridges[bridgeid] = {
                    "ip":discovered[i]["internalipaddress"],
                    "name":discovered[i]["name"],
                    "mac":discovered[i]["mac"]
                };
            }
        }

        Utils.logDebug(`Discovered bridges: ${JSON.stringify(discovered)}`);

        for (let bridgeid in this.bridges) {
            let instance;

            if (this.instances[bridgeid] === undefined) {
                Utils.logDebug(`Creating bridge: ${bridgeid}`);

                instance = new HueApi.PhueBridge({ip: this.bridges[bridgeid]["ip"]});

                if (this._asyncMode) {
                    instance.enableAsyncRequest();
                }

                instance.setConnectionTimeout(this._connectionTimeout);

                this.instances[bridgeid] = instance;
            } else {
                instance = this.instances[bridgeid];
            }

            if (this.bridges[bridgeid]["username"] !== undefined) {
                instance.setUserName(this.bridges[bridgeid]["username"]);
            }

            this.checkBridge(bridgeid);

            /**
             * if error here, maybe bridge button is pressed
             * for authorization
             */
            if (instance.checkError()) {

                Utils.logDebug(`Failed to connect bridge: ${bridgeid}, checking for button to be pressed`);

                errs = instance.getError();

                if (errs.length !== 1) {
                    continue;
                }

                if (errs[0]["type"] === undefined) {
                    continue;
                }

                /* try to connect only if error type 1 - unauthorized user */
                if (errs[0]["type"] !== 1) {
                    continue;
                }

                let res = instance.firstConnectBridge();

                if (res.length > 0 && "success" in res[0]) {
                    let username = res[0]["success"]["username"];
                    this.bridges[bridgeid]["username"] = username;

                    Utils.logDebug(`bridge connected; new username: ${username} ip: ${this.bridges[bridgeid]["ip"]}`);

                    if (res[0]["success"]["clientkey"] != undefined) {
                        this.bridges[bridgeid]["clientkey"] = res[0]["success"]["clientkey"];

                        Utils.logDebug(`bridge connected; got clientkey: ${this.bridges[bridgeid]["clientkey"]}`);
                    }

                    this.checkBridge(bridgeid);
                }
            }
        }

        return this.data;
    }
}

/**
 * Phue class for controlling multiple bridges.
 *
 * @class Phue
 * @constructor
 * @return {Object} instance
 */
export var Phue = class Phue extends _Phue {

    constructor(params) {

        super(params);

        Object.assign(this, params);
    }
};