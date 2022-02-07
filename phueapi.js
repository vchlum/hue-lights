'use strict';

/**
 * phueapi
 * JavaScript library for Philips Hue bridge.
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

imports.gi.versions.Soup = "2.4";

const Soup = imports.gi.Soup;
const Json = imports.gi.Json;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const GObject = imports.gi.GObject;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

/**
  * Check all bridges in the local network.
  * 
  * @method discoverBridges
  * @return {Object} dictionary with bridges in local network
  */
function discoverBridges() {

    if (Soup.MAJOR_VERSION >= 3) {
        return discoverBridges3();
    }

    let bridges = [];
    let session = Soup.Session.new();
    session.timeout = 3;

    let message = Soup.Message.new('GET', "https://discovery.meethue.com/");
    let statusCode = session.send_message(message);

    if (statusCode === Soup.Status.OK) {
        let discovered = JSON.parse(message.response_body.data);

        for (let i in discovered) {
            message = Soup.Message.new('GET', `http://${discovered[i]["internalipaddress"]}/api/config`);
            statusCode = session.send_message(message);
            if (statusCode === Soup.Status.OK &&
                JSON.parse(message.response_body.data)["mac"] !== undefined) {

                bridges.push(discovered[i]);
            }
        }
    }

    return bridges;
}

/**
  * Check all bridges in the local network using libsoup3.
  * 
  * @method discoverBridges
  * @return {Object} dictionary with bridges in local network
  */
function discoverBridges3() {
    let bridges = [];
    let session = Soup.Session.new();
    session.timeout = 3;

    let msg = Soup.Message.new('GET', "https://discovery.meethue.com/");

    try {
        let data = session.send_and_read(msg, null).get_data();

        if (msg.status_code !== Soup.Status.OK) {
            return [];
        }

        let discovered = JSON.parse(data);

        for (let i in discovered) {
            msg = Soup.Message.new('GET', `http://${discovered[i]["internalipaddress"]}/api/config`);

            let bridge = {};
            try {
                data = session.send_and_read(msg, null).get_data();

                if (msg.status_code !== Soup.Status.OK) {
                    continue;
                }

                bridge = JSON.parse(data);
            } catch(e) {
                bridge = {};
                Utils.logError(`Failed to discover bridge ${discovered[i]["internalipaddress"]}: ${e}`);
                continue;
            }

            if (bridge["mac"] !== undefined) {
                bridges.push(discovered[i]);
            }
        }

    } catch(e) {
        Utils.logError(`Failed to discover bridges: ${e}`);
        return [];
    }

    return bridges;
}

