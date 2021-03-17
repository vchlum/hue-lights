'use strict';

/**
 * phue
 * JavaScript library for Philips Hue bridges.
 *
 * @author Václav Chlumský
 * @copyright Copyright 2021, Václav Chlumský.
 */

 /**
 * @license
 * The MIT License (MIT)
 *
 * Copyright (c) 2021 Václav Chlumský
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

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const HueApi = Me.imports.phueapi;

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

    enableAsyncMode() {
        this._asyncMode = true;
        for (let i in this.instances) {
            this.instances[i].enableAsyncRequest();
        }
    }

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
     * @method _checkBridge
     * @private
     * @param {String} bridgeid which bridge we use here
     */
    _checkBridge(bridgeid) {

        let res = this.instances[bridgeid].getConfig();

        if (this.instances[bridgeid].checkError()) {
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
            log(`new username: ${username} for ip: ${ipAddress}`);

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
                delete this.instances[bridgeidInstance];
            }
        }

        for (let i in discovered) {
            let bridgeid = discovered[i]["id"];

            if (this.bridges[bridgeid] !== undefined) {
                if (discovered[i]["internalipaddress"] !== this.bridges[bridgeid]["ip"]) {
                    this.bridges[bridgeid]["ip"] = discovered[i]["internalipaddress"];
                }

            } else {
                this.bridges[bridgeid] = {"ip":discovered[i]["internalipaddress"]};
            }
        }

        for (let bridgeid in this.bridges) {
            let instance;

            if (this.instances[bridgeid] === undefined) {
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

            this._checkBridge(bridgeid);

            /**
             * if error here, maybe bridge button is pressed
             * for authorization
             */
            if (instance.checkError()) {
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
                    if (res[0]["success"]["clientkey"] != undefined) {
                        this.bridges[bridgeid]["clientkey"] = res[0]["success"]["clientkey"];
                    }

                    log(`hue new username: ${username} for ip: ${this.bridges[bridgeid]["ip"]}`);

                    this._checkBridge(bridgeid);
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
var Phue = class Phue extends _Phue {

    constructor(params) {

        super(params);

        Object.assign(this, params);
    }
};