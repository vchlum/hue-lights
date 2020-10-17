'use strict';

/**
 * phueapi
 * JavaScript library for Philips Hue bridge.
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

const Soup = imports.gi.Soup;
const Json = imports.gi.Json;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

function discoverBridges() {
    let session = Soup.Session.new();
    session.set_property(Soup.SESSION_USER_AGENT, "hue-discovery");

    let message = Soup.Message.new('GET', "https://discovery.meethue.com/");
    let statusCode = session.send_message(message);

    if (statusCode === Soup.Status.OK) {
        return JSON.parse(message.response_body.data);
    }

    return [];
}

class _PhueBridge {

    constructor(ip) {
        this._bridgeConnected = false;
        this._userName = "";

        this._bridgeData = [];
        this._lightsData = [];
        this._groupsData = [];
        this._configData = [];
        this._schedulesData = [];
        this._scenesData = [];
        this._rulesData = [];
        this._sensorsData = [];
        this._resourcelinksData = [];

        this._bridgeError = [];

        this._ip = ip;
        this._baseUrl = `http://${ip}`;
        this._bridgeUrl = `${this._baseUrl}/api`;

        this._bridgeSession = Soup.Session.new();
        this._bridgeSession.set_property(Soup.SESSION_USER_AGENT, "hue-session");
        this._bridgeSession.set_property(Soup.SESSION_TIMEOUT, 5);
    }

    _checkBridgeError(data, resetError = true) {
        if (resetError) {
            this._bridgeError = [];
        }

        if (Array.isArray(data)) {
            for (let i in data) {
                this._checkBridgeError(data[i], false);
            }
        }

        for (let key in data) {
            if (key == "error") {
                this._bridgeError.push(data["error"]);
                if (data["error"]["type"] === 1) {
                    this._bridgeConnected = false;
                }
            }
        }

        if (this._bridgeError.length === 0) {
            return false;
        }

        return this._bridgeError;
    }

    _requestJson(method, url, data) {
        let msg = Soup.Message.new(method, url);

        if (data !== null) {
            data = JSON.stringify(data);
            msg.set_request('application/gnome-extension', 2, data);
        }

        let statusCode = this._bridgeSession.send_message(msg);
        if (statusCode === Soup.Status.OK) {
            try {
                return JSON.parse(msg.response_body.data);
            } catch {
                return [];
            }
        }
        return [];

    }

    _bridgePOST(url, data) {
        return this._requestJson("POST", url, data);
    }

    _bridgePUT(url, data) {
        return this._requestJson("PUT", url, data);
    }

    _bridgeGET(url) {
        return this._requestJson("GET", url, null);
    }

    _createUser() {
        const CMD_FQDN = "hostname --fqdn";
        let hostname = "";
        let username = "";

        try {
            let output = GLib.spawn_command_line_sync(CMD_FQDN);
            hostname = ByteArray.toString(output[1]).trim();
        } catch(e) {
            hostname = "unknown-host";
            log(e);
        }

        username = `gnome-extension-hue-lights#${hostname}`;

        return this._bridgePOST(this._bridgeUrl, {"devicetype": username});
    }

    getUserName() {
        return this._userName;
    }

    getIp() {
        return this._ip;
    }

    setUserName(userName) {
        this._userName = userName;
    }

    isConnected() {
        let res = this.getConfig();

        if (res["zigbeechannel"] === undefined) {
            this._bridgeConnected = false;
            return this._bridgeConnected
        }

        this._bridgeConnected = true;
        return this._bridgeConnected
    }

   connectBridge() {
        let data = this._createUser();


        if (this._checkBridgeError(data)) {
            log(JSON.stringify(this._bridgeError));
            return this._bridgeError;
        }

        if (data.length === 0) {
            return [];
        }

        if (data[0]["success"] !== undefined) {
            this._userName = data[0]["success"]["username"];
            this._bridgeConnected = true;
            return data;
        }

        return data;

    }

    _getData(data) {
        let userName = this._userName;

        if (userName === "") {
            userName = "unknown";
        }

        this._bridgeData = this._bridgeGET(`${this._bridgeUrl}/${userName}/${data}`);

        if (this._checkBridgeError(this._bridgeData)) {
            log(JSON.stringify(this._bridgeError));
            return [];
        }

        return this._bridgeData;
    }

    getAll() {
        if (this._getData("") === [] ) {
            return [];
        }

        this._lightsData = this._bridgeData["lights"];
        this._groupsData = this._bridgeData["groups"];
        this._configData = this._bridgeData["config"];
        this._schedulesData = this._bridgeData["schedules"];
        this._scenesData = this._bridgeData["scenes"];
        this._rulesData = this._bridgeData["rules"];
        this._sensorsData = this._bridgeData["sensors"];
        this._resourcelinksData = this._bridgeData["resourcelinks"];

        return this._bridgeData;
    }

    getLights() {
        this._lightsData = this._getData("lights");
        return this._lightsData;
    }

    getGroups() {
        this._groupsData = this._getData("groups");
        return this._groupsData;
    }

    getConfig() {
        this._configData = this._getData("config");
        return this._configData;
    }

    getSchedules() {
        this._schedulesData = this._getData("schedules");
        return this._schedulesData;
    }

    getScenes() {
        this._scenesData = this._getData("scenes");
        return this._scenesData;
    }

    getRules() {
        this._rulesData = this._getData("rules");
        return this._rulesData;
    }

    getSensors() {
        this._sensorsData = this._getData("sensors");
        return this._sensorsData;
    }

    getResourcelinks() {
        this._resourcelinksData = this._getData("resourcelinks");
        return this._resourcelinksData;
    }

    setLights(lights, data) {
        let url = "";
        let res = [];

        switch (typeof(lights)) {
            case "number":
                url = `${this._bridgeUrl}/${this._userName}/lights/${lights.toString()}/state`;
                res = this._bridgePUT(url, data)
                if (this._checkBridgeError(res)) {
                    log(JSON.stringify(this._bridgeError));
                    return this._bridgeError;
                }
                return res;

            case "object":
                let result = [];
                for (let light in lights) {
                    url = `${this._bridgeUrl}/${this._userName}/lights/${lights[light].toString()}/state`;
                    res = this._bridgePUT(url, data)

                    if (this._checkBridgeError(res)) {
                        log(JSON.stringify(this._bridgeError));
                        return this._bridgeError;
                    }

                    result = result.concat(res);
                }
                return result;

            default:
                return [];
        }
    }
}



var PhueBridge = class PhueBridge extends _PhueBridge {
    constructor(params) {
        super(params);

        Object.assign(this, params);
    }
};