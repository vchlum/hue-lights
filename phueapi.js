'use strict';

const Soup = imports.gi.Soup;
const Json = imports.gi.Json;

const GLib = imports.gi.GLib;

const ByteArray = imports.byteArray;

const ExtensionUtils = imports.misc.extensionUtils;
const HueLights = ExtensionUtils.getCurrentExtension();

function discoverBridges() {
    let session = Soup.Session.new();
    session.set_property(Soup.SESSION_USER_AGENT, "hue-discovery");
    let message = Soup.Message.new('GET', "https://discovery.meethue.com/");
    let statusCode = session.send_message(message);
    if (statusCode === Soup.Status.OK) {
        return JSON.parse(message.response_body.data);
    }
    return null;
}

class _PhueBridge {

    constructor(ip) {
        this._ip = ip;
        this._baseUrl = `http://${ip}`;
        this._bridgeUrl = `${this._baseUrl}/api`;

        this._bridgeSession = Soup.Session.new();
        this._bridgeSession.set_property(Soup.SESSION_USER_AGENT, "hue-session");

        this._bridgeConnected = false;
        this._userName = "";
        this._bridgeData = null;
    }

    _requestJson(method, url, data) {
        let msg = Soup.Message.new(method, url);

        if (data !== null) {
            data = JSON.stringify(data);
            msg.set_request('application/gnome-extension', 2, data);
        }

        let statusCode = this._bridgeSession.send_message(msg);
        if (statusCode === Soup.Status.OK) {
            return JSON.parse(msg.response_body.data);
        }
        return null;

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

        try {
            let output = GLib.spawn_command_line_sync(CMD_FQDN);
            //hostname = new String(output[1], "UTF-8").trim();
            hostname = ByteArray.toString(output[1]).trim();
            log(hostname);
        } catch(e) {
            hostname = "unknown-host";
            log(e);
        }

        let username = `gnome-extension-hue-lights#${hostname}`;

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
        this._bridgeConnected = true;
    }

    isConnected() {
        return this._bridgeConnected;
    }

   connectBridge() {
        let data = this._createUser();

        if (data[0]["error"] !== undefined) {
            return data;
        }

        if (data[0]["success"] !== undefined) {
            this._userName = data[0]["success"]["username"];
            this._bridgeConnected = true;
            return data;
        }

        return data;

    }

    getAllData() {
        this._bridgeData = this._bridgeGET(`${this._bridgeUrl}/${this._userName}`);
        return this._bridgeData;
    }

    setLights(lights, data) {
        let url = "";

        switch (typeof(lights)) {
            case "number":
                url = `${this._bridgeUrl}/${this._userName}/lights/${lights.toString()}/state`;
                return this._bridgePUT(url, data);

            case "object":
                let light;
                let result = [];
                for (light in lights) {
                    url = `${this._bridgeUrl}/${this._userName}/lights/${lights[light].toString()}/state`;
                    result = result.concat(this._bridgePUT(url, data));
                }
                return result;

            default:
                return null;
        }
    }
}



var PhueBridge = class PhueBridge extends _PhueBridge {
    constructor(params) {
        super(params);

        Object.assign(this, params);
    }
};