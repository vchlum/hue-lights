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
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const ByteArray = imports.byteArray;
const DTLSClient = Me.imports.dtlsclient;
const PhueScreenshot = Me.imports.phuescreenshot;
const Utils = Me.imports.utils;

const LightRectangle = {
    WIDTH: 0.3,
    HEIGHT: 0.4
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

        let signal;

        this.gid = "";
        this.gradient = false;
        this.intensity = 40;
        this.brightness = 0xFF;

        this._signals = {};

        this.dtls = new DTLSClient.DTLSClient({ip: this._ip, port: 2100, pskidentity: this._username, psk: this._clientkey});
        signal = this.dtls.connect("connected", () => {
            this.emit("connected");
        });

        this._signals[signal] = { "object": this.dtls };
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
     * Set the gid of a group
     * 
     * @method setGID
     * @param {String} gid
     */
    setGID(gid) {
        this.gid = gid;
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
     * @method closeBridge
     */
    closeBridge() {
        this.stopStreaming();
        this.dtls.closeBridge();

        for (let id in this._signals) {
            try {
                this._signals[id]["object"].disconnect(id);
                delete(this._signals[id]);
            } catch {
                continue;
            }
        }

        this.emit("disconnected");
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
     * @param {Number} 0-255
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
        header = Utils.string2Hex("HueStream");  /* HueStream */
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
     * Creates header version2 of light used in dtls data
     * for controlling the lights
     * 
     * @method _createLightHeader2
     * @param {String} "color" or "brightness" mode
     * @return {Object} header - needs concat light data
     */
    _createLightHeader2(headerType) {
        let header = [];
        header = Utils.string2Hex("HueStream"); /* HueStream */
        header = header.concat([0x02, 0x00]); /* version 2.0 */
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

                let r = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/255));
                let g = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/255));
                let b = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/255));

                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
            }

            this.dtls.sendEncrypted(lightsArray);

            if (this.gradient) {
                lightsArray = this._createLightHeader2("color");

                lightsArray = lightsArray.concat(Utils.string2Hex(this.gid));

                for (let i = 2; i < 9; i++) {
                    lightsArray = lightsArray.concat([i]);

                    let r = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/255));
                    let g = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/255));
                    let b = Math.round(DTLSClient.getRandomInt(0xFF) * (this.brightness/255));

                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                    lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                }

                this.dtls.sendEncrypted(lightsArray);
            }

            resolve();
        });
    }

    /**
     * This is the scheduler of random entertainment effect.
     * 
     * @method doRandom
     */
    async doRandom() {
        if (!this._doStreaming) {
            return;
        }

        if (this._checkChangeStream()) {
            return;
        }

        await this.promisRandom();

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.intensity, () => {
            this.doRandom();
        });
    }

    /**
     * This is the scheduler and the core magic of track cursor entertainment effect.
     * 
     * @method doCursorColor
     */
    async doCursorColor() {
        if (!this._doStreaming) {
            return;
        }

        if (this._checkChangeStream()) {
            return;
        }

        let [x, y] = global.get_pointer();

        let color = await this.screenshot.getColorPixel(x, y);

        let lightsArray = this._createLightHeader("color");

        let red = this.adjustColorElement(color.red);
        let green = this.adjustColorElement(color.green);
        let blue = this.adjustColorElement(color.blue);

        let r = Math.round(red * (this.brightness/255));
        let g = Math.round(green * (this.brightness/255));
        let b = Math.round(blue * (this.brightness/255));

        for (let i = 0; i < this.lights.length; i++) {

            lightsArray = lightsArray.concat(this.lights[i]);

            lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
        }

        if (this.lights.length > 0) {
            this.dtls.sendEncrypted(lightsArray);
        }

        if (this.gradient) {
            lightsArray = this._createLightHeader2("color");

            lightsArray = lightsArray.concat(Utils.string2Hex(this.gid));

            for (let i = 2; i < 9; i++) {
                lightsArray = lightsArray.concat([i]);

                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
            }

            this.dtls.sendEncrypted(lightsArray);
        }

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.intensity, () => {
            this.doCursorColor();
        });
    }

    /**
     * For fixing colors like rgb(1,0,1)
     *
     * @method adjustColorElement
     * @param {Number} color element
     * @return {Number} color element
     */
     adjustColorElement(c) {
        if (c <= 5) {
            return 0;
        }

        if (c >= 249) {
            return 255;
        }

        return c;
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
    getRectangleOfLight(startX, startY, screenWidth, screenHeight, location) {

        /* 2 because the demo room in app has TV of half the size of the room */
        let tmpWidth = 2 * location[0] * (screenWidth/2) + screenWidth/2;
        if (tmpWidth < 0) {
            tmpWidth = 0;
        }
        if (tmpWidth > this.screenWidth) {
            tmpWidth = this.screenWidth;
        }

        let minWidth = Math.round(Math.max(0, tmpWidth - screenWidth * LightRectangle.WIDTH / 2));
        let maxWidth = Math.round(Math.min(screenWidth, tmpWidth + screenWidth * LightRectangle.WIDTH / 2));

        let tmpHeight =  -1 * location[2] * (screenHeight/2) + screenHeight/2;

        let minHeight = Math.round(Math.max(0, tmpHeight - screenHeight * LightRectangle.HEIGHT / 2));
        let maxHeight = Math.round(Math.min(screenHeight, tmpHeight + screenHeight * LightRectangle.HEIGHT / 2));

        return [
            [startX + minWidth, startX + maxWidth],
            [],
            [startY + minHeight, startY + maxHeight]
        ]
    }

    /**
     * This is the scheduler and the core magic of sync screen entertainment effect.
     * 
     * @method doSyncSreen
     */
    async doSyncSreen(screenRectangle) {

        if (!this._doStreaming) {
            return;
        }

        if (this._checkChangeStream()) {
            return;
        }

        if (screenRectangle === undefined &&
            (this.screenWidth !== global.screen_width ||
            this.screenHeight !== global.screen_height)) {
            /* screen has been changed */
            this.closeBridge();
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

            let quarterWidth = (widthRectangle[1] - widthRectangle[0]) / 4;
            let quarterheight = (heightRectangle[1] - heightRectangle[0]) / 4;

            let left = await this.screenshot.getColorPixel(widthRectangle[0] + quarterWidth, Math.round(y));
            let right = await this.screenshot.getColorPixel(widthRectangle[1] - quarterWidth, Math.round(y));
            let top = await this.screenshot.getColorPixel(Math.round(x), heightRectangle[0] + quarterheight);
            let bottom = await this.screenshot.getColorPixel(Math.round(x), heightRectangle[1] - quarterheight);

            let red = (left.red + right.red + top.red + bottom.red) / 4;
            let green = (left.green + right.green + top.green + bottom.green) / 4;
            let blue = (left.blue + right.blue + top.blue + bottom.blue) / 4;

            red = this.adjustColorElement(red);
            green = this.adjustColorElement(green);
            blue = this.adjustColorElement(blue);

            r = Math.round(red * (this.brightness/255));
            g = Math.round(green * (this.brightness/255));
            b = Math.round(blue * (this.brightness/255));

            lightsArray = lightsArray.concat(this.lights[i]);

            lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
            lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));

        }

        if (this.lights.length > 0) {
            this.dtls.sendEncrypted(lightsArray);
        }

        if (this.gradient) {
            lightsArray = this._createLightHeader2("color");

            lightsArray = lightsArray.concat(Utils.string2Hex(this.gid));

            for (let i = 2; i < 9; i++) {
                [widthRectangle, roomRectangle, heightRectangle] = this.gradientRectangles[i - 2];

                x = widthRectangle[0] + (widthRectangle[1] - widthRectangle[0]) / 2;
                y = heightRectangle[0] + (heightRectangle[1] - heightRectangle[0]) / 2;

                let quarterWidth = (widthRectangle[1] - widthRectangle[0]) / 4;
                let quarterheight = (heightRectangle[1] - heightRectangle[0]) / 4;
    
                let left = await this.screenshot.getColorPixel(widthRectangle[0] + quarterWidth, Math.round(y));
                let right = await this.screenshot.getColorPixel(widthRectangle[1] - quarterWidth, Math.round(y));
                let top = await this.screenshot.getColorPixel(Math.round(x), heightRectangle[0] + quarterheight);
                let bottom = await this.screenshot.getColorPixel(Math.round(x), heightRectangle[1] - quarterheight);

                let red = (left.red + right.red + top.red + bottom.red) / 4;
                let green = (left.green + right.green + top.green + bottom.green) / 4;
                let blue = (left.blue + right.blue + top.blue + bottom.blue) / 4;

                red = this.adjustColorElement(red);
                green = this.adjustColorElement(green);
                blue = this.adjustColorElement(blue);

                r = Math.round(red * (this.brightness/255));
                g = Math.round(green * (this.brightness/255));
                b = Math.round(blue * (this.brightness/255));

                lightsArray = lightsArray.concat([i]);

                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(r, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(g, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
                lightsArray = lightsArray.concat(DTLSClient.uintToArray(b, 8));
            }

            this.dtls.sendEncrypted(lightsArray);
        }

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.intensity, () => {
            this.doSyncSreen(screenRectangle);
        });
    }

    /**
     * Checks the suitability of screen
     * and display(s) resolution for sync
     *
     * @method checkSyncSuitableResolution
     * @return {Boolean} True if screen is rectangle
     */
     checkSyncSuitableResolution() {
        let totalWidth = 0;
        let totalHeight = 0;
        let possibleWidths = [];
        let possibleHeights = [];

        for (let i = 0; i < global.display.get_n_monitors(); i++) {
            let geometry = global.display.get_monitor_geometry(i);

            totalWidth += geometry.width;
            totalHeight += geometry.height;

            possibleWidths.push(geometry.width);
            possibleHeights.push(geometry.height);

        }

        if (global.screen_width === totalWidth) {
            for (let i = 0; i < possibleHeights.length; i++) {
                if (global.screen_height !== possibleHeights[i]) {

                    return false;
                }
            }

            return true;
        }

        if (global.screen_height === totalHeight) {
            for (let i = 0; i < possibleWidths.length; i++) {
                if (global.screen_width !== possibleWidths[i]) {

                    return false;
                }
            }

            return true;
        }

        return false;
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

        this._changeToMe["func"].bind(this).apply(
            this,
            this._changeToMe["prams"]
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

        this.doRandom();
    }

    /**
     * Starts track cursor entertainment effect
     * 
     * @method startCursorColor
     * @param {Array} lights to by synchronized
     * @param {Array} relative locations of lights
     * @param {Boolean} Is the gradient light strip in the group?
     */
    startCursorColor(lights, lightsLocations, gradient) {
        if (this._doStreaming) {
            this._changeToMe = {
                "done": false,
                "func": this.startCursorColor,
                "prams": [lights, lightsLocations, gradient]
            }

            return;
        }

        this.lights = [];
        for (let i = 0; i < lights.length; i++) {
            this.lights.push(DTLSClient.uintToArray(lights[i], 24));
        }

        this.gradient = gradient;
        this._doStreaming = true;

        this.screenshot = new PhueScreenshot.PhueScreenshot();

        this.doCursorColor();
    }

    /**
     * Starts syc screen entertainment effect
     * 
     * @method startSyncScreen
     * @param {Array} lights to by synchronized
     * @param {Array} relative locations of lights
     * @param {Boolean} Is the gradient light strip in the group?
     */
    startSyncScreen(screenRectangle, lights, lightsLocations, gradient) {
        if (this._doStreaming) {
            this._changeToMe = {
                "done": false,
                "func": this.startSyncScreen,
                "prams": [screenRectangle, lights, lightsLocations, gradient]
            }

            return;
        }

        if (screenRectangle === undefined && !this.checkSyncSuitableResolution()) {
            Main.notify(
                _("Hue Lights - Sync screen"),
                _("Your screen is not a solid rectangle.")
            );
            this.closeBridge();
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

        let startX = 0;
        let startY = 0;
        this.screenWidth = global.screen_width;
        this.screenHeight = global.screen_height;

        if (screenRectangle !== undefined) {
            startX = screenRectangle[0];
            startY = screenRectangle[1];
            this.screenWidth = screenRectangle[2];
            this.screenHeight = screenRectangle[3];
        }

        this.lightsRectangles = [];
        for (let i = 0; i < this.lights.length; i++) {
            this.lightsRectangles.push(this.getRectangleOfLight(
                startX,
                startY,
                this.screenWidth,
                this.screenHeight,
                this.lightsLocations[i]
            ));
        }

        this.gradientRectangles = [];
        if (this.gradient) {
            this.gradientRectangles.push(this.getRectangleOfLight(
                startX,
                startY,
                this.screenWidth,
                this.screenHeight,
                [-0.5, 0.75, -1]
            ));

            this.gradientRectangles.push(this.getRectangleOfLight(
                startX,
                startY,
                this.screenWidth,
                this.screenHeight,
                [-0.5, 0.75, 0]
            ));

            this.gradientRectangles.push(this.getRectangleOfLight(
                startX,
                startY,
                this.screenWidth,
                this.screenHeight,
                [-0.35, 0.75, 1]
            ));

            this.gradientRectangles.push(this.getRectangleOfLight(
                startX,
                startY,
                this.screenWidth,
                this.screenHeight,
                [0, 0.75, 1]
            ));

            this.gradientRectangles.push(this.getRectangleOfLight(
                startX,
                startY,
                this.screenWidth,
                this.screenHeight,
                [0.35, 0.75, 1]
            ));

            this.gradientRectangles.push(this.getRectangleOfLight(
                startX,
                startY,
                this.screenWidth,
                this.screenHeight,
                [0.5, 0.75, 0]
            ));

            this.gradientRectangles.push(this.getRectangleOfLight(
                startX,
                startY,
                this.screenWidth,
                this.screenHeight,
                [0.5, 0.75, -1]
            ));
        }

        this.doSyncSreen(screenRectangle);
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