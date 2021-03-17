'use strict';

/**
 * phueentertainmentapi
 * JavaScript library for Philips Hue Entertainment API.
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
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const ByteArray = imports.byteArray;
const Lang = imports.lang;
const DTLSClient = Me.imports.dtlsclient;
const PhueScreenshot = Me.imports.phuescreenshot;

const StreamingArea = {
    WIDTH: 0.2,
    HEIGHT: 0.25
}

/**
 * PhueEntertainment class. Provides Entertainment api to Philips hue bridge
 * 
 * @class PhueMenu
 * @constructor
 * @return {Object} menu widget instance
 */
var PhueEntertainment =  GObject.registerClass({
    GTypeName: "PhueEntertainment",
    Properties: {
        "ip": GObject.ParamSpec.string("ip", "ip", "ip", GObject.ParamFlags.READWRITE, null),
        "username": GObject.ParamSpec.string("username", "username", "username", GObject.ParamFlags.READWRITE, null),
        "clientkey": GObject.ParamSpec.string("clientkey", "clientkey", "clientkey", GObject.ParamFlags.READWRITE, null),
    },
    Signals: {
        "connected": {},
        "disconnected": {}
    }
}, class PhueEntertainment extends GObject.Object {

    /**
     * PhueMenu class initialization
     *  
     * @method _init
     * @private
     */
    _init(props={}) {
        super._init(props);

        this.gradient = false;
        this.intensity = 40;
        this.brightness = 0xFF;

        this.dtls = new DTLSClient.DTLSClient({ip: this._ip, port: 2100, pskidentity: this._username, psk: this._clientkey});
        this.dtls.connect("connected", () => {
            this.emit("connected");
        });
    }

    set ip(value) {
        this._ip = value;

    }

    get ip() {
        return this._ip;
    }

    set username(value) {
        this._username = value;

    }

    get username() {
        return this._username;
    }

    set clientkey(value) {
        this._clientkey = value;

    }

    get clientkey() {
        return this._clientkey;
    }

    /**
     * Try to connect to the Philips Hue bridge
     * using the dtls.
     * 
     * @method connectBridge
     */
    connectBridge() {
        this.dtls.connectBridge();
    }

    /**
     * Closes dtls connetion to the Philips Hue bridge.
     * 
     * @method connectBridge
     */
    closeBridge() {
        this.dtls.closeBridge();
    }

    /**
     * Sets the intensity of entertainment effects
     * 
     * @method setIntensity
     * @param {Number} time in miliseconds
     */
    setIntensity(intensity) {
        this.intensity = intensity;
    }

    /**
     * Sets the brightness of entertainment effects
     * 
     * @method setBrightness
     * @param {Number} 0-254
     */
    setBrightness(brightness) {
        this.brightness = brightness;
    }

    /**
     * Creates header of light used in dtls data
     * for controlling the lights
     * 
     * @method _createLightHeader
     * @param {String} "color" or "brightness" mode
     * @return {Object} header - needs concat light data
     */
    _createLightHeader(headerType) {
        let header = [];
        header = [0x48, 0x75, 0x65, 0x53, 0x74, 0x72, 0x65, 0x61, 0x6d]; /* HueStream */
        header = header.concat([0x01, 0x00]); /* version 1.0 */
        header = header.concat([0x00]); /* sequence number - currently ignored by the bridge */
        header = header.concat([0x00, 0x00]); /* reserved */
        if (headerType === "color") {
            header = header.concat([0x00]); /* color mode RGB */
        } else {
            header = header.concat([0x01]); /* brightness mode */
        }
        header = header.concat([0x00]); /* reserved */

        return header;
    }

    /**
     * This is the core magic of random entertainment effect.
     * 
     * @method promisRandom
     */
    promisRandom() {
        return new Promise((resolve, reject) => {

            let lightsArray = this._createLightHeader("color");

            for (let i = 0; i < this.lights.length; i++) {

                lightsArray = lightsArray.concat(this.lights[i]);

                let r = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/254));
                let g = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/254));
                let b = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/254));

                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
            }

            if (this.gradient) {
                for (let i = 0; i < 7; i++) {
                    lightsArray = lightsArray.concat([0x01, 0x00, i]);

                    let r = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/254));
                    let g = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/254));
                    let b = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/254));

                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                }
            }

            this.dtls.sendEncrypted(lightsArray);
            resolve();
        });
    }

    /**
     * This is the scheduler of random entertainment effect.
     * 
     * @method randomStream
     */
    async randomStream() {
            if (!this._doStreaming) {
                return;
            }

            if (this._checkChangeStream()) {
                return;
            }

            await this.promisRandom();

            GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.intensity, () => {
                this.randomStream();
            });
    }

    /**
     * This is the core magic of track cursor entertainment effect.
     * 
     * @method promisCursoreColor
     */
    promisCursoreColor() {
        return new Promise((resolve, reject) => {
            let color = this.screenshot.cursorColor;

            let lightsArray = this._createLightHeader("color");

            let r = Math.round(color.red * (this.brightness/254));
            let g = Math.round(color.green * (this.brightness/254));
            let b = Math.round(color.blue * (this.brightness/254));

            for (let i = 0; i < this.lights.length; i++) {

                lightsArray = lightsArray.concat(this.lights[i]);

                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
            }

            if (this.gradient) {
                for (let i = 0; i < 7; i++) {
                    lightsArray = lightsArray.concat([0x01, 0x00, i]);

                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                }
            }

            this.dtls.sendEncrypted(lightsArray);

            resolve();
        });
    }

    /**
     * This is the scheduler of track cursor entertainment effect.
     * 
     * @method followCursor
     */
    async followCursor() {
        if (!this._doStreaming) {
            return;
        }

        if (this._checkChangeStream()) {
            return;
        }

        await this.promisCursoreColor();

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.intensity, () => {
            this.screenshot.updateCursorColor();
        });
    }

    /**
     * Returns the rectangle on the actual screen that is around
     * the relative location of light in Philips Hue
     * entertainment setting
     * 
     * @method getRectangleOfLight
     * @param {Number} screenWidth
     * @param {Number} screenHeight
     * @param {Object} coordinates of the light in Entertainment settings
     * @return {Object} rectangle of the light in actual screen
     */
    getRectangleOfLight(screenWidth, screenHeight, location) {
        /* 2 because the demo room in app has TV of half the size of the room */
        let tmpWidth = 2 * location[0] * (screenWidth/2) + screenWidth/2;
        if (tmpWidth < 0) {
            tmpWidth = 0;
        }
        if (tmpWidth > this.screenWidth) {
            tmpWidth = this.screenWidth;
        }

        let minWidth = Math.round(Math.max(0, tmpWidth - screenWidth * StreamingArea.WIDTH / 2));
        let maxWidth = Math.round(Math.min(screenWidth, tmpWidth + screenWidth * StreamingArea.WIDTH / 2));

        let tmpHeight =  -1 * location[2] * (screenHeight/2) + screenHeight/2;

        let minHeight = Math.round(Math.max(0, tmpHeight - screenHeight * StreamingArea.HEIGHT / 2));
        let maxHeight = Math.round(Math.min(screenHeight, tmpHeight + screenHeight * StreamingArea.HEIGHT / 2));

        return [[minWidth, maxWidth],[],[minHeight, maxHeight]]
    }

    /**
     * This is the scheduler and the core magic of sync screen entertainment effect.
     * 
     * @method doSyncSreen
     */
    async doSyncSreen() {
        if (!this._doStreaming) {
            return;
        }

        if (this._checkChangeStream()) {
            return;
        }

        let lightsArray = this._createLightHeader("color");

        let widthRectangle;
        let roomRectangle;
        let heightRectangle;

        let r;
        let g;
        let b;

        let x;
        let y;

        for (let i = 0; i < this.lights.length; i++) {
            [widthRectangle, roomRectangle, heightRectangle] = this.lightsRectangles[i];

            x = widthRectangle[0] + (widthRectangle[1] - widthRectangle[0]) / 2;
            y = heightRectangle[0] + (heightRectangle[1] - heightRectangle[0]) / 2;

            let result = await this.screenshot.getColorPixel(Math.round(x), Math.round(y));

            r = Math.round(result.red * (this.brightness/254));
            g = Math.round(result.green * (this.brightness/254));
            b = Math.round(result.blue * (this.brightness/254));

            lightsArray = lightsArray.concat(this.lights[i]);

            lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));

        }

        if (this.gradient) {
            for (let i = 0; i < 7; i++) {
                [widthRectangle, roomRectangle, heightRectangle] = this.gradientRectangles[i];

                x = widthRectangle[0] + (widthRectangle[1] - widthRectangle[0]) / 2;
                y = heightRectangle[0] + (heightRectangle[1] - heightRectangle[0]) / 2;
    
                let result = await this.screenshot.getColorPixel(Math.round(x), Math.round(y));
    
                r = Math.round(result.red * (this.brightness/254));
                g = Math.round(result.green * (this.brightness/254));
                b = Math.round(result.blue * (this.brightness/254));

                lightsArray = lightsArray.concat([0x01, 0x00, i]);

                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
            }
        }

        this.dtls.sendEncrypted(lightsArray);

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.intensity, () => {
            this.doSyncSreen();
        });
    }

    /**
     * Check if the entertainment effect has been changed
     * in the menu and thus it should change.
     * 
     * @method _checkChangeStream
     * @return {Boolean} true for yes - change the effect
     */
    _checkChangeStream() {
        if (!this._doStreaming) {
            return false;
        }

        if (this._changeToMe === undefined) {
            return false;
        }

        if (this._changeToMe["done"]) {
            delete(this._changeToMe);
            return false;
        }

        this._doStreaming = false; /* start function will reactivate this */
        this._changeToMe["done"] = true;

        this._changeToMe["func"].bind(this)(
            this._changeToMe["prams"][0],
            this._changeToMe["prams"][1],
            this._changeToMe["prams"][2]
        );


        return true;
    }

    /**
     * Starts random entertainment effect
     * 
     * @method startRandom
     * @param {Array} lights to by synchronized
     * @param {Array} relative locations of lights
     * @param {Boolean} Is the gradient light strip in the group?
     */
    startRandom(lights, lightsLocations, gradient) {
        if (this._doStreaming) {
            this._changeToMe = {
                "done": false,
                "func": this.startRandom,
                "prams": [lights, lightsLocations, gradient]
            }

            return;
        }

        this.lights = [];
        this.lightsLocations = [];
        for (let i = 0; i < lights.length; i++) {
            this.lights.push(DTLSClient.uintToArray(lights[i], 24));
            this.lightsLocations.push(lightsLocations[lights[i]]);
        }

        this.gradient = gradient;
        this._doStreaming = true;

        this.randomStream();
    }

    /**
     * Starts track cursor entertainment effect
     * 
     * @method startFollowCursor
     * @param {Array} lights to by synchronized
     * @param {Array} relative locations of lights
     * @param {Boolean} Is the gradient light strip in the group?
     */
    startFollowCursor(lights, lightsLocations, gradient) {
        if (this._doStreaming) {
            this._changeToMe = {
                "done": false,
                "func": this.startFollowCursor,
                "prams": [lights, lightsLocations, gradient]
            }

            return;
        }

        this.lights = [];
        this.lightsLocations = [];
        for (let i = 0; i < lights.length; i++) {
            this.lights.push(DTLSClient.uintToArray(lights[i], 24));
            this.lightsLocations.push(lightsLocations[lights[i]]);
        }

        this.gradient = gradient;
        this._doStreaming = true;

        this.screenshot = new PhueScreenshot.PhueScreenshot();
        this.screenshot.connect("cursorColor", () => {
            this.followCursor();
        });
        this.screenshot.updateCursorColor();
    }

    /**
     * Starts syc screen entertainment effect
     * 
     * @method startSyncScreen
     * @param {Array} lights to by synchronized
     * @param {Array} relative locations of lights
     * @param {Boolean} Is the gradient light strip in the group?
     */
    startSyncScreen(lights, lightsLocations, gradient) {
        if (this._doStreaming) {
            this._changeToMe = {
                "done": false,
                "func": this.startSyncScreen,
                "prams": [lights, lightsLocations, gradient]
            }

            return;
        }

        this.lights = [];
        this.lightsLocations = [];
        for (let i = 0; i < lights.length; i++) {
            this.lights.push(DTLSClient.uintToArray(lights[i], 24));
            this.lightsLocations.push(lightsLocations[lights[i]]);
        }

        this.gradient = gradient;
        this._doStreaming = true;

        this.screenshot = new PhueScreenshot.PhueScreenshot();

        let currentMonitorIndex = global.display.get_current_monitor();
        let geometry = global.display.get_monitor_geometry(currentMonitorIndex);

        this.screenWidth = global.screen_width;
        this.screenHeight = global.screen_height;

        this.lightsRectangles = [];
        for (let i = 0; i < this.lights.length; i++) {
            this.lightsRectangles.push(this.getRectangleOfLight(this.screenWidth, this.screenHeight, this.lightsLocations[i]));
        }

        this.gradientRectangles = [];
        if (this.gradient) {
            this.gradientRectangles.push(this.getRectangleOfLight(this.screenWidth, this.screenHeight, [-0.5, 0.75, -1]));
            this.gradientRectangles.push(this.getRectangleOfLight(this.screenWidth, this.screenHeight, [-0.5, 0.75, 0]));

            this.gradientRectangles.push(this.getRectangleOfLight(this.screenWidth, this.screenHeight, [-0.35, 0.75, 1]));
            this.gradientRectangles.push(this.getRectangleOfLight(this.screenWidth, this.screenHeight, [0, 0.75, 1]));
            this.gradientRectangles.push(this.getRectangleOfLight(this.screenWidth, this.screenHeight, [0.35, 0.75, 1]));

            this.gradientRectangles.push(this.getRectangleOfLight(this.screenWidth, this.screenHeight, [0.5, 0.75, 0]));
            this.gradientRectangles.push(this.getRectangleOfLight(this.screenWidth, this.screenHeight, [0.5, 0.75, -1]));
        }

        this.doSyncSreen()
    }

    /**
     * Disable the scheduler of entertainment effect
     * 
     * @method stopStreaming
     */
    stopStreaming() {
        this._doStreaming = false;
    }
})