var PhueRequestype = {
    NO_RESPONSE_NEED: 0,
    CHANGE_OCCURRED: 1,
    ALL_DATA: 2,
    LIGHTS_DATA: 3,
    GROUPS_DATA: 4,
    GROUPZERO_DATA: 5,
    CONFIG_DATA: 6,
    SCHEDULES_DATA: 7,
    SCENES_DATA: 8,
    RULES_DATA: 9,
    SENSORS_DATA: 10,
    RESOURCE_LINKS_DATA: 11,
    ENABLE_STREAM: 12,
    NEW_USER: 13,
    EVENT: 14
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
        "change-occurred": {},
        "all-data": {},
        "lights-data": {},
        "groups-data": {},
        "group-zero-data": {},
        "config-data": {},
        "schedules-data": {},
        "scenes-data": {},
        "rules-data":{},
        "sensors-data": {},
        "resource-links-data": {},
        "stream-enabled": {},
        "connection-problem": {},
        "event-stream-data": {},
    }
}, class PhueBridge extends GObject.Object {

    _init(props={}) {

        super._init(props);
        this._bridgeConnected = false;
        this._userName = "";

        this._apiVersionMajor = 0;
        this._apiVersionMinor = 0;

        this._data = [];
        this._bridgeData = [];
        this._lightsData = [];
        this._groupsData = [];
        this._groupZeroData = [];
        this._configData = [];
        this._schedulesData = [];
        this._scenesData = [];
        this._rulesData = [];
        this._sensorsData = [];
        this._resourcelinksData = [];
        this._bridgeError = [];
        this._eventStreamEnabled = false;

        this._baseUrl = `http://${this._ip}`;
        this._bridgeUrl = `${this._baseUrl}/api`;
        this._eventStreamUrl = `https://${this._ip}/eventstream/clip/v2`;

        this._bridgeSession = Soup.Session.new();
        this._bridgeSession.timeout = 3;

        this._eventStreamMsg = null;
        this._eventStreamSession = null;

        this._asyncRequest = false;
    }

    set ip(value) {
        this._ip = value;
        this._baseUrl = `http://${this._ip}`;
        this._bridgeUrl = `${this._baseUrl}/api`;
        this._eventStreamUrl = `https://${this._ip}/eventstream/clip/v2`;
    }

    get ip() {
        return this._ip;
    }

    /**
     * Set connection timeout
     * 
     * @method setConnectionTimeout
     * @param {Number} sec timeout in seconds
     */
    setConnectionTimeout(sec) {

        this._bridgeSession.timeout = sec;
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
     * Check if error occurred in last action.
     * 
     * @method checkError
     * @return {Boolean} true if error occurred else false
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
     * Check if any error occurred (based on input data dictionary).
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

                Utils.logDebug(`Bridge error: ${JSON.stringify(this._bridgeError)}`);
            }
        }

        if(data === undefined || data.length === 0) {
            this._bridgeError.push({
                "type": -1,
                "description": "no data provided"
            });

            this._bridgeConnected = false;

            Utils.logDebug(`Bridge error: ${JSON.stringify(this._bridgeError)}`);
        }

        return this._bridgeError;
    }

    /**
     * Checks bridge API version and enables suitable functions.
     * 
     * @method checkApiVersion
     */
    checkApiVersion() {
        if (this._data !==  undefined &&
            this._data["config"] !==  undefined &&
            this._data["config"]["apiversion"] !==  undefined) {

            let apiVersion = this._data["config"]["apiversion"].split(".");
            this._apiVersionMajor = parseInt(apiVersion[0]);
            this._apiVersionMinor = parseInt(apiVersion[1]);

            if (this._apiVersionMajor >= 2 ||
                (this._apiVersionMajor === 1 && this._apiVersionMinor >= 46)) {

                this.enableEventStream();
            }
        }
    }

    /**
     * Process url request to the bridge with libsoup3.
     * 
     * @method _requestJson3
     * @private
     * @param {String} method to be used like POST, PUT, GET
     * @param {Boolean} url to be requested
     * @param {Object} input data in case of supported method
     * @return {Object} JSON with response
     */
    _requestJson3(method, url, requestHueType, data) {

        let outputData;

        Utils.logDebug(`Bridge ${method} request, url: ${url} data: ${JSON.stringify(data)}`);

        let msg = PhueMessage.new(method, url);

        msg.requestHueType = requestHueType;

        if (data !== null) {
            msg.set_request_body_from_bytes(
                "application/json",
                new GLib.Bytes(JSON.stringify(data))
            );
        }

        if (this._asyncRequest) {
            this._data = [];
            Utils.logDebug('libsoup3 not implemented yet');
            return [];
        }

        try {
            outputData = this._bridgeSession.send_and_read(msg, null).get_data();

            if (msg.status_code !== Soup.Status.OK) {
                Utils.logDebug(`Bridge sync-respond to ${url} ended with status: ${msg.status_code}`);
                this._bridgeConnected = false;
                return [];
            }

            this._data = JSON.parse(outputData);
            this._bridgeConnected = true;
        } catch(e) {
            Utils.logError(`Bridge sync-respond to ${url} failed: ${e}`);
            this._bridgeConnected = false;
            return [];
        }

        return this._data;
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

        if (Soup.MAJOR_VERSION >= 3) {
            return this._requestJson3(method, url, requestHueType, data);
        }

        Utils.logDebug(`Bridge ${method} request, url: ${url} data: ${JSON.stringify(data)}`);

        let msg = PhueMessage.new(method, url);

        msg.requestHueType = requestHueType;

        if (data !== null) {
            data = JSON.stringify(data);
            msg.set_request("application/gnome-extension", 2, data);
        } else {
            msg.set_request("application/gnome-extension", 2, "");
        }

        if (this._asyncRequest) {
            this._data = [];

            this._bridgeSession.queue_message(msg, (sess, mess) => {
                if (mess.status_code === Soup.Status.OK) {
                    try {

                        Utils.logDebug(`Bridge ${method} async-responded OK to url: ${url}`);

                        try {
                            this._bridgeConnected = true;
                            this._data = JSON.parse(mess.response_body.data);

                            this.checkApiVersion();
                        } catch {
                            Utils.logError(`Bridge ${method} async-respond, failed to parse JSON`);
                            this._data = [];
                        }

                        switch (mess.requestHueType) {

                            case PhueRequestype.CHANGE_OCCURRED:
                                this._bridgeData = this._data;
                                this.emit("change-occurred");
                                break;

                            case PhueRequestype.ALL_DATA:
                                this._bridgeData = this._data;
                                if (this._groupZeroData) {
                                    this._bridgeData["groups"][0] = this._groupZeroData;
                                }
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

                            case PhueRequestype.GROUPZERO_DATA:
                                this._groupZeroData = this._data;
                                this.emit("group-zero-data");
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

                            case PhueRequestype.ENABLE_STREAM:
                                this.emit("stream-enabled");
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
                        this.disableEventStream();
                        if (requestHueType !== PhueRequestype.NO_RESPONSE_NEED) {
                            this.emit("connection-problem");
                        }
                    }
                } else {
                    this._bridgeConnected = false;
                    this._data = [];
                    this.disableEventStream();
                    if (requestHueType !== PhueRequestype.NO_RESPONSE_NEED) {
                        this.emit("connection-problem");
                    }
                }
            });

            return []
        }

        let statusCode = this._bridgeSession.send_message(msg);
        if (statusCode === Soup.Status.OK) {

            Utils.logDebug(`Bridge ${method} sync-responded OK to url: ${url}`);

            try {
                this._bridgeConnected = true;
                this._data = JSON.parse(msg.response_body.data);
            } catch {
                Utils.logError(`Bridge ${method} sync-respond, failed to parse JSON`);
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

        const CMD_HOSTNAME = "hostname";
        let hostname = "";
        let username = "";
        let res;
        let generateClientKey = false;

        res = this._bridgeGET(`${this._bridgeUrl}/config`, null, null);
        this._checkBridgeError(res);
        if (this.checkError()) {
            Utils.logDebug(`Failed to get bridge config: ${JSON.stringify(this._bridgeError)}`);
            return this._bridgeError;
        }

        Utils.logDebug(`Creating user, got bridge config: ${JSON.stringify(res)}`);

        /* test if clientkey (used for Entertainment)
         * can be generated */
        if (res["apiversion"] !== undefined) {
            let apiVersion = res["apiversion"].split(".");
            let major = parseInt(apiVersion[0]);
            let minor = parseInt(apiVersion[1]);
            if (major >= 2 || (major === 1 && minor >= 22)) {
                generateClientKey = true;
            }
        }

        try {
            let output = GLib.spawn_command_line_sync(CMD_HOSTNAME);
            hostname = ByteArray.toString(output[1]).trim();
        } catch(e) {
            hostname = "unknown-host";
            Utils.logError(`Failed to get hostanme: ${e}`);
        }

        /* device name can be up to 19 chars */
        if (hostname.length > 19) {
            hostname = hostname.slice(0, 19);
        }

        username = `gnome-hue-lights#${hostname}`;

        Utils.logDebug(`New bridge username: ${username}`);

        let requestHueType = PhueRequestype.NEW_USER;
        let postData = {"devicetype": username}

        if (generateClientKey) {
            postData["generateclientkey"] = true;
            Utils.logDebug(`Requesting client key`);
        }

        res = this._bridgePOST(this._bridgeUrl, requestHueType, postData);
        this._checkBridgeError(res);
        if (this.checkError()) {
            Utils.logDebug(`Failed to create bridge user: ${JSON.stringify(this._bridgeError)}`);
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

            Utils.logDebug(`First bridge connecting succeeded`);

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
            Utils.logDebug(`Failed to get bridge data: ${JSON.stringify(this._bridgeError)}`);
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

        /* group zero is not listed with other data */
        this.getGroupZero();

        if (this.checkError()) {
            return [];
        }

        this._getData("", requestHueType);

        if (this.checkError()) {
            return [];
        }

        if (this._groupZeroData && this._bridgeData["groups"] !== undefined) {
            this._bridgeData["groups"][0] = this._groupZeroData;
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
     * Check bridge and get data for group zero.
     * 
     * @method getGroups
     * @return {Object} JSON data
     */
    getGroupZero(requestHueType = PhueRequestype.GROUPZERO_DATA) {

        this._groupZeroData = this._getData("groups/0", requestHueType);
        return this._groupZeroData;
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
    setLights(lights, data, requestHueType = PhueRequestype.CHANGE_OCCURRED) {

        let url = "";
        let res = [];

        switch (typeof(lights)) {

            case "number":
                url = `${this._bridgeUrl}/${this._userName}/lights/${lights.toString()}/state`;
                res = this._bridgePUT(url, requestHueType, data);

                this._checkBridgeError(res);
                if (this.checkError()) {
                    return this._bridgeError;
                }

                return res;

            case "object":
                let result = [];
                for (let light in lights) {

                    /* change only for last light */
                    if (light + 1 == lights.length) {
                        requestHueType = PhueRequestype.CHANGE_OCCURRED;
                    } else {
                        requestHueType = PhueRequestype.NO_RESPONSE_NEED;
                    }

                    url = `${this._bridgeUrl}/${this._userName}/lights/${lights[light].toString()}/state`;
                    res = this._bridgePUT(url, requestHueType, data);

                    this._checkBridgeError(res);
                    if (this.checkError()) {
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
    actionGroup(groupId, data, requestHueType = PhueRequestype.CHANGE_OCCURRED) {

        let url = "";
        let res = [];

        url = `${this._bridgeUrl}/${this._userName}/groups/${groupId.toString()}/action`;
        res = this._bridgePUT(url, requestHueType, data)

        this._checkBridgeError(res);
        if (this.checkError()) {
            return this._bridgeError;
        }

        return res;
    }

    enableStream(groupId, requestHueType = PhueRequestype.ENABLE_STREAM) {

        let url = "";
        let res = [];

        url = `${this._bridgeUrl}/${this._userName}/groups/${groupId.toString()}`;
        res = this._bridgePUT(url, requestHueType, {"stream":{"active":true}})

        this._checkBridgeError(res);
        if (this.checkError()) {
            return this._bridgeError;
        }

        return res;
    }

    disableStream(groupId, requestHueType = PhueRequestype.CHANGE_OCCURRED) {

        let url = "";
        let res = [];

        url = `${this._bridgeUrl}/${this._userName}/groups/${groupId.toString()}`;
        res = this._bridgePUT(url, requestHueType, {"stream":{"active":false}})

        this._checkBridgeError(res);
        if (this.checkError()) {
            return this._bridgeError;
        }

        return res;
    }

    /**
     * Sets sensor configuration.
     * 
     * @method setSensor
     * @param {Number} sensorId for the settings
     * @param {Object} JSON input data
     * @return {Object} JSON output data
     */
    setSensor(sensorId, data, requestHueType = PhueRequestype.CHANGE_OCCURRED) {

        let url = "";
        let res = [];

        url = `${this._bridgeUrl}/${this._userName}/sensors/${sensorId.toString()}/config`;
        res = this._bridgePUT(url, requestHueType, data)

        this._checkBridgeError(res);
        if (this.checkError()) {
            return this._bridgeError;
        }

        return res;
    }

    /**
     * Sends request to read event stream of the bridge.
     * 
     * @method _requestEventStream
     * @private
     */
    _requestEventStream() {
        if (! this._eventStreamEnabled) {
            Utils.logDebug(`Event stream ${this._eventStreamUrl} not enabled`);
            return;
        }

        if (this._eventStreamSession === null) {
            this._eventStreamEnabled = false;
            this.enableEventStream();
        }

        if (this._eventStreamMsg !== null) {
            Utils.logDebug(`Event stream message already requested on: ${this._eventStreamUrl}`);
            return;
        }

        Utils.logDebug(`Event stream ${this._eventStreamUrl} request`);

        let msg = PhueMessage.new("GET", this._eventStreamUrl);

        msg.requestHueType = PhueRequestype.EVENT;
        msg.request_headers.append("ssl", "False");
        msg.request_headers.append("hue-application-key", this._userName);

        this._eventStreamMsg = msg;

        this._eventStreamSession.queue_message(msg, (sess, mess) => {
            if (mess.status_code === Soup.Status.OK) {
                this._eventStreamMsg = null;
                try {
                    this._eventStreamData = JSON.parse(mess.response_body.data);

                    this.emit("event-stream-data");
                } catch {
                    Utils.logError(`Event stream ${this._eventStreamUrl} data problem - failed to parse JSON`);
                    this._eventStreamData = [];
                }

                this._requestEventStream();
            } else if (mess.status_code === Soup.Status.CANCELLED) {
                /* event stream already disabled - this is what left from the msg, do nothing*/
                Utils.logDebug(`Event stream ${this._eventStreamUrl} cancelled`);
                return;
            } else {
                this._eventStreamMsg = null;
                Utils.logDebug(`Event stream ${this._eventStreamUrl} stopped due to error code: ${mess.status_code}`);
                this._eventStreamData = [];
            }
        })
    }

    /**
     * Enables event stream and sends the request to read it.
     * 
     * @method enableEventStream
     */
    enableEventStream() {
        if (this._userName === "") {
            return;
        }

        if (this._eventStreamEnabled) {
            return;
        }

        Utils.logDebug(`Enabling event stream on: ${this._eventStreamUrl}`);

        if (this._eventStreamSession === null) {
            this._eventStreamSession = Soup.Session.new();
            this._eventStreamSession.ssl_strict = false;
        }

        this._eventStreamSession.timeout = 0;
        this._eventStreamEnabled = true;

        this._requestEventStream();
    }

    /**
     * Disable event stream and let current request timeout.
     * 
     * @method disableEventStream
     */
    disableEventStream() {
        if (this._userName === "") {
            return;
        }

        if (!this._eventStreamEnabled) {
            return;
        }

        if (this._eventStreamSession === null) {
            return;
        }

        Utils.logDebug(`Disabling event stream on: ${this._eventStreamUrl}`);

        this._eventStreamEnabled = false;

        if (this._eventStreamMsg !== null) {
            this._eventStreamSession.timeout = 1;
            this._eventStreamSession.cancel_message(this._eventStreamMsg, Soup.Status.CANCELLED);
        }

        this._eventStreamSession.abort();

        this._eventStreamMsg = null;
        this._eventStreamSession = null;
    }

    /**
     * Returns event data in JSON.
     * 
     * @method getEvent
     * @return {Object} JSON data
     */
    getEvent() {
        return this._eventStreamData;
    }

    /**
     * Check if event stream is running.
     * 
     * @method isEventStream
     * @returns {Boolean}
     */
    isEventStream() {
        return this._eventStreamEnabled;
    }
})
