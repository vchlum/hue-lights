'use strict';

/**
 * phuesyncboxapi
 * JavaScript library for Philips Hue Sync Box.
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

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';
import Json from 'gi://Json';
import GObject from 'gi://GObject';
import * as Utils from './utils.js';

const PhueSyncBoxMsgRequestType = {
    NO_RESPONSE_NEED: 0,
    REGISTRATION: 1,
    CHANGE_OCCURRED: 2,
    DEVICE_STATE: 3
};

var PhueSyncBoxMessage = class PhueSyncBoxMessage extends Soup.Message {

    constructor(params) {

        super(params);

        this.requestHueType = PhueSyncBoxMsgRequestType.NO_RESPONSE_NEED;

        Object.assign(this, params);
    }
};

const TlsDatabaseSyncBox = GObject.registerClass({
    Implements: [Gio.TlsFileDatabase],
    Properties: {
        'anchors': GObject.ParamSpec.override('anchors', Gio.TlsFileDatabase),
    },
}, class TlsDatabaseSyncBox extends Gio.TlsDatabase {

    vfunc_verify_chain(chain, purpose, identity, interaction, flags, cancellable) {
        return 0;
    }
});

/**
 * PhueSyncBox API class for Philips Hue Sync Box
 *
 * @class PhueSyncBox
 * @constructor
 * @private
 * @param {String} ip address
 * @return {Object} instance
 */
