'use strict';

// This is a handy import we'll use to grab our extension's object
const ExtensionUtils = imports.misc.extensionUtils;
const HueLights = ExtensionUtils.getCurrentExtension();
const HueApi = HueLights.imports.phueapi;

function init() {
    log(`initializing ${HueLights.metadata.name} version ${HueLights.metadata.version}`);
}

function enable() {
    let bridges = [];
    let ip = "";
    let bridge = null;

    var disData = HueApi.discoverBridges();

    for (let discovered in disData) {
        ip = disData[discovered]["internalipaddress"];
        bridge = new HueApi.PhueBridge(ip);
        bridge.setUserName("JCnrIrXDg2tGV0qfrNwNIv2uR9J5qL9ABIgyHTCK");
        bridges.push(bridge);

        if (!bridge.isConnected()) {
            log(JSON.stringify(bridge.connectBridge()));
        }
        for (let key in bridge.getAllData()) {
            log(key);
        }
        //log(JSON.stringify(bridge.setLights([12, 21], {"on":true, "sat":254, "bri":254,"hue":10000})));
    }
    log(`enabling ${HueLights.metadata.name} version ${HueLights.metadata.version}`);
}

function disable() {
    log(`disabling ${HueLights.metadata.name} version ${HueLights.metadata.version}`);
}
