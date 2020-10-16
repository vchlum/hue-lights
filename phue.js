const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const HueApi = Me.imports.phueapi;
const Utils = Me.imports.utils;
const Gettext = imports.gettext;
const _ = Gettext.gettext;

class _Phue {

    constructor() {
        /*Utils.saveBridges({"foo":{"ip":"1.1.1.1"},
                           "bar":{"ip":"1.1.1.2"}
                          });*/
        this.bridges = Utils.readBridges();
        this.instances = {};
    }

    _checkBridge(bridgeid) {
        let res = this.instances[bridgeid].getConfig();
        this.bridges[bridgeid]["name"] = res["name"];
        this.bridges[bridgeid]["mac"] = res["mac"];
        this.instances[bridgeid].getAll();
    }

    addBridgeManual(ip) {
        let instance = new HueApi.PhueBridge(ip);
        let res = instance.connectBridge();
        log(JSON.stringify(res));
        if (res.length > 0 && "success" in res[0]) {
            let username = res[0]["success"]["username"];
            log(`new username: ${username} for ip: ${ip}`);
            res = instance.getConfig();
            let bridgeid = res["bridgeid"].toLowerCase();
            this.bridges[bridgeid] = {"ip": ip, "username": username, "name": res["name"], "mac": res["mac"]};
            Utils.saveBridges(this.bridges);
            this.instances[bridgeid] = instance;
            return true;
        }
        return false;
    }

    checkBridges() {
        let disData = HueApi.discoverBridges();

        for (let i in disData) {
            let bridgeid = disData[i]["id"];
            if (bridgeid in this.bridges) {
                if (disData[i]["internalipaddress"] !== this.bridges[bridgeid]["ip"]) {
                    this.bridges[this.bridges]["ip"] = disData[i]["internalipaddress"];
                }
            } else {
                this.bridges[bridgeid] = {"ip":disData[i]["internalipaddress"]};
            }
        }
    
        for (let bridgeid in this.bridges) {

            let instance = new HueApi.PhueBridge(this.bridges[bridgeid]["ip"]);
            this.instances[bridgeid] = instance;
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

        Utils.saveBridges(this.bridges);
    }

    run() {
        this.checkBridges();

        log(JSON.stringify(Utils.readBridges()));
    }
}

var Phue = class Phue extends _Phue {
    constructor(params) {
        super(params);

        Object.assign(this, params);
    }
};