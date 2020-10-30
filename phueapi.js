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
const GObject = imports.gi.GObject;

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

var PhueRequestype = {
    NO_RESPONSE_NEED: 0,
    CHANGE_OCCURED: 1,
    ALL_DATA: 2,
    LIGHTS_DATA: 3,
    GROUPS_DATA: 4,
    CONFIG_DATA: 5,
    SCHEDULES_DATA: 6,
    SCENES_DATA: 7,
    RULES_DATA: 8,
    SENSORS_DATA: 9,
    RESOURCE_LINKS_DATA: 10,
    NEW_USER: 11
};


var PhueMessage = class PhueMessage extends Soup.Message {

    constructor(params) {

        super(params);

        this.requestHueType = PhueRequestype.NO_RESPONSE_NEED;

        Object.assign(this, params);
    }
};

/**
 * _PhueBridge API class for one bridge.
 *
 * @class _PhueBridge
 * @constructor
 * @private
 * @param {String} ip address
 * @return {Object} instance
 */
var PhueBridge =  GObject.registerClass({
    GTypeName: "PhueBridge",
    Properties: {
        "ip": GObject.ParamSpec.string("ip", "ip", "ip", GObject.ParamFlags.READWRITE, null),
    },
    Signals: {
        "change-occured": {},
        "all-data": {},
        "lights-data": {},
        "groups-data": {},
        "config-data": {},
        "schedules-data": {},
        "scenes-data": {},
        "rules-data":{},
        "sensors-data": {},
        "resource-links-data": {},
        "connection-problem": {}
    }
}, class PhueBridge extends GObject.Object {

    _init(props={}) {
        super._init(props);
        this._bridgeConnected = false;
        this._userName = "";

        this._data = [];
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

        this._baseUrl = `http://${this._ip}`;
        this._bridgeUrl = `${this._baseUrl}/api`;

        this._bridgeSession = Soup.Session.new();
        this._bridgeSession.set_property(Soup.SESSION_USER_AGENT, "hue-session");
        this._bridgeSession.set_property(Soup.SESSION_TIMEOUT, 1);

        this._asyncRequest = false;
    }

    set ip(value) {
        this._ip = value;
        this._baseUrl = `http://${this._ip}`;
        this._bridgeUrl = `${this._baseUrl}/api`;
    }

    get ip() {
        this._ip;
    }

    /**
     * Set connection timeout
     * 
     * @method setConnectionTimeout
     * @param {Number} sec timeout in seconds
     */
    setConnectionTimeout(sec) {

        this._bridgeSession.set_property(Soup.SESSION_TIMEOUT, sec);
    }

    /**
     * Disconect all signals
     * 
     * @method disconnectAll
     */
    disconnectAll() {
        for (let id of this._signals) {
            this.disconnect(id);
        }

        this._signals = [];
    }

    /**
     * Enables async http requests
     * 
     * @method enableAsyncRequest
     */
    enableAsyncRequest() {
        this._asyncRequest = true;
    }

    /**
     * Disables async http requests
     * 
     * @method enableAsyncRequest
     */
    disableAsyncRequest() {
        this._asyncRequest = false;
    }

    /**
     * Returns data after the async request.
     * 
     * @method getAsyncData
     * @return {Object} dictionary with data
     */
    getAsyncData() {
        return this._data;
    }

    /**
     * Check if error occured in last action.
     * 
     * @method checkError
     * @return {Boolean} true if error occured else false 
     */
    checkError() {

        if (this._bridgeError.length > 0) {
            return true;
        }

        return false;
    }

    /**
     * Returns error of last action
     * 
     * @method getError
     * @return {Object} array of errors
     */
    getError() {
        return this._bridgeError;
    }

    /**
     * Check if any error occured (based on input data dictionary).
     * 
     * @method _checkBridgeError
     * @private
     * @param {Object} dictionary with data to check
     * @param {Boolean} should the error tag be unset before processing?
     * @return {Object} dictionary with errors on error
     */
    _checkBridgeError(data, resetError = true) {
        if (this._asyncRequest) {
            this._bridgeError = [];
            return this._bridgeError;
        }

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

        if(data === undefined || data.length === 0) {
            this._bridgeError.push({
                "type": -1,
                "description": "no data provided"
            });

            this._bridgeConnected = false;
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
    _requestJson(method, url, requestHueType, data) {

        let msg = PhueMessage.new(method, url);

        msg.requestHueType = requestHueType;

        if (data !== null) {
            data = JSON.stringify(data);
            msg.set_request("application/gnome-extension", 2, data);
        }

        if (this._asyncRequest) {
            this._data = [];

            this._bridgeSession.queue_message(msg, (sess, mess) => {
                if (mess.status_code === Soup.Status.OK) {
                    try {
                        this._bridgeConnected = true;
                        this._data = JSON.parse(mess.response_body.data);

                        switch (mess.requestHueType) {

                            case PhueRequestype.CHANGE_OCCURED:
                                this._bridgeData = this._data;
                                this.emit("change-occured");
                                break;

                            case PhueRequestype.ALL_DATA:
                                this._bridgeData = this._data;
                                this.emit("all-data");
                                break;

                            case PhueRequestype.LIGHTS_DATA:
                                this._lightsData = this._data;
                                this.emit("lights-data");
                                break;

                            case PhueRequestype.GROUPS_DATA:
                                this._groupsData = this._data;
                                this.emit("groups-data");
                                break;

                            case PhueRequestype.CONFIG_DATA:
                                this._configData = this._data;
                                this.emit("config-data");
                                break;

                            case PhueRequestype.SCHEDULES_DATA:
                                this._schedulesData = this._data;
                                this.emit("schedules-data");
                                break;

                            case PhueRequestype.SCENES_DATA:
                                this._scenesData = this._data;
                                this.emit("scenes-data");
                                break;

                            case PhueRequestype.RULES_DATA:
                                this._rulesData = this._data;
                                this.emit("rules-data");
                                break;

                            case PhueRequestype.SENSORS_DATA:
                                this._sensorsData = this._data;
                                this.emit("sensors-data");
                                break;

                            case PhueRequestype.RESOURCE_LINKS_DATA:
                                this._resourcelinksData = this._data;
                                this.emit("resource-links-data");
                                break;

                            case PhueRequestype.NO_RESPONSE_NEED:
                                /* no signal emitted, request does not need response */
                                break;

                            default:
                        }

                        return

                    } catch {
                        this._bridgeConnected = false;
                        this._data = [];
                        if (requestHueType !== PhueRequestype.NO_RESPONSE_NEED) {
                            this.emit("connection-problem");
                        }
                    }
                } else {
                    this._bridgeConnected = false;
                    this._data = [];
                    if (requestHueType !== PhueRequestype.NO_RESPONSE_NEED) {
                        this.emit("connection-problem");
                    }
                }
            });

            return []
        }

        let statusCode = this._bridgeSession.send_message(msg);
        if (statusCode === Soup.Status.OK) {
            try {
                this._bridgeConnected = true;
                this._data = JSON.parse(msg.response_body.data);
            } catch {
                return [];
            }
        }

        return this._data;

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
    _bridgePOST(url, requestHueType, data) {

        return this._requestJson("POST", url, requestHueType, data);
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
    _bridgePUT(url, requestHueType, data) {

        return this._requestJson("PUT", url, requestHueType, data);
    }

    /**
     * GET requst to url of a bridge.
     * 
     * @method _bridgeGET
     * @private
     * @param {Boolean} url to be requested
     * @return {Object} JSON with response
     */
    _bridgeGET(url, requestHueType) {

        return this._requestJson("GET", url, requestHueType, null);
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

        let requestHueType = PhueRequestype.NEW_USER;
        let res = this._bridgePOST(this._bridgeUrl, requestHueType, {"devicetype": username});
        this._checkBridgeError(res);
        if (this.checkError()) {
            log(JSON.stringify(this._bridgeError));
            return this._bridgeError;
        }

        return res;
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
     * True if the last reply of the bridge was OK.
     * 
     * @method isConnected
     * @return {Boolean} true if connected, false otherwise
     */
    isConnected() {

        return this._bridgeConnected
    }

    /**
     * Try to connect to the bridge. Create the username if necessary.
     * 
     * @method firstConnectBridge
     * @return {Object} JSON with response
     */
    firstConnectBridge() {

        let data = this._createUser();

        if (this.checkError()) {
            this._bridgeConnected = false;
            return this._bridgeError;
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
    _getData(data, requestHueType) {

        let userName = this._userName;

        if (userName === "") {
            userName = "unknown";
        }

        this._bridgeData = this._bridgeGET(`${this._bridgeUrl}/${userName}/${data}`, requestHueType);

        this._checkBridgeError(this._bridgeData);
        if (this.checkError()) {
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
    getAll(requestHueType = PhueRequestype.ALL_DATA) {

        this._getData("", requestHueType);

        if (this.checkError()) {
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
    getLights(requestHueType = PhueRequestype.LIGHTS_DATA) {

        this._lightsData = this._getData("lights", requestHueType);
        return this._lightsData;
    }

    /**
     * Check bridge and get data for groups.
     * 
     * @method getGroups
     * @return {Object} JSON data
     */
    getGroups(requestHueType = PhueRequestype.GROUPS_DATA) {

        this._groupsData = this._getData("groups", requestHueType);
        return this._groupsData;
    }

    /**
     * Check bridge and get data for config.
     * 
     * @method getConfig
     * @return {Object} JSON data
     */
    getConfig(requestHueType = PhueRequestype.CONFIG_DATA) {

        this._configData = this._getData("config", requestHueType);
        return this._configData;
    }

    /**
     * Check bridge and get data for schedules.
     * 
     * @method getSchedules
     * @return {Object} JSON data
     */
    getSchedules(requestHueType = PhueRequestype.SCHEDULES_DATA) {

        this._schedulesData = this._getData("schedules", requestHueType);
        return this._schedulesData;
    }

    /**
     * Check bridge and get data for scenes.
     * 
     * @method getScenes
     * @return {Object} JSON data
     */
    getScenes(requestHueType = PhueRequestype.SCENES_DATA) {

        this._scenesData = this._getData("scenes", requestHueType);
        return this._scenesData;
    }

    /**
     * Check bridge and get data for rules.
     * 
     * @method getRules
     * @return {Object} JSON data
     */
    getRules(requestHueType = PhueRequestype.RULES_DATA) {

        this._rulesData = this._getData("rules", requestHueType);
        return this._rulesData;
    }

    /**
     * Check bridge and get data for sensors.
     * 
     * @method getSensors
     * @return {Object} JSON data
     */
    getSensors(requestHueType = PhueRequestype.SENSORS_DATA) {

        this._sensorsData = this._getData("sensors", requestHueType);
        return this._sensorsData;
    }

    /**
     * Check bridge and get data for resourcelinks.
     * 
     * @method getResourcelinks
     * @return {Object} JSON data
     */
    getResourcelinks(requestHueType = PhueRequestype.RESOURCE_LINKS_DATA) {

        this._resourcelinksData = this._getData("resourcelinks", requestHueType);
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
    setLights(lights, data, requestHueType = PhueRequestype.CHANGE_OCCURED) {

        let url = "";
        let res = [];

        switch (typeof(lights)) {

            case "number":
                url = `${this._bridgeUrl}/${this._userName}/lights/${lights.toString()}/state`;
                res = this._bridgePUT(url, requestHueType, data);

                this._checkBridgeError(res);
                if (this.checkError()) {
                    log(JSON.stringify(this._bridgeError));
                    return this._bridgeError;
                }

                return res;

            case "object":
                let result = [];
                for (let light in lights) {

                    /* change only for last light */
                    if (light + 1 == lights.length) {
                        requestHueType = PhueRequestype.CHANGE_OCCURED;
                    } else {
                        requestHueType = PhueRequestype.NO_RESPONSE_NEED;
                    }

                    url = `${this._bridgeUrl}/${this._userName}/lights/${lights[light].toString()}/state`;
                    res = this._bridgePUT(url, requestHueType, data);

                    this._checkBridgeError(res);
                    if (this.checkError()) {
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

    /**
     * Set action for the whole group.
     * Like setting the scene.
     * 
     * @method actionGroup
     * @param {Number} groupId for the action
     * @param {Object} JSON input data
     * @return {Object} JSON output data
     */
    actionGroup(groupId, data, requestHueType = PhueRequestype.CHANGE_OCCURED) {

        let url = "";
        let res = [];

        url = `${this._bridgeUrl}/${this._userName}/groups/${groupId.toString()}/action`;
        res = this._bridgePUT(url, requestHueType, data)

        this._checkBridgeError(res);
        if (this.checkError()) {
            log(JSON.stringify(this._bridgeError));
            return this._bridgeError;
        }

        return res;
    }
})
