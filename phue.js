'use strict';

/**
 * phue
 * JavaScript library for Philips Hue bridges.
 *
 * @author Václav Chlumský
 * @copyright Copyright 2020, Václav Chlumský.
 */

 /**
 * @license
 * The MIT License (MIT)
 *
 * Copyright (c) 2020 Václav Chlumský
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

class _Phue {

    constructor() {
        this.bridges = {};
        this.instances = {};
    }

    _checkBridge(bridgeid) {
        let res = this.instances[bridgeid].getConfig();

        if (res["name"] !== undefined) {
            this.bridges[bridgeid]["name"] = res["name"];
        }

        if (res["mac"] !== undefined) {
            this.bridges[bridgeid]["mac"] = res["mac"];
        }

        this.instances[bridgeid].getAll();
    }

    addBridgeManual(ip) {
        let instance = new HueApi.PhueBridge(ip);

        let res = instance.connectBridge();

        if (res.length > 0 && "success" in res[0]) {
            let username = res[0]["success"]["username"];
            log(`new username: ${username} for ip: ${ip}`);

            res = instance.getConfig();
            let bridgeid = res["bridgeid"].toLowerCase();

            this.bridges[bridgeid] = {"ip": ip, "username": username, "name": res["name"], "mac": res["mac"]};

            this.instances[bridgeid] = instance;
            return true;
        }
        return false;
    }

    checkBridges() {
        let discovered = HueApi.discoverBridges();

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
                instance = new HueApi.PhueBridge(this.bridges[bridgeid]["ip"]);
                this.instances[bridgeid] = instance;
            } else {
                instance = this.instances[bridgeid];
            }

            if (this.bridges[bridgeid]["username"] !== undefined) {
                instance.setUserName(this.bridges[bridgeid]["username"]);
            }

            this._checkBridge(bridgeid);

            if (!instance.isConnected()) {
                let res = instance.connectBridge();

                if (res.length > 0 && "success" in res[0]) {
                    let username = res[0]["success"]["username"];
                    this.bridges[bridgeid]["username"] = username;

                    log(`new username: ${username} for ip: ${this.bridges[bridgeid]["ip"]}`);

                    this._checkBridge(bridgeid);
                }
            }

            if (instance.isConnected()) {
                //log(JSON.stringify(instance.setLights([12, 21], {"on":true, "sat":254, "bri":254,"hue":10000})));
            }

        }

    }

}

var Phue = class Phue extends _Phue {
    constructor(params) {
        super(params);

        Object.assign(this, params);
    }
};