export var PhueSyncBox =  GObject.registerClass({
    GTypeName: "PhueSyncBoxApi",
    Properties: {
        "ip": GObject.ParamSpec.string("ip", "ip", "ip", GObject.ParamFlags.READWRITE, null),
    },
    Signals: {
        "registration-complete": {},
        "registration-failed": {},
        "change-occurred": {},
        "device-state": {},
        "connection-problem": {}
    }
}, class PhueSyncBoxApi extends GObject.Object {

    _init(mainDir, props={}) {

        super._init(props);

        this._mainDir = mainDir;

        this._timers = [];
        this._syncBoxError = [];

        this._appName = "hue-lights";
        this._instanceName = "";
        this._accessToken = "";
        this._registrationID = "";
        this.id = "";
        this.name = "";
        this._registrationCounter = 0;

        this._baseUrl = `https://${this._ip}`;
        this._syncBoxUrl = `${this._baseUrl}/api/v1`;

        this._syncBoxSession = Soup.Session.new();
        this._syncBoxSession.timeout = 5;

        /**
         * Philips Hue HDMI Sync Box API supports only HTTPS requests [1].
         * That is the reason I added the TLS certificate [2] to this extension
         * as Philips company recommends.
         * After initialization and pairing with the Philips Hue HDMI Sync Box,
         * the certificate is used as suggested by Philips company [1].
         * 
         * Note: You need a Philips Hue developer account to access the referenced links.
         * 
         * [1] https://developers.meethue.com/develop/hue-entertainment/hue-hdmi-sync-box-api/
         * [2] https://developers.meethue.com/wp-content/uploads/2020/01/hsb_cacert.pem_.txt
         */
        const HsbCert = this._mainDir.get_path() + "/crypto/hsb_cacert.pem"

        let tlsDatabase =  new TlsDatabaseSyncBox(
            { anchors: HsbCert }
        );
        this._syncBoxSession.tls_database  = tlsDatabase;
        this._syncBoxSession.ssl_strict = true;

        this._asyncRequest = false;
        this._syncBoxConnected = false;
    }

    set ip(value) {
        this._ip = value;
        this._baseUrl = `https://${this._ip}`;
        this._syncBoxUrl = `${this._baseUrl}/api/v1`;
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

        this._syncBoxSession.timeout = sec;
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
     * Set access token used for comunication with the sync box
     * 
     * @method setAccessToken
     * @param {String} access token
     */
    setAccessToken(accessToken) {

        this._accessToken = accessToken;
    }

    /**
     * Set registration id
     * 
     * @method setRegistrationID
     * @param {String} id
     */
    setRegistrationID(id) {

        this._registrationID = id;
    }

    /**
     * Parse and emit result of syncbox response.
     *
     * @method _responseJsonParse
     * @private
     * @param {String} method to be used like POST, PUT, GET
     * @param {String} requested url
     * @param {Object} request hue type
     * @param {String} JSON response
     */
     _responseJsonParse(method, url, requestHueType, data) {
        try {

            Utils.logDebug(`HDMI sync box ${method} async-responded OK to url: ${url}`);

            try {
                this._syncBoxConnected = true;
                this._data = JSON.parse(data);
            } catch {
                Utils.logError(`HDMI sync box ${method} async-respond, failed to parse JSON`);
                this._data = [];
            }

            switch (requestHueType) {

                case PhueSyncBoxMsgRequestType.REGISTRATION:
                    if (this._data["registrationId"] !== undefined) {
                        Utils.logDebug(`HDMI sync box ${this._ip} registration complete: ${JSON.stringify(this._data)}`);
                        this._registrationID = this._data["registrationId"];
                        this._accessToken = this._data["accessToken"];
                        this.emit("registration-complete");
                    } else {
                        Utils.logDebug(`HDMI sync box ${this._ip} registration waits for pressing the button.`);
                    }
                    break;

                case PhueSyncBoxMsgRequestType.DEVICE_STATE:
                    this.emit("device-state");
                    break;

                case PhueSyncBoxMsgRequestType.CHANGE_OCCURRED:
                    this.emit("change-occurred");
                    break;

                case PhueSyncBoxMsgRequestType.NO_RESPONSE_NEED:
                    /* no signal emitted, request does not need response */
                    break;

                default:
            }

            return

        } catch {
            this._connectionProblem(requestHueType);
        }
    }
    /**
     * Process url request to the sync box with libsoup3.
     * 
     * @method _requestJson3
     * @private
     * @param {String} method to be used like POST, PUT, GET
     * @param {String} url to be requested
     * @param {Object} request hue type
     * @param {Object} JSON input data in case of supported method
     * @return {Object} JSON with response
     */
    _requestJson3(method, url, requestHueType, data) {

        let outputData;

        Utils.logDebug(`Sync Box ${method} request, url: ${url} data: ${JSON.stringify(data)}`);

        let msg = PhueSyncBoxMessage.new(method, url);

        msg.requestHueType = requestHueType;

        if (this._accessToken !== "") {
            msg.request_headers.append("Authorization", `Bearer ${this._accessToken}`);
        }

        if (data !== null) {
            msg.set_request_body_from_bytes(
                "application/json",
                new GLib.Bytes(JSON.stringify(data))
            );
        }

        if (this._asyncRequest) {
            this._data = [];
            this._syncBoxSession.send_and_read_async(msg, Soup.MessagePriority.NORMAL, null, (sess, res) => {
                if (msg.get_status() === Soup.Status.OK) {
                    try {
                        const bytes = this._syncBoxSession.send_and_read_finish(res);
                        let decoder = new TextDecoder();
                        let responseData = decoder.decode(bytes.get_data());
                        this._responseJsonParse(method, url, requestHueType, responseData);
                    } catch {
                        this._connectionProblem(requestHueType);
                    }
                } else {
                    this._connectionProblem(requestHueType);
                }
            });

            return [];
        }

        try {
            outputData = this._syncBoxSession.send_and_read(msg, null).get_data();

            if (msg.status_code !== Soup.Status.OK) {
                Utils.logDebug(`Sync Box sync-respond to ${url} ended with status: ${msg.status_code}`);
                this._syncBoxConnected = false;
                return [];
            }

            this._data = JSON.parse(outputData);
            this._syncBoxConnected = true;
        } catch(e) {
            Utils.logError(`Sync Box sync-respond to ${url} failed: ${e}`);
            this._syncBoxConnected = false;
            return [];
        }

        return this._data;
    }

    /**
     * Process url request to the sync box.
     * 
     * @method _requestJson
     * @private
     * @param {String} method to be used like POST, PUT, GET
     * @param {String} url to be requested
     * @param {Object} request hue type
     * @param {Object} JSON input data in case of supported method
     * @return {Object} JSON with response
     */
    _requestJson(method, url, requestHueType, data) {

        if (Soup.MAJOR_VERSION >= 3) {
            return this._requestJson3(method, url, requestHueType, data);
        }

        Utils.logDebug(`HDMI sync box ${method} request, url: ${url} data: ${JSON.stringify(data)}`);

        let msg = PhueSyncBoxMessage.new(method, url);

        msg.requestHueType = requestHueType;

        if (this._accessToken !== "") {
            msg.request_headers.append("Authorization", `Bearer ${this._accessToken}`);
        }

        if (data !== null) {
            data = JSON.stringify(data);
            msg.set_request("application/gnome-extension", 2, data);
        } else {
            msg.set_request("application/gnome-extension", 2, "");
        }

        if (this._asyncRequest) {
            this._data = [];

            this._syncBoxSession.queue_message(msg, (sess, mess) => {
                if (mess.status_code === Soup.Status.OK) {
                    this._responseJsonParse(method, url, requestHueType, mess.response_body.data);
                } else {
                    this._connectionProblem(requestHueType);
                }
            });

            return []
        }

        let statusCode = this._syncBoxSession.send_message(msg);
        if (statusCode === Soup.Status.OK) {

            Utils.logDebug(`HDMI sync box ${method} sync-responded OK to url: ${url}`);

            try {
                this._syncBoxConnected = true;
                return JSON.parse(msg.response_body.data);
            } catch {
                Utils.logError(`HDMI sync box ${method} sync-respond, failed to parse JSON`);
                return [];
            }
        }

        return [];
    }

    /**
     * POST requst to url of a hue sync box.
     * 
     * @method _syncBoxPOST
     * @private
     * @param {Boolean} url to be requested
     * @param {Object} input data
     * @return {Object} JSON with response
     */
     _syncBoxPOST(url, requestHueType, data) {

        return this._requestJson("POST", url, requestHueType, data);
    }

    /**
     * PUT requst to url of a syncBox.
     * 
     * @method _syncBoxPOST
     * @private
     * @param {Boolean} url to be requested
     * @param {Object} input data
     * @return {Object} JSON with response
     */
    _syncBoxPUT(url, requestHueType, data) {

        return this._requestJson("PUT", url, requestHueType, data);
    }

    /**
     * GET requst to url of a syncBox.
     * 
     * @method _syncBoxGET
     * @private
     * @param {Boolean} url to be requested
     * @return {Object} JSON with response
     */
    _syncBoxGET(url, requestHueType) {

        return this._requestJson("GET", url, requestHueType, null);
    }

    /**
     * DELETE requst to url of a syncBox.
     * 
     * @method _syncBoxGET
     * @private
     * @param {Boolean} url to be requested
     * @return {Object} JSON with response
     */
     _syncBoxDELETE(url, requestHueType) {

        return this._requestJson("DELETE", url, requestHueType, null);
    }

    /**
     * Send request to get syncbox state.
     * 
     * @method getDeviceState
     */
    getDeviceState() {

        let url = this._syncBoxUrl;
        return this._syncBoxGET(url, PhueSyncBoxMsgRequestType.DEVICE_STATE)
    }

    /**
     * Send execution request to syncbox.
     * 
     * @method setExecution
     * @param {Object} data in JSON
     * @param {Number} request type
     */
    setExecution(data, requestHueType = PhueSyncBoxMsgRequestType.CHANGE_OCCURRED) {

        let url = `${this._syncBoxUrl}/execution`;
        return this._syncBoxPUT(url, requestHueType, data)
    }

    /**
     * Preparation for registration in new hdmi sync box.
     * 
     * @method createRegistration
     */
    createRegistration() {

        const CMD_HOSTNAME = "hostname";
        let hostname = "";
        this._registrationCounter = 0;

        try {
            let output = GLib.spawn_command_line_sync(CMD_HOSTNAME);
            let decoder = new TextDecoder();
            hostname = decoder.decode(output[1]).trim();
        } catch(e) {
            hostname = "unknown-host";
            Utils.logError(`Failed to get hostanme: ${e}`);
        }

        /* device name can be up to 19 chars */
        if (hostname.length > 10) {
            hostname = hostname.slice(0, 10);
        }

        let data = {"appName": "hue-lights", "instanceName": hostname};
        this._tryRegister(data);
    }

    /**
     * Registration finished - no more attempts.
     * 
     * @method stopRegistration
     */
    stopRegistration() {

        this._registrationCounter = 999;
    }

    /**
     * Try register this app in hdmi sync box.
     * Try several times.
     * 
     * @method _tryRegister
     * @private
     * @param {Object} data with app name and instance name
     */
    _tryRegister(data) {

        this._registrationCounter++;

        if (this._registrationID.length > 0) {
            return;
        }

        if (this._registrationCounter > 8) {
            this.emit("registration-failed");
            return;
        }

        Utils.logDebug(`HDMI sync box ${this._ip} registration waits for pressing the button.`);

        let url = `${this._syncBoxUrl}/registrations`;
        let ret = this._syncBoxPOST(url, PhueSyncBoxMsgRequestType.REGISTRATION, data);

        if (ret["registrationId"] !== undefined) {
            Utils.logDebug(`HDMI sync box ${this._ip} registration succeed: ${JSON.stringify(ret)}.`)

            this._registrationID = ret["registrationId"];
            this._accessToken = ret["accessToken"];
            this.stopRegistration();

            this._data = this.getDeviceState();
            if (this._data["device"] !== undefined &&
                this._data["device"]["uniqueId"] !== undefined) {

                this.id = this._data["device"]["uniqueId"];
                this.name = this._data["device"]["name"];

                this.emit("registration-complete");
            }
            return;
        }

        Utils.logDebug(`HDMI sync box ${this._ip} registration attempt failed.`);

        let timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this._tryRegister(data);
            this._timers = Utils.removeFromArray(this._timers, timerId);
        });
        this._timers.push(timerId);
    }

    /**
     * Delete registaration from hdmi sync box.
     * TODO the DELETE request returns 405
     * 
     * @method stopRegistration
     * @param {Number} request type
     */
    deleteRegistration(requestHueType = PhueSyncBoxMsgRequestType.CHANGE_OCCURRED) {

        if (this._registrationID.length === 0) {
            return;
        }

        Utils.logDebug(`HDMI sync box ${this._ip} is being deleted and the registration canceled.`);

        let url = `${this._syncBoxUrl}/execution/${this._registrationID}`;
        return this._syncBoxDELETE(url, requestHueType);
    }

    /**
     * Send request to change hdmi input.
     * 
     * @method setHDMISource
     * @param {String} one of following strings: input1, input2, input3, input4
     * @param {Number} request type
     */
    setHDMISource(input, requestHueType = PhueSyncBoxMsgRequestType.CHANGE_OCCURRED) {

        let url = `${this._syncBoxUrl}/execution`;
        return this._syncBoxPUT(url, requestHueType, {"hdmiSource": input})
    }

    /**
     * Send restart syncbox request.
     * 
     * @method restartDevice
     */
    restartDevice() {
        let url = `${this._syncBoxUrl}/device`;
        return this._syncBoxPUT(url, PhueSyncBoxMsgRequestType.NO_RESPONSE_NEED, {"action": "doSoftwareRestart"})
    }

    /**
     * True if the last reply of the bridge was OK.
     * 
     * @method isConnected
     * @return {Boolean} true if connected, false otherwise
     */
    isConnected() {

        return this._syncBoxConnected;
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

        if (this._syncBoxError.length > 0) {
            return true;
        }

        return false;
    }

    /**
     * Mark problem with connection and emit the situation.
     *
     * @method _connectionProblem
     * @private
     * @param {Object} request hue type
     */
    _connectionProblem(requestHueType) {
        this._syncBoxConnected = false;
        this._data = [];
        if (requestHueType !== PhueSyncBoxMsgRequestType.NO_RESPONSE_NEED) {
            this.emit("connection-problem");
        }
    }

    /**
     * Remove timers created by GLib.timeout_add
     * 
     * @method disarmTimers
     */
    disarmTimers() {
        for (let t of this._timers) {
            if (t) {
                GLib.Source.remove(t);
            }
        }

        this._timers = [];
    }
});