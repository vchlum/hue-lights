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

/**
  * Check all bridges in the local network.
  * 
  * @method discoverBridges
  * @return {Object} dictionary with bridges in local network
  */
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

/**
 * _PhueBridge API class for one bridge.
 *
 * @class _PhueBridge
 * @constructor
 * @private
 * @param {String} ip address
 * @return {Object} instance
 */
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

    /**
     * Check if any error recently occured (based on input data dictionary).
     * 
     * @method _checkBridgeError
     * @private
     * @param {Object} dictionary with data to check
     * @param {Boolean} should the error tag be unset before processing?
     * @return {Boolean|Object} false on OK, dictionary with errors on error
     */
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

    /**
     * Process url request to the bridge.
     * 
     * @method _requestJson
     * @private
     * @param {String} method to be used like POST, PUT, GET
     * @param {Boolean} url to be requested
     * @param {Object} input data in case of supported method
     * @return {Object} JSON with response
     */
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

    /**
     * POST requst to url of a bridge.
     * 
     * @method _bridgePOST
     * @private
     * @param {Boolean} url to be requested
     * @param {Object} input data
     * @return {Object} JSON with response
     */
    _bridgePOST(url, data) {

        return this._requestJson("POST", url, data);
    }

    /**
     * PUT requst to url of a bridge.
     * 
     * @method _bridgePOST
     * @private
     * @param {Boolean} url to be requested
     * @param {Object} input data
     * @return {Object} JSON with response
     */
    _bridgePUT(url, data) {

        return this._requestJson("PUT", url, data);
    }

    /**
     * GET requst to url of a bridge.
     * 
     * @method _bridgeGET
     * @private
     * @param {Boolean} url to be requested
     * @return {Object} JSON with response
     */
    _bridgeGET(url) {

        return this._requestJson("GET", url, null);
    }

    /**
     * Create new user on the bridge.
     * The button must be pressed before.
     * 
     * @method _createUser
     * @private
     * @return {Object} JSON with response
     */
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

    /**
     * Get allowed username on the bridge.
     * 
     * @method getUserName
     * @return {String} the username
     */
    getUserName() {

        return this._userName;
    }

    /**
     * Get ip address on the bridge.
     * 
     * @method getIp
     * @return {String} the ip address
     */
    getIp() {

        return this._ip;
    }

    /**
     * Set allowed username on the bridge.
     * 
     * @method setUserName
     * @param {String} the username
     */
    setUserName(userName) {

        this._userName = userName;
    }

    /**
     * Check if the bridge is connected.
     * 
     * @method isConnected
     * @return {Boolean} true if connected, false otherwise
     */
    isConnected() {

        let res = this.getConfig();

        if (res["zigbeechannel"] === undefined) {
            this._bridgeConnected = false;
            return this._bridgeConnected
        }

        this._bridgeConnected = true;
        return this._bridgeConnected
    }

    /**
     * Try to connect to the bridge. Create the username if necessary.
     * 
     * @method connectBridge
     * @return {Object} JSON with response
     */
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

    /**
     * Get data from the bridge. Uses GET request.
     * 
     * @method _getData
     * @private
     * @return {Object} JSON data
     */
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

    /**
     * Check bridge and get all possible data from it.
     * 
     * @method getAll
     * @return {Object} JSON data
     */
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

    /**
     * Check bridge and get data for lights.
     * 
     * @method getLights
     * @return {Object} JSON data
     */
    getLights() {

        this._lightsData = this._getData("lights");
        return this._lightsData;
    }

    /**
     * Check bridge and get data for groups.
     * 
     * @method getGroups
     * @return {Object} JSON data
     */
    getGroups() {

        this._groupsData = this._getData("groups");
        return this._groupsData;
    }

    /**
     * Check bridge and get data for config.
     * 
     * @method getConfig
     * @return {Object} JSON data
     */
    getConfig() {

        this._configData = this._getData("config");
        return this._configData;
    }

    /**
     * Check bridge and get data for schedules.
     * 
     * @method getSchedules
     * @return {Object} JSON data
     */
    getSchedules() {

        this._schedulesData = this._getData("schedules");
        return this._schedulesData;
    }

    /**
     * Check bridge and get data for scenes.
     * 
     * @method getScenes
     * @return {Object} JSON data
     */
    getScenes() {

        this._scenesData = this._getData("scenes");
        return this._scenesData;
    }

    /**
     * Check bridge and get data for rules.
     * 
     * @method getRules
     * @return {Object} JSON data
     */
    getRules() {

        this._rulesData = this._getData("rules");
        return this._rulesData;
    }

    /**
     * Check bridge and get data for sensors.
     * 
     * @method getSensors
     * @return {Object} JSON data
     */
    getSensors() {

        this._sensorsData = this._getData("sensors");
        return this._sensorsData;
    }

    /**
     * Check bridge and get data for resourcelinks.
     * 
     * @method getResourcelinks
     * @return {Object} JSON data
     */
    getResourcelinks() {

        this._resourcelinksData = this._getData("resourcelinks");
        return this._resourcelinksData;
    }

    /**
     * Set lights - turn on/off, brightness, colour, ...
     * Multiple lights possible.
     * 
     * @method setLights
     * @param {Number|Object} light id or array of light id
     * @param {Object} JSON input data
     * @return {Object} JSON output data
     */
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

/**
 * PhueBridge API class for one bridge.
 *
 * @class PhueBridge
 * @constructor
 * @param {String} ip address
 * @return {Object} instance
 */
var PhueBridge = class PhueBridge extends _PhueBridge {

    constructor(params) {
        super(params);

        Object.assign(this, params);
    }
};