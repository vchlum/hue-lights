'use strict';

/**
 * extension hue-lights menu
 * JavaScript Gnome extension for Philips Hue bridges - Menu creator.
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

const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Hue = Me.imports.phue;
const HueEntertainment = Me.imports.phueentertainmentapi;
const PhueRequestype = Me.imports.phueapi.PhueRequestype;
const Utils = Me.imports.utils;
const ColorPicker = Me.imports.colorpicker;
const ModalSelector = Me.imports.modalselector;
const AreaSelector = Me.imports.areaselector;
const Queue = Me.imports.queue;
const Util = imports.misc.util;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Slider = imports.ui.slider;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;

const Gettext = imports.gettext;
const _ = Gettext.gettext;

const PhueMenuPosition = {
    CENTER: 0,
    RIGHT: 1,
    LEFT: 2
};

const IconSize = 20;

const PhueIconPack = {
    NONE: 0,
    BRIGHT: 1,
    DARK: 2
};

const StreamState = {
    STOPPED: 0,
    STARTING: 1,
    STARTED: 2,
    STOPPING: 3,
    RUNNING: 4,
    FAILED: 5
};

/**
 * PhueMenu class. Provides widget with menu items.
 * 
 * @class PhueMenu
 * @constructor
 * @return {Object} menu widget instance
 */
var PhueMenu = GObject.registerClass({
     GTypeName: 'PhueMenu'
}, class PhueMenu extends PanelMenu.Button {

    /**
     * PhueMenu class initialization
     *  
     * @method _init
     * @private
     */
    _init() {

        super._init(0.0, Me.metadata.name, false);

        let signal;

        this._signals = {};

        this.refreshMenuObjects = {};
        this.oldNotifylight = {};
        this.bridgeInProblem = {}
        this._bridgesInMenu = [];
        this._bridgesInMenuShowed = [];
        this._defaultBridgeInMenu = "";
        this._openMenuDefault = null;
        this._isStreaming = {};
        this._waitingNotification = {};
        this._notificationQueues = {};
        this._rebuildingMenu = false;
        this._rebuildingMenuFirstTime = true;
        this.bridesData = {};

        this._settings = ExtensionUtils.getSettings(Utils.HUELIGHTS_SETTINGS_SCHEMA);
        signal = this._settings.connect("changed", () => {
            if (this.readSettings()) {
                this.rebuildMenuStart();
            }
            this.setPositionInPanel();
            this.hue.setConnectionTimeout(this._connectionTimeout);
        });
        this._appendSignal(signal, this._settings, false);

        this.hue = new Hue.Phue(true);

        this.readSettings();
        this.hue.setConnectionTimeout(this._connectionTimeout);
        this._indicatorPositionBackUp = -1;
        this.setPositionInPanel();

        this.colorPicker = {};

        let icon = new St.Icon({
            gicon : Gio.icon_new_for_string(Me.dir.get_path() + '/media/HueIcons/devicesBridgesV2.svg'),
            style_class : 'system-status-icon',
        });

        let iconEffect = this._getIconBriConEffect(PhueIconPack.BRIGHT);
        icon.add_effect(iconEffect);

        this.add_child(icon);

        this.rebuildMenuStart(true);

        signal = this.menu.connect("open-state-changed", () => {
            if (this.menu.isOpen) {
                for (let i in this.hue.instances) {
                        /* this will invoke this.refreshMenu via "all-data" */
                        this.hue.instances[i].getAll();
                }

                if (this._openMenuDefault !== null){
                    this._openMenuDefault.open(false);
                }
            }
        });
        this._appendSignal(signal, this.menu, false);

        /* if the desktop is starting up, wait until starting is finished */
        this._startingUpSignal = undefined;
        if (Main.layoutManager._startingUp) {
            this._startingUpSignal = Main.layoutManager.connect(
                "startup-complete",
                () => {
                    this._setScreenChangeDetection();
                }
            );
        } else {
            this._setScreenChangeDetection();
        }
    }

    /**
     * Connects signals with change of displays
     * to rebuild menu and detect new displays.
     * 
     * @method _setScreenChangeDetection
     * @private
     */
    _setScreenChangeDetection() {
        let signal;

        if (this._startingUpSignal !== undefined) {
            Main.layoutManager.disconnect(this._startingUpSignal);
            this._startingUpSignal = undefined;
        }

        signal = Main.layoutManager.connect(
            "monitors-changed",
            () => {
                this.rebuildMenuStart();
            }
        );
        this._appendSignal(signal, Main.layoutManager, false);
    }

    /**
     * Returns effect that can be applied on icon
     * 
     * @method _getIconColorEffect
     * @private
     * @param {Enum} requested icon effect
     * @return {Object} effect
     */
    _getIconColorEffect(reqEffect) {

        let color;
        switch (reqEffect) {

            case PhueIconPack.BRIGHT:

                color = new Clutter.Color({
                    red: 237,
                    green: 237,
                    blue: 237,
                    alpha: 255
                });
                break;

            case PhueIconPack.DARK:

                color = new Clutter.Color({
                    red: 40,
                    green: 40,
                    blue: 40,
                    alpha: 255
                });
                break;

            default:
        }

        let effect = new Clutter.ColorizeEffect({tint: color});
        return effect;
    }

    /**
     * Returns effect that can be applied on icon
     * 
     * @method _getIconBriConEffect
     * @private
     * @param {Enum} requested icon effect
     * @return {Object} effect
     */
    _getIconBriConEffect(reqEffect) {

        let bri = 0.0;
        let cont = 0.0;

        let effect = new Clutter.BrightnessContrastEffect();
        switch (reqEffect) {

            case PhueIconPack.BRIGHT:

                bri = 0.8;
                cont = 0.2;
                break;

            case PhueIconPack.DARK:

                bri = 0.2;
                cont = 0.2;
                break;

            default:
        }

        effect.set_brightness(bri);
        effect.set_contrast(cont);
        return effect;
    }

    /**
     * Reads settings into class variables.
     * 
     * @method readSettings
     * @return {Boolean} True if the menu needs rebuild.
     */
    readSettings() {

        let menuNeedsRebuild = false;
        let tmpVal;

        /**
         * this.hue.bridges needs rebuild
         */
        tmpVal = JSON.stringify(this.hue.bridges);

        this.hue.bridges = this._settings.get_value(
            Utils.HUELIGHTS_SETTINGS_BRIDGES
        ).deep_unpack();

        if (tmpVal !== JSON.stringify(this.hue.bridges)) {
            this._bridgesInMenu = [];
            menuNeedsRebuild = true;
        }

        /**
         * this._zonesFirst needs rebuild
         */
        tmpVal = this._zonesFirst;

        this._zonesFirst = this._settings.get_boolean(
            Utils.HUELIGHTS_SETTINGS_ZONESFIRST
        );

        if (tmpVal !== this._zonesFirst) {
            menuNeedsRebuild = true;
        }

        /**
         * this._showScenes needs rebuild
         */
        tmpVal = this._showScenes;

        this._showScenes = this._settings.get_boolean(
            Utils.HUELIGHTS_SETTINGS_SHOWSCENES
        );

        if (tmpVal !== this._showScenes) {
            menuNeedsRebuild = true;
        }

        /**
         * this._compactMenu needs rebuild
         */
        tmpVal = this._compactMenu;

        this._compactMenu = this._settings.get_boolean(
            Utils.HUELIGHTS_SETTINGS_COMPACTMENU
        );

        if (tmpVal !== this._compactMenu) {
            menuNeedsRebuild = true;
        }

        /**
         * debug doesn't need rebuild
         */
        Utils.debug = this._settings.get_boolean(
            Utils.HUELIGHTS_SETTINGS_DEBUG
        );

        /**
         * this._iconPack needs rebuild
         */
        tmpVal = this._iconPack;

        this._iconPack = this._settings.get_enum(
            Utils.HUELIGHTS_SETTINGS_ICONPACK
        );

        if (tmpVal !== this._iconPack) {
            menuNeedsRebuild = true;
        }

        /**
         * this._indicatorPosition doesn't need rebuild
         */
        this._indicatorPosition = this._settings.get_enum(
            Utils.HUELIGHTS_SETTINGS_INDICATOR
        );

        /**
         * this._connectionTimeout doesn't need rebuild
         */
        this._connectionTimeout = this._settings.get_int(
            Utils.HUELIGHTS_SETTINGS_CONNECTION_TIMEOUT
        );

        /**
         * this._notifyLights doesn't need rebuild
         */
        this._notifyLights = this._settings.get_value(
            Utils.HUELIGHTS_SETTINGS_NOTIFY_LIGHTS
        ).deep_unpack();

        /**
         * this._entertainment doesn't need rebuild
         */
        this._entertainment = this._settings.get_value(
            Utils.HUELIGHTS_SETTINGS_ENTERTAINMENT
        ).deep_unpack();

        /**
         * this._syncSelectionKeyShortcut needs rebuild
         */
        tmpVal = this._syncSelectionKeyShortcut;

        this._syncSelectionKeyShortcut = this._settings.get_value(
            Utils.HUELIGHTS_SETTINGS_SYNC_SELECTION_KEY_SHORTCUT
        ).deep_unpack();

        if (tmpVal === undefined ||
            tmpVal.toString() !== this._syncSelectionKeyShortcut.toString()) {

            menuNeedsRebuild = true;
        }

        /**
         * this._menuSelected doesn't need rebuild
         */
        this._menuSelected = this._settings.get_value(
            Utils.HUELIGHTS_SETTINGS_MENU_SELECTED
        ).deep_unpack();

        return menuNeedsRebuild;
    }

    /**
     * Wite setting for current selection in menu
     *
     * @method writeEntertainmentSettings
     */
    writeMenuSelectedSettings() {

        this._settings.set_value(
            Utils.HUELIGHTS_SETTINGS_MENU_SELECTED,
            new GLib.Variant(
                Utils.HUELIGHTS_SETTINGS_MENU_SELECTED_TYPE,
                this._menuSelected
            )
        );
    }

    /**
     * Gets the group color based on lights turned on.
     * 
     * @method _getGroupColor
     * @private
     * @param {String} bridgeid
     * @param {Number} groupid
     * @return {Object} avarage RGB color
     */
    _getGroupColor(bridgeid, groupid) {
        let counter = 0;
        let r = 0;
        let g = 0;
        let b = 0;

        for (let lightid of this.bridesData[bridgeid]["groups"][groupid]["lights"]) {

            if (!this.bridesData[bridgeid]["lights"][lightid]["state"]["on"]) {
                continue;
            }

            if (this.bridesData[bridgeid]["lights"][lightid]["state"]["xy"] === undefined &&
                this.bridesData[bridgeid]["lights"][lightid]["state"]["ct"] === undefined) {
                continue;
            }

            let tmpR = 0;
            let tmpG = 0;
            let tmpB = 0;
            switch (this.bridesData[bridgeid]["lights"][lightid]["state"]["colormode"]) {

                case "xy":
                    [tmpR, tmpG, tmpB] = Utils.XYBriToColor(
                        this.bridesData[bridgeid]["lights"][lightid]["state"]["xy"][0],
                        this.bridesData[bridgeid]["lights"][lightid]["state"]["xy"][1],
                        255 /* or value["bri"] */
                    );
                    break;

                case "ct":
                    let kelvin = Utils.ctToKelvin(
                        this.bridesData[bridgeid]["lights"][lightid]["state"]["ct"]
                    );
                    [tmpR, tmpG, tmpB] = Utils.kelvinToRGB(kelvin);
                    break;

                default:
                    break;
            }

            r += tmpR;
            g += tmpG;
            b += tmpB;

            counter++;
        }

        if (counter > 0) {
            r = Math.round(r/counter);
            g = Math.round(g/counter);
            b = Math.round(b/counter);
        }

        return [r, g, b];
    }

    /**
     * Gets the group brightness based on lights turned on.
     * 
     * @method _getGroupBrightness
     * @private
     * @param {String} bridgeid
     * @param {Number} groupid
     * @return {Object} avarage brightness
     */
    _getGroupBrightness(bridgeid, groupid) {
        let counter = 0;
        let value = 0;

        if (this.bridesData[bridgeid]["groups"][groupid] === undefined) {
            return value;
        }

        if (this.bridesData[bridgeid]["groups"][groupid]["lights"] === undefined) {
            return value;
        }

        for (let lightid of this.bridesData[bridgeid]["groups"][groupid]["lights"]) {

            if (!this.bridesData[bridgeid]["lights"][lightid]["state"]["on"]) {
                continue;
            }

            if (this.bridesData[bridgeid]["lights"][lightid]["state"]["bri"] === undefined) {
                continue;
            }

            value += this.bridesData[bridgeid]["lights"][lightid]["state"]["bri"];
            counter++;
        }

        if (counter > 0) {
            value = Math.round(value/counter);
        }

        return value;
    }

    /**
     * Checks if color (XY) or color temperature (CT) is available
     * on group or light
     * 
     * @method _checkColorAttributeLightOrGroup
     * @private
     * @param {String} bridgeid
     * @param {String} type is "groups" or "lights"
     * @param {Number} id of group or light
     * @return {Object} array like [hasXY, hasCT]
     */
    _checkColorAttributeLightOrGroup(bridgeid, type, id) {
        let hasXY = true;
        let hasCT = true;
        let data = this.bridesData[bridgeid];

        switch (type) {
            case "lights":
                hasXY = true;
                hasCT = true;
                if (data["lights"][id]["state"]["xy"] === undefined) {
                    hasXY = false;
                }

                if (data["lights"][id]["state"]["ct"] === undefined) {
                    hasCT = false;
                }
                break;

            case "groups":
                hasXY = false;
                hasCT = false;

                for (let lightid of data["groups"][id]["lights"]) {
                    if (data["lights"][lightid]["state"]["xy"] !== undefined) {
                        hasXY = true;
                    }

                    if (data["lights"][lightid]["state"]["ct"] !== undefined) {
                        hasCT = true;
                    }

                    if (hasXY && hasCT) {
                        /* no need to search more */
                        break;
                    }
                }
                break;

            default:
                break;
        }

        return [hasXY, hasCT];
    }

    /**
     * Checks if brightness is available
     * on group or light
     * 
     * @method _checkBrightnessAttributeLightOrGroup
     * @private
     * @param {String} bridgeid
     * @param {String} type is "groups" or "lights"
     * @param {Number} id of group or light
     * @return {Boolean}
     */
    _checkBrightnessAttributeLightOrGroup(bridgeid, type, id) {
        let hasBri = true;
        let data = this.bridesData[bridgeid];

        switch (type) {
            case "lights":
                hasXY = true;
                hasCT = true;
                if (data["lights"][id]["state"]["bri"] === undefined) {
                    hasBri = false;
                }
                break;

            case "groups":
                hasBri = false;

                for (let lightid of data["groups"][id]["lights"]) {
                    if (data["lights"][lightid]["state"]["bri"] !== undefined) {
                        hasBri = true;
                    }

                    if (hasBri) {
                        /* no need to search more */
                        break;
                    }
                }
                break;

            default:
                break;
        }

        return hasBri;
    }

    /**
     * Generate almost useless ID number
     * 
     * @method _rndID
     * @private
     * @return {Number} randomly generated number
     */
    _rndID () {

        /* items in this.refreshMenuObjects may occure more then ones,
         * this way it is possible - otherwise, the ID is useless
         */
        return Math.round((Math.random()*1000000));
    }

    /**
     * Process entertainment data for
     * "switchEntertainment" event.
     * 
     * @method _switchEntertainmentDo
     * @private
     * @param {Object} data for event
     */
    _switchEntertainmentDo(data) {

        let bridgeid = data["bridgeid"];
        let object = data["object"];
        let bridgePath = data["bridgePath"];
        let parsedBridgePath = [];

        parsedBridgePath = bridgePath.split("::");

        parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

        if (!this.hue.instances[bridgeid].isConnected()){
            object.state = false;
            this._checkHueLightsIsStreaming(bridgeid);
            return;
        }

        if (parsedBridgePath[1] !== "groups") {
            object.state = false;
            return;
        }

        switch (this._isStreaming[bridgeid]["state"]) {
            case StreamState.STOPPED:
                if (object.state) {
                    /* start streaming */

                    if (!this._checkClientKey(bridgeid)) {
                        object.state = false;
                        break;
                    }

                    if (this._checkAnyEntertainmentActive(bridgeid)) {
                        object.state = false;
                        break;
                    }

                    this._isStreaming[bridgeid]["groupid"] = parsedBridgePath[2];

                    this._isStreaming[bridgeid]["state"] = StreamState.STARTING;

                    /* ask to start a new stream with new service */
                    this.hue.instances[bridgeid].enableStream(
                        parsedBridgePath[2],
                    );
                } else {
                    /* other aplication is streaming - disable it */
                    this.hue.instances[bridgeid].disableStream(
                        parsedBridgePath[2],
                    );
                }

                break;

            case StreamState.STARTING:
            case StreamState.STARTED:
                this._isStreaming[bridgeid]["state"] = StreamState.FAILED;
                this._checkHueLightsIsStreaming(bridgeid);

                object.state = false;
                break;

            case StreamState.STOPPING:
                if (!object.state) {
                    this._isStreaming[bridgeid]["state"] = StreamState.FAILED;
                    this._checkHueLightsIsStreaming(bridgeid);
                    break;
                }

                object.state = false;
                break;

            case StreamState.RUNNING:
                if (this._isStreaming[bridgeid]["groupid"] !== parsedBridgePath[2]) {
                    object.state = false;

                    Utils.logDebug(`Entertainment group ${this._isStreaming[bridgeid]["groupid"]} is already streaming.`);
                    break;
                }

                if (!object.state) {
                    /* stop streaming */

                    this._isStreaming[bridgeid]["state"] = StreamState.STOPPING;

                    this.hue.instances[bridgeid].disableStream(
                        parsedBridgePath[2],
                    );
                }

                break;

            default:
                break;
        }

        return;
    }

    /**
     * Handles events generated by menu items.
     * 
     * @method _menuEventHandler
     * @private
     * @param {Object} dictionary with instruction what to do
     */
    _menuEventHandler(data) {

        let bridgeid = data["bridgeid"];
        let type = data["type"];
        let object = data["object"];
        let bridgePath = data["bridgePath"];
        let parsedBridgePath = [];
        let value;
        let colorTemperature;
        let cmd = {};

        if (this.bridesData[bridgeid].length === 0) {
            Utils.logDebug(`Bridge ${bridgeid} has no data.`);
            return;
        }

        if (!this.hue.instances[bridgeid].isConnected()) {
            Utils.logDebug(`Bridge ${bridgeid} not connected.`);
            return;
        }

        Utils.logDebug(`Menu event handler type: ${type}, ${bridgeid}, ${bridgePath}`);

        parsedBridgePath = bridgePath.split("::");

        switch(type) {

            case "switch":
                parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                value = object.state;

                if (parsedBridgePath[1] == "groups") {
                    this.hue.instances[bridgeid].actionGroup(
                        parsedBridgePath[2],
                        {"on": value}
                    );
                }

                if (parsedBridgePath[1] == "lights") {
                    this.hue.instances[bridgeid].setLights(
                        parsedBridgePath[2],
                        {"on": value}
                    );
                }

                if (parsedBridgePath[1] == "sensors") {
                    this.hue.instances[bridgeid].setSensor(
                        parsedBridgePath[2],
                        {"on": value}
                    );
                }

                break;

            case "mainSwitchEntertainment":
                if (!data["object"].state) {

                    data["object"].visible = false;

                    if (!this.hue.instances[bridgeid].isConnected()) {
                        break;
                    }

                    /* disable any active stream */
                    for (let groupid in this.bridesData[bridgeid]["groups"]) {
                        if (this.bridesData[bridgeid]["groups"][groupid]["type"] === "Entertainment" &&
                            this.bridesData[bridgeid]["groups"][groupid]["stream"]["active"]) {

                            this.hue.instances[bridgeid].disableStream(
                                groupid,
                            );
                        }
                    }
                }

                break;

            case "switchEntertainment":

                if (data["object"].state &&
                    this._isStreaming[bridgeid]["entertainmentMode"] === Utils.entertainmentMode.SELECTION &&
                    this._isStreaming[bridgeid]["state"] === StreamState.STOPPED
                    ) {

                    this._entertainmentSelectArea(
                        bridgeid,
                        this._switchEntertainmentDo,
                        data
                    );

                    return;
                }

                this._switchEntertainmentDo(data);
                break;

            case "entertainmentIntensity":

                value = Math.round(object.value * 255);

                /* 40 is the reasonable minimum */
                this._isStreaming[bridgeid]["intensity"] = 255 - value + 40;
                if (this._isStreaming[bridgeid]["entertainment"]) {
                    this._isStreaming[bridgeid]["entertainment"].setIntensity(
                        this._isStreaming[bridgeid]["intensity"]
                    );
                }
                break;

            case "entertainmentBrightness":

                value = Math.round(object.value * 255);

                this._isStreaming[bridgeid]["brightness"] = value;
                if (this._isStreaming[bridgeid]["entertainment"]) {
                    this._isStreaming[bridgeid]["entertainment"].setBrightness(
                        this._isStreaming[bridgeid]["brightness"]
                    );
                }
                break;

            case "entertainmentMode":

                value = data["service"];

                this._isStreaming[bridgeid]["syncGeometry"] = undefined;

                this._isStreaming[bridgeid]["entertainmentMode"] = value;

                if (value === Utils.entertainmentMode.DISPLAYN) {
                    this._isStreaming[bridgeid]["syncGeometry"] = data["syncGeometry"];
                }

                this.refreshMenu();

                if (this._isStreaming[bridgeid] !== undefined &&
                    this._isStreaming[bridgeid]["state"] === StreamState.RUNNING) {

                    if (value === Utils.entertainmentMode.SELECTION) {
                        this._entertainmentSelectArea(
                            bridgeid,
                            this._startEntertainmentStream,
                            bridgeid,
                            this._isStreaming[bridgeid]["groupid"]
                        );
                        return;
                    }

                    this._startEntertainmentStream(
                        bridgeid,
                        this._isStreaming[bridgeid]["groupid"]
                    );
                }
                break;

            case "brightness-colorpicker":

                data["object"] = this.colorPicker[bridgeid].brightness;
                object = data["object"];
                /* no break here "brightness" continues */

            case "brightness":

                parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                value = Math.round(object.value * 255);
                if (value == 0) {
                    cmd = {"on": false, "bri": value};
                } else {
                    cmd = {"on": true, "bri": value};
                }


                if (parsedBridgePath[1] === "groups") {
                    let groupBrightness = this._getGroupBrightness(bridgeid, parsedBridgePath[2]);
                    if (groupBrightness > 0) {
                        /* some lights are already on, do not turn on the rest */
                        delete(cmd["on"]);
                    }
                }

                if (parsedBridgePath[1] === "groups") {

                    this.hue.instances[bridgeid].actionGroup(
                        parseInt(parsedBridgePath[2]),
                        cmd
                    );
                }

                if (parsedBridgePath[1] === "lights") {

                    this.hue.instances[bridgeid].setLights(
                        parsedBridgePath[2],
                        cmd
                    );
                }

                break;

            case "color-picker":

                parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                /* close the main manu */
                this.menu.close(false);

                if (this.colorPicker[bridgeid] !== undefined) {
                    this.colorPicker[bridgeid].destroy();
                    delete(this.colorPicker[bridgeid]);
                }

                if (this._checkEntertainmentStream(bridgeid, parsedBridgePath)) {
                    break;
                }

                let [hasXY, hasCT] = this._checkColorAttributeLightOrGroup(
                    bridgeid,
                    parsedBridgePath[1],
                    parsedBridgePath[2],
                );

                this.colorPicker[bridgeid] = new ColorPicker.ColorPicker({
                    useColorWheel: hasXY,
                    useWhiteBox: hasCT
                });
                this.colorPicker[bridgeid].show();
                this.colorPicker[bridgeid].connect("finish", () => {
                    delete(this.colorPicker[bridgeid]);
                });

                let dataColor = Object.assign({}, data);
                dataColor["type"] = "set-color";
                this.colorPicker[bridgeid].connect(
                    "color-picked",
                    this._menuEventHandler.bind(this, dataColor)
                );

                let dataBrightness = Object.assign({}, data);
                dataBrightness["type"] = "brightness-colorpicker";
                this.colorPicker[bridgeid].connect(
                    "brightness-picked",
                    this._menuEventHandler.bind(this, dataBrightness)
                );
                this.colorPicker[bridgeid].newPosition();

                break;

            case "set-color":

                parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                value = Utils.colorToHueXY(
                    this.colorPicker[bridgeid].r,
                    this.colorPicker[bridgeid].g,
                    this.colorPicker[bridgeid].b
                );
                colorTemperature = this.colorPicker[bridgeid].colorTemperature;

                cmd = {"on": true};

                if (colorTemperature > 0) {
                    cmd["ct"] = Utils.kelvinToCt(colorTemperature);
                } else {
                    cmd["xy"] = value;
                }

                if (parsedBridgePath[1] === "groups") {
                    let groupBrightness = this._getGroupBrightness(bridgeid, parsedBridgePath[2]);
                    if (groupBrightness > 0) {
                        /* some lights are already on, do not turn on the rest */
                        delete(cmd["on"]);
                    }
                }

                if (parsedBridgePath[1] == "groups") {

                    this.hue.instances[bridgeid].actionGroup(
                        parsedBridgePath[2],
                        cmd
                    );
                }

                if (parsedBridgePath[1] == "lights") {

                    this.hue.instances[bridgeid].setLights(
                        parsedBridgePath[2],
                        cmd
                    );
                }

                break;

            case "scene":

                cmd = {
                    "scene": object,
                    "transitiontime": 4
                };

                this.hue.instances[bridgeid].actionGroup(
                    data["groupid"],
                    cmd
                );

                break;

            default:
                Utils.logDebug(`Menu event handler - uknown type ${type}`)
        }

        /* don't call this.refreshMenu() now... it will by called async */
    }

    /**
     * Tries to discovery secondary sensor with temperature.
     * 
     * @method _tryaddSensorsTemperature
     * @private
     * @param {String} bridgeid
     * @param {String} uniqueid of primary sensor
     * @param {Object} data to search
     * @return {Object} lable for displaying temperature
     */
    _tryaddSensorsTemperature(bridgeid, uniqueid, data) {

        let temperatureLabel = null;
        for (let i in data["sensors"]) {

            if (data["sensors"][i]["uniqueid"] === undefined) {
                continue;
            }

            if (data["sensors"][i]["uniqueid"].split("-")[0] !== uniqueid) {
                continue;
            }

            if (data["sensors"][i]["state"] === undefined ||
                data["sensors"][i]["state"]["temperature"] === undefined) {
                continue;
            }

            temperatureLabel = new St.Label();
            temperatureLabel.text = "°C";

            temperatureLabel.set_x_align(Clutter.ActorAlign.END);
            temperatureLabel.set_x_expand(false);

            let bridgePath = `${this._rndID()}::sensors::${i}::state::temperature`;

            this.refreshMenuObjects[bridgePath] = {
                "bridgeid": bridgeid,
                "object": temperatureLabel,
                "type": "temperature",
                "tmpTier": 0
            }

            break;
        }

        return temperatureLabel;
    }

    /**
     * Tries to discovery secondary sensor with light level.
     * 
     * @method _tryaddSensorsLightLevel
     * @private
     * @param {String} bridgeid
     * @param {String} uniqueid of primary sensor
     * @param {Object} data to search
     * @return {Object} lable for displaying light level
     */
    _tryaddSensorsLightLevel(bridgeid, uniqueid, data) {

        let lightLabel = null;
        for (let i in data["sensors"]) {

            if (data["sensors"][i]["uniqueid"] === undefined) {
                continue;
            }

            if (data["sensors"][i]["uniqueid"].split("-")[0] !== uniqueid) {
                continue;
            }

            if (data["sensors"][i]["state"] === undefined ||
                data["sensors"][i]["state"]["lightlevel"] === undefined) {
                continue;
            }

            lightLabel = new St.Label();
            lightLabel.text = "lux";

            lightLabel.set_x_align(Clutter.ActorAlign.END);
            lightLabel.set_x_expand(false);

            let bridgePath = `${this._rndID()}::sensors::${i}::state::lightlevel`;

            this.refreshMenuObjects[bridgePath] = {
                "bridgeid": bridgeid,
                "object": lightLabel,
                "type": "light-level",
                "tmpTier": 0
            }

            break;
        }

        return lightLabel;
    }

    /**
     * Tries to discovery battery level of sensor.
     * 
     * @method _tryaddSensorsBattery
     * @private
     * @param {String} bridgeid
     * @param {String} sensorid of the sensor
     * @param {Object} data to search
     * @return {Object} lable for displaying battery level
     */
    _tryaddSensorsBattery(bridgeid, sensorid, data) {

        if (data["sensors"][sensorid]["config"]["battery"] === undefined) {
            return null;
        }

        let batteryLabel = new St.Label();
        batteryLabel.text = "%";

        batteryLabel.set_x_align(Clutter.ActorAlign.END);
        batteryLabel.set_x_expand(false);

        let bridgePath = `${this._rndID()}::sensors::${sensorid}::config::battery`;

        this.refreshMenuObjects[bridgePath] = {
            "bridgeid": bridgeid,
            "object": batteryLabel,
            "type": "battery",
            "tmpTier": 0
        }

        return batteryLabel;
    }

    /**
     * Tries to discovery sensor switch.
     * 
     * @method _tryaddSensorsSwitch
     * @private
     * @param {String} bridgeid
     * @param {String} sensorid of the sensor
     * @param {Object} data to search
     * @return {Object} switch for switching the sensor
     */
    _tryaddSensorsSwitch(bridgeid, sensorid, data) {

        let switchBox = null;
        let switchButton = null;

        if (data["sensors"][sensorid]["config"]["on"] === undefined) {
            return null;
        }

        let bridgePath = `${this._rndID()}::sensors::${sensorid}::config::on`;

        switchBox = new PopupMenu.Switch(false);
        switchButton = new St.Button({reactive: true, can_focus: true});
        switchButton.set_x_align(Clutter.ActorAlign.END);
        switchButton.set_x_expand(false);
        switchButton.child = switchBox;
        switchButton.connect(
            "button-press-event",
            () =>{
                switchBox.toggle();
            }
        );
        switchButton.connect(
            "button-press-event",
            this._menuEventHandler.bind(
                this,
                {
                    "bridgePath": bridgePath,
                    "bridgeid": bridgeid,
                    "object":switchBox,
                    "type": "switch"
                }
            )
        );

        this.refreshMenuObjects[bridgePath] = {
            "bridgeid": bridgeid,
            "object":switchBox,
            "type": "switch",
            "tmpTier": 0
        }

        return switchButton;
    }

    /**
     * Creates item (like switch or light sensor)
     * for submenu of sensors.
     * 
     * @method _createItemSensor
     * @private
     * @param {String} bridgeid
     * @param {String} sensorid of the sensor
     * @param {Object} data to search
     * @return {Object} menuitem of the sensor
     */
    _createItemSensor(bridgeid, sensorid, data) {

        let sensorIcon = null;
        let uniqueid = data["sensors"][sensorid]["uniqueid"].split("-")[0];

        let item = new PopupMenu.PopupMenuItem(
            data["sensors"][sensorid]["name"]
        )

        item.label.set_x_expand(true);

        sensorIcon = this._tryGetSensorIcon(data["sensors"][sensorid]);

        if (sensorIcon !== null) {
            item.insert_child_at_index(sensorIcon, 1);
        }

        let temperature = this._tryaddSensorsTemperature(bridgeid, uniqueid, data);
        if (temperature !== null) {
            item.add(temperature);
        }


        let lightlevel = this._tryaddSensorsLightLevel(bridgeid, uniqueid, data);
        if (lightlevel !== null) {
            item.add(lightlevel);
        }

        let battery = this._tryaddSensorsBattery(bridgeid, sensorid, data);
        if (battery !== null) {
            item.add(battery);

            let icon = this._getIconByPath(Me.dir.get_path() + '/media/battery.svg');

            if (icon !== null) {
                item.add(icon);
            }
        }

        let sensorSwitch = this._tryaddSensorsSwitch(bridgeid, sensorid, data);
        if (sensorSwitch !== null) {
            item.add(sensorSwitch);
        }

        return item;
    }

    /**
     * Creates menu items for switching bridges.
     * 
     * @method _createOtherBridgesItems
     * @private
     * @param {String} bridgeid
     * @return {Object} array of menu items
     */
    _createOtherBridgesItems(bridgeid) {
        let items = [];
        let switchesCounter = 0;

        /**
         * if more then one bridge is displayed in menu
         * then all bridges will be displayed,
         * no need for switching item
         */
        if (this._bridgesInMenu.length > 1) {
            return items;
        }

        for (let bridgeid in this.hue.instances) {

            let found = false;
            for (let i of this._bridgesInMenu) {
                if (bridgeid === i) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                if (this.bridesData[bridgeid] === undefined ||
                    this.bridesData[bridgeid]["config"] === undefined) {
                    continue;
                }

                let switchItem = new PopupMenu.PopupMenuItem(
                    _("Switch to") + ` ${this.bridesData[bridgeid]["config"]["name"]}`
                )

                if (this._iconPack !== PhueIconPack.NONE) {
                    let iconPath;

                    switch (this.bridesData[bridgeid]["config"]["modelid"]) {

                        case "BSB001":
                            iconPath = Me.dir.get_path() + `/media/HueIcons/devicesBridgesV1.svg`;
                            break;

                        case "BSB002":
                            iconPath = Me.dir.get_path() + `/media/HueIcons/devicesBridgesV2.svg`;
                            break;

                        default:
                            iconPath = Me.dir.get_path() + `/media/HueIcons/devicesBridgesV2.svg`;
                     }

                    let icon = this._getIconByPath(iconPath);

                    if (icon !== null) {
                        switchItem.insert_child_at_index(icon, 1);
                    }
                }

                switchItem.connect(
                    "button-press-event",
                    () => {
                        this._bridgesInMenu = [bridgeid];
                        this.rebuildMenuStart();
                    }
                );

                items.push(switchItem);

                switchesCounter++;
            }
        }

        if (switchesCounter > 0) {
            items.push(new PopupMenu.PopupSeparatorMenuItem());
        }

        return items;
    }

    /**
     * Creates bridge submenu with sensors
     * and settings.
     * 
     * @method _createSubMenuBridge
     * @private
     * @param {String} bridgeid
     * @param {Object} data to search
     * @return {Object} submenuitem of the bridge
     */
     _createSubMenuBridge(bridgeid, data) {

        let item;
        let sensorCount = 0;
        let iconPath;
        let icon;

        item = new PopupMenu.PopupSubMenuMenuItem(
            data["config"]["name"]
        );

        if (this._compactMenu) {
            item.menu.connect(
                'open-state-changed',
                (menu, isOpen) => {
                    this._handleLastOpenedMenu(menu, isOpen);
                }
            );
        }

        if (this._iconPack !== PhueIconPack.NONE) {
            switch (data["config"]["modelid"]) {

                case "BSB001":
                    iconPath = Me.dir.get_path() + `/media/HueIcons/devicesBridgesV1.svg`;

                    Utils.logDebug("Bridge is version 1");
                    break;

                case "BSB002":
                    iconPath = Me.dir.get_path() + `/media/HueIcons/devicesBridgesV2.svg`;

                    Utils.logDebug("Bridge is version 2");
                    break;

                default:
                    iconPath = Me.dir.get_path() + `/media/HueIcons/devicesBridgesV2.svg`;

                    Utils.logDebug("Bridge version unknown");
            }

            icon = this._getIconByPath(iconPath);

            if (icon !== null) {
                item.insert_child_at_index(icon, 1);
            }
        }

        for (let i in data["sensors"]) {

            if (data["sensors"][i]["uniqueid"] === undefined) {
                continue;
            }

            if (data["sensors"][i]["capabilities"] === undefined) {
                continue;
            }

            if (data["sensors"][i]["capabilities"]["primary"] === undefined) {
                continue;
            }

            if (data["sensors"][i]["capabilities"]["primary"]) {
                item.menu.addMenuItem(
                    this._createItemSensor(bridgeid, i, data)
                );

                sensorCount++;
            }
        }

        if (sensorCount > 0) {
            /* we have some sensors, create a separator item */
            item.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        for (let otherBridgesItem of this._createOtherBridgesItems(bridgeid)) {
            item.menu.addMenuItem(otherBridgesItem);
        }

        for (let settingsItem of this._createSettingItems(false)) {
            item.menu.addMenuItem(settingsItem);
        }

        return item;
    }

    /**
     * Creates slider for controlling the brightness
     * 
     * @method _createBrightnessSlider
     * @private
     * @param {String} bridgeid
     * @param {Number} lightid
     * @param {Number} groupid
     * @return {Object} Brightness slider
     */
    _createBrightnessSlider(bridgeid, lightid, groupid, defaultValue, tmpTier = 0) {

        let bridgePath = "";

        let slider = new Slider.Slider(0);
        slider.set_width(170);
        slider.set_height(25);
        slider.set_x_align(Clutter.ActorAlign.START);
        slider.set_x_expand(false);
        slider.value = defaultValue;

        this._createSliderColor(slider, bridgeid, lightid, groupid, tmpTier);

        if (groupid !== null) {
            bridgePath = `${this._rndID()}::groups::${groupid}::action::bri`;
        } else {
            bridgePath = `${this._rndID()}::lights::${lightid}::state::bri`;
        }

        slider.connect(
            "drag-end",
            this._menuEventHandler.bind(
                this,
                {
                    "bridgePath": bridgePath,
                    "bridgeid": bridgeid,
                    "object":slider,
                    "type": "brightness"
                }
            )
        );

        this.refreshMenuObjects[bridgePath] = {
            "bridgeid": bridgeid,
            "object":slider,
            "type": "brightness",
            "tmpTier": tmpTier
        }

        return slider;
    }

    /**
     * Creates switch button for turning the light on/off
     * 
     * @method _createLightSwitch
     * @private
     * @param {String} bridgeid
     * @param {Number} lightid
     * @param {Number} groupid
     * @return {Object} switch button
     */
    _createLightSwitch(bridgeid, lightid, groupid, defaultValue, tier = 1) {

        let bridgePath = "";

        if (groupid !== null) {
            bridgePath = `${this._rndID()}::groups::${groupid}::state::all_on`;
        } else {
            bridgePath = `${this._rndID()}::lights::${lightid}::state::on`;
        }

        let switchBox = new PopupMenu.Switch(false);
        switchBox.state = defaultValue;

        let switchButton = new St.Button(
            {reactive: true, can_focus: true}
        );

        switchButton.set_x_align(Clutter.ActorAlign.END);
        switchButton.set_x_expand(false);
        switchButton.child = switchBox;
        switchButton.connect(
            "button-press-event",
            () => {
                switchBox.toggle();
            }
        );
        switchButton.connect(
            "button-press-event",
            this._menuEventHandler.bind(
                this,
                {
                    "bridgePath": bridgePath,
                    "bridgeid": bridgeid,
                    "object": switchBox,
                    "type": "switch"
                }
            )
        );

        this.refreshMenuObjects[bridgePath] = {
            "bridgeid": bridgeid,
            "object": switchBox,
            "type": "switch",
            "tmpTier": tier
        }

        this._createSwitchColor(switchBox, bridgeid, lightid, groupid, tier);

        return switchButton;
    }

    /**
     * Gets color for a group or a single light
     * 
     * @method _getLightOrGroupColor
     * @private
     * @param {String} bridgeid
     * @param {Object} array with parsedBridgePath
     * @param {Number} value coresponding to parsedBridgePath
     * @return {Object} RGB
     */
    _getLightOrGroupColor(bridgeid, groupid, lightid) {
        let r = 0;
        let g = 0;
        let b = 0;

        let data = this.bridesData[bridgeid];

        if (groupid === null) {
            if (!data["lights"][lightid]["state"]["on"]) {
                return [r, g, b];
            }

            if (data["lights"][lightid]["state"]["xy"] == undefined &&
                data["lights"][lightid]["state"]["ct"] == undefined) {

                return [r, g, b];
            }

            switch (data["lights"][lightid]["state"]["colormode"]) {

                case "xy":
                    [r, g, b] = Utils.XYBriToColor(
                        data["lights"][lightid]["state"]["xy"][0],
                        data["lights"][lightid]["state"]["xy"][1],
                        255 /* or data["lights"][lightid]["state"]["bri"] */
                    );

                    break;

                case "ct":
                    let kelvin = Utils.ctToKelvin(
                        data["lights"][lightid]["state"]["ct"]
                    );
                    [r, g, b] = Utils.kelvinToRGB(kelvin);
                    break;

                default:
                    return [r, g, b];
            }
        }

        if (groupid !== null) {
            [r, g, b] = this._getGroupColor(bridgeid, groupid);
        }

        return [r, g, b];
    }

    /**
     * Colorizes slideres based on light color.
     * 
     * @method _createLightSwitch
     * @private
     * @param {Object} slider to colorize
     * @param {String} bridgeid
     * @param {Number} lightid
     * @param {Number} groupid
     * @param {Boolean} tmp: true for tmp refresh
     */
    _createSliderColor(slider, bridgeid, lightid, groupid, tmpTier = 0) {

        let bridgePath = "";

        if (groupid === null &&
            this.bridesData[bridgeid]["lights"][lightid]["state"]["xy"] === undefined &&
            this.bridesData[bridgeid]["lights"][lightid]["state"]["ct"] === undefined) {
            return;
        }

        if (groupid !== null &&
            this.bridesData[bridgeid]["groups"][groupid]["action"]["xy"] === undefined &&
            this.bridesData[bridgeid]["groups"][groupid]["action"]["ct"] === undefined) {
            return;
        }

        if (groupid !== null) {
            bridgePath = `${this._rndID()}::groups::${groupid}::action`;
        } else {
            bridgePath = `${this._rndID()}::lights::${lightid}::state`;
        }

        this.refreshMenuObjects[bridgePath] = {
            "bridgeid": bridgeid,
            "object": slider,
            "type": "slider-color",
            "tmpTier": tmpTier
        }

        if (groupid !== null && this._getGroupBrightness(bridgeid, groupid) !== 0) {
            this._setSliderColor(
                slider,
                this._getLightOrGroupColor(bridgeid, groupid, null)
            );
        }

        if (groupid === null && this.bridesData[bridgeid]["lights"][lightid]["state"]["on"]) {
            this._setSliderColor(
                slider,
                this._getLightOrGroupColor(bridgeid, null, lightid)
            );
        }
    }

    /**
     * Colorizes switches based on light color.
     * 
     * @method _createLightSwitch
     * @private
     * @param {Object} switchItem to colorize
     * @param {String} bridgeid
     * @param {Number} lightid
     * @param {Number} groupid
     * @param {Boolean} tmp: true for tmp refresh
     */
    _createSwitchColor(switchItem, bridgeid, lightid, groupid, tmpTier = 0) {

        let bridgePath = "";

        if (groupid === null &&
            this.bridesData[bridgeid]["lights"][lightid]["state"]["xy"] === undefined &&
            this.bridesData[bridgeid]["lights"][lightid]["state"]["ct"] === undefined) {
            return;
        }

        if (groupid !== null &&
            this.bridesData[bridgeid]["groups"][groupid]["action"]["xy"] === undefined &&
            this.bridesData[bridgeid]["groups"][groupid]["action"]["ct"] === undefined) {
            return;
        }

        if (groupid !== null) {
            bridgePath = `${this._rndID()}::groups::${groupid}::action`;
        } else {
            bridgePath = `${this._rndID()}::lights::${lightid}::state`;
        }

        this.refreshMenuObjects[bridgePath] = {
            "bridgeid": bridgeid,
            "object": switchItem,
            "type": "switch-color",
            "tmpTier": tmpTier
        }

        if (groupid !== null && this._getGroupBrightness(bridgeid, groupid) !== 0) {
            this._setSwitchColor(
                switchItem,
                this._getLightOrGroupColor(bridgeid, groupid, null)
            );
        }

        if (groupid === null && this.bridesData[bridgeid]["lights"][lightid]["state"]["on"]) {
            this._setSwitchColor(
                switchItem,
                this._getLightOrGroupColor(bridgeid, null, lightid)
            );
        }
    }

    /**
     * Creates last item in menu hierarchy with all the controls.
     * 
     * @method _createItemLight
     * @private
     * @param {String} bridgeid which bridge we use here
     * @param {Object} dictionary data for the bridgeid
     * @param {Number} lightid of created light (not used if groupid provided)
     * @param {Number} groupid creates menu item for all lights (not mandatory)
     * @return {Object} menuitem with light controls
     */
    _createItemLight(bridgeid, data, lightid, groupid, useCompact = false) {

        let light;
        let bridgePath = "";
        let lightIcon = null;
        let defaultValue;

        /**
         * Decide if this is item for one light or a group.
         */
        if (groupid !== null) {
            light = new PopupMenu.PopupMenuItem(
                _("All Lights")
            );
        } else {
            light = new PopupMenu.PopupMenuItem(
                data["lights"][lightid]["name"]
            );
        }

        let label = light.label
        light.remove_child(light.label);
        let itemBox = new St.BoxLayout();
        itemBox.vertical = true;
        itemBox.add(label);
        light.insert_child_at_index(itemBox, 1);

        light.set_x_align(Clutter.ActorAlign.FILL);
        light.label.set_x_expand(true);

        if (groupid === null) {
            lightIcon = this._tryGetLightIcon(data["lights"][lightid]);
        } else {
            if (this._iconPack !== PhueIconPack.NONE) {
                    lightIcon = this._getIconByPath(
                    Me.dir.get_path() + `/media/HueIcons/bulbGroup.svg`
                );
            }
        }

        if (lightIcon !== null) {
            light.insert_child_at_index(lightIcon, 1);
        }

        /**
         * Open color picker on mouse click (standard menu)
         */
        if (groupid !== null) {
            bridgePath = `${this._rndID()}::groups::${groupid}::action::hue`;
        } else {
            bridgePath = `${this._rndID()}::lights::${lightid}::state::hue`;
        }

        if (!useCompact) {
            light.connect(
                'button-press-event',
                this._menuEventHandler.bind(
                    this,
                    {
                        "bridgePath": bridgePath,
                        "bridgeid": bridgeid,
                        "object": light,
                        "type": "color-picker"
                    }
                )
            );
        }

        if (useCompact) {
            light.originalActivate = light.activate;
            light.activate = (event) => {
                /**
                 * activate function is used here becase
                 * the menu.open(true) does not work with
                 * 'button-press-event' signal correctly
                 */

                 if (!this.hue.instances[bridgeid].isConnected()) {
                    return light.originalActivate(event);
                 }

                this._menuSelected[bridgeid] = {
                    "groupid": this._menuSelected[bridgeid]["groupid"] !== undefined ? this._menuSelected[bridgeid]["groupid"] : groupid,
                    "lightid": lightid}
                ;
                this.writeMenuSelectedSettings();

                this._selectCompactMenuLights(bridgeid, groupid, lightid);

                this._setCompactMenuControl(bridgeid, groupid, lightid);

                /**
                 * ask for async all data,
                 * which will invoke refreshMenu
                 */
                this.hue.instances[bridgeid].getAll();

                if (this._compactMenuBridges[bridgeid]["control"]["object"].visible) {
                    this._compactMenuBridges[bridgeid]["control"]["object"].menu.open(true);
                }

                if (this._compactMenuBridges[bridgeid]["lights"]["hidden-item"] !== undefined) {
                    this._compactMenuBridges[bridgeid]["lights"]["hidden-item"].visible = true;
                }

                light.visible = false;
                this._compactMenuBridges[bridgeid]["lights"]["hidden-item"] = light;

                return light.originalActivate(event);
            }

            let hiddenLight = false;

            if ((this._menuSelected[bridgeid] !== undefined &&
                this._menuSelected[bridgeid]["lightid"] !== undefined &&
                this._menuSelected[bridgeid]["lightid"] === lightid) ||
                (this._menuSelected[bridgeid] !== undefined &&
                this._menuSelected[bridgeid]["lightid"] === undefined && groupid !== null)) {

                hiddenLight = true;
            }

            if (hiddenLight) {
                light.visible = false;
                this._compactMenuBridges[bridgeid]["lights"]["hidden-item"] = light;
                this._compactMenuBridges[bridgeid]["lights"]["default-item"] = light;
            }
        }

        /**
         * If brightness is possible, add a slider
         */
        if (groupid === null &&
            data["lights"][lightid]["state"]["bri"] !== undefined) {

            defaultValue = 0;
            if (data["lights"][lightid]["state"]["on"]) {
                defaultValue = data["lights"][lightid]["state"]["bri"] / 255;
            }

            itemBox.add(this._createBrightnessSlider(bridgeid, lightid, groupid, defaultValue, true));
        }

        /**
         * Add switch for turning the light on/off
         */
        defaultValue = false;
        if (groupid !== null) {
            defaultValue = data["groups"][groupid]["state"]["all_on"];
        } else {
            defaultValue = data["lights"][lightid]["state"]["on"];
        }

        light.add(this._createLightSwitch(bridgeid, lightid, groupid, defaultValue));

        return light;
    }

    /**
     * Creates array of menu items with scenes
     * 
     * @method _createScenes
     * @private
     * @param {String} bridgeid which bridge we use here
     * @param {Object} dictionary data for the bridgeid
     * @param {Number} groupid of scenes
     * @return {Object} menuitem with scenes
     */
    _createScenes(bridgeid, data, groupid) {
        let scenes = [];
        let scene;

        for (let sceneid in data["scenes"]) {
            if (data["scenes"][sceneid]["group"] != undefined &&
                data["scenes"][sceneid]["group"] === groupid.toString()) {

                scene = new PopupMenu.PopupMenuItem(
                    data["scenes"][sceneid]["name"]
                );

                scene.x_align = Clutter.ActorAlign.FILL;
                scene.x_expand = true;
                scene.label.x_align = Clutter.ActorAlign.CENTER;
                scene.label.set_x_expand(true);

                scene.connect(
                    "button-press-event",
                    this._menuEventHandler.bind(
                        this,
                        {
                            "bridgePath": "",
                            "bridgeid": bridgeid,
                            "groupid": groupid,
                            "object":sceneid,
                            "type": "scene"
                        }
                    )
                );
                scenes.push(scene);
            }
        }

        return scenes;
    }

    /**
     * Creates array of menu item with light controls.
     * 
     * @method _createMenuLights
     * @private
     * @param {String} bridgeid which bridge we use here
     * @param {Object} dictionary data for the bridgeid
     * @param {Number} lightid of created light (not used if groupid provided)
     * @param {Number} groupid creates menu item for all lights (not mandatory)
     * @param {String} compact specifies scenes or lights (used by compact menu)
     * @return {Object} array of menuitem with light controls
     */
    _createMenuLights(bridgeid, data, lights, groupid, compact = null) {

        let lightsItems = [];
        let light;

        if (lights.length === 0) {
            return [];
        }

        if (compact !== "scenes") {

            light = this._createItemLight(
                bridgeid,
                data,
                lights,
                groupid,
                compact === "lights" ? true : false
            );
            lightsItems.push(light);

            lightsItems = lightsItems.concat(
                [new PopupMenu.PopupSeparatorMenuItem()]
            );

            for (let lightid in lights) {
                light = this._createItemLight(
                    bridgeid,
                    data,
                    parseInt(lights[lightid]),
                    null,
                    compact === "lights" ? true : false
                );
                lightsItems.push(light);
            }
        }

        if (this._showScenes && compact !== "lights") {
            lightsItems = lightsItems.concat(
                this._createScenes(bridgeid, data, groupid)
            );
        }
        return lightsItems;
    }

    /**
     * Creates switch for group menu item
     * 
     * @method _createGroupSwitch
     * @private
     * @param {String} bridgeid
     * @param {String} groupid
     * @param {Boolean} tmp used by compact menu for removing from refreshing objects
     * @return {Object} switch button
     */
    _createGroupSwitch(bridgeid, groupid, tmpTier = 0) {
        let switchBox;
        let switchButton;

        let bridgePath = `${this._rndID()}::groups::${groupid}::state::any_on`;

        switchBox = new PopupMenu.Switch(false);
        switchButton = new St.Button({reactive: true, can_focus: true});
        switchButton.set_x_align(Clutter.ActorAlign.END);
        switchButton.set_x_expand(false);
        switchButton.child = switchBox;
        switchButton.connect(
            "button-press-event",
            () => {
                switchBox.toggle();
            }
        );
        switchButton.connect(
            "button-press-event",
            this._menuEventHandler.bind(
                this,
                {
                    "bridgePath": bridgePath,
                    "bridgeid": bridgeid,
                    "object":switchBox,
                    "type": "switch"
                }
            )
        );

        this.refreshMenuObjects[bridgePath] = {
            "bridgeid": bridgeid,
            "object":switchBox,
            "type": "switch",
            "tmpTier": tmpTier
        }

        this._createSwitchColor(switchBox, bridgeid, null, groupid, tmpTier);

        return switchButton;
    }


    /**
     * Get gnome icon by name.
     * 
     * @method _getGnomeIcon
     * @private
     * @param {String} path to icon
     * @return {Object} icon or null if not found
     */
    _getGnomeIcon(iconName) {

        let icon = null;

        try {

            icon = new St.Icon({
                gicon : Gio.ThemedIcon.new(iconName),
                style_class : 'system-status-icon',
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER
            });

            icon.set_size(IconSize * 0.8, IconSize * 0.8);

            let iconEffect = this._getIconColorEffect(this._iconPack);
            icon.add_effect(iconEffect);

            iconEffect = this._getIconBriConEffect(this._iconPack);
            icon.add_effect(iconEffect);

        } catch(err) {
            return null;
        }

        return icon;
    }

    /**
     * Read icon from FS and return icon.
     * 
     * @method _getIconByPath
     * @private
     * @param {String} path to icon
     * @return {Object} icon or null if not found
     */
    _getIconByPath(iconPath) {

        let icon = null;

        try {

            icon = new St.Icon({
                gicon : Gio.icon_new_for_string(iconPath),
                style_class : 'system-status-icon',
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER
            });

            icon.set_size(IconSize, IconSize);

            let iconEffect = this._getIconBriConEffect(this._iconPack);
            icon.add_effect(iconEffect);

        } catch(err) {
            return null;
        }

        return icon;
    }

    /**
     * Gets the name for a group from data.
     * 
     * @method _getGroupName
     * @private
     * @param {String} bridgeid
     * @param {String} groupid
     * @return {Object} icon or null
     */
    _getGroupName(bridgeid, groupid) {

        let groupName = _("no data");

        if (groupid === "0") {
            groupName = _("All Rooms & Zones");
        } else {
            groupName = this.bridesData[bridgeid]["groups"][groupid]["name"];
        }

        return groupName;
    }

    /**
     * Tries to determine icon for group from class
     * 
     * @method _tryGetGroupIcon
     * @private
     * @param {String} bridgeid
     * @param {String} groupid
     * @return {Object} icon or null
     */
    _tryGetGroupIcon(bridgeid, groupid) {

        let iconPath = "";

        if (this._iconPack === PhueIconPack.NONE) {
            return null;
        }

        if (groupid === "0") {
            iconPath = Me.dir.get_path() + `/media/HueIcons/roomsOther.svg`;
        } else {
            let groupData = this.bridesData[bridgeid]["groups"][groupid];

            if (groupData["class"] === undefined) {
                return null;
            }

            if (Utils.getHueIconFile[groupData["class"]] === undefined) {
                return null;
            }

            iconPath = Me.dir.get_path() + `/media/HueIcons/${Utils.getHueIconFile[groupData["class"]]}.svg`
        }

        return this._getIconByPath(iconPath);
    }

    /**
     * Tries to determine icon for light
     * 
     * @method _tryGetLightIcon
     * @private
     * @param {Object} group data
     * @return {Object} icon or null
     */
    _tryGetLightIcon(lightData) {

        let iconPath = "";

        if (this._iconPack === PhueIconPack.NONE) {
            return null;
        }


        if (lightData["modelid"] === undefined) {
            return null;
        }

        if (Utils.getHueIconFile[lightData["modelid"]] === undefined) {
            iconPath = Me.dir.get_path() + `/media/HueIcons/bulbsClassic.svg`
        } else {
            iconPath = Me.dir.get_path() + `/media/HueIcons/${Utils.getHueIconFile[lightData["modelid"]]}.svg`
        }

        return this._getIconByPath(iconPath);
    }

    /**
     * Tries to determine icon for accessory
     * 
     * @method _tryGetAccessoryIcon
     * @private
     * @param {Object} group data
     * @return {Object} icon or null
     */
    _tryGetSensorIcon(sensorData) {

        let iconPath = "";

        if (this._iconPack === PhueIconPack.NONE) {
            return null;
        }


        if (sensorData["modelid"] === undefined) {
            return null;
        }

        if (Utils.getHueIconFile[sensorData["modelid"]] === undefined) {
            return null;
        }

        iconPath = Me.dir.get_path() + `/media/HueIcons/${Utils.getHueIconFile[sensorData["modelid"]]}.svg`

        return this._getIconByPath(iconPath);
    }

    /**
     * Using compact menu, this function will set
     * the control menu to desired group or light.
     * 
     * @method _setCompactMenuControl
     * @private
     * @param {String} bridgeid
     * @param {Number} groupid or null
     * @param {Number} lightid
     */
     _setCompactMenuControl(bridgeid, groupid, lightid) {

        let bridgePath;

        this._compactMenuBridges[bridgeid]["control"]["object"].visible = false;

        this._compactMenuBridges[bridgeid]["control"]["object"].menu.removeAll();

        this._compactMenuBridges[bridgeid]["control"]["object"].label.text = _("Color & Temperature");

        let controlItem = new PopupMenu.PopupMenuItem(
            _("None")
        )
        controlItem.x_align = Clutter.ActorAlign.CENTER;

        controlItem.remove_child(controlItem.label);

        let [hasXY, hasCT] = this._checkColorAttributeLightOrGroup(
            bridgeid,
            groupid === null ? "lights": "groups",
            groupid === null ? lightid: groupid
        );

        if (hasXY || hasCT) {
            this._compactMenuBridges[bridgeid]["control"]["object"].visible = true;
        }

        let colorPickerBox = new ColorPicker.ColorPickerBox({
            useColorWheel: hasXY,
            useWhiteBox: hasCT
        });
        controlItem.add(colorPickerBox.createColorBox());

        if (groupid !== null) {
            bridgePath = `${this._rndID()}::groups::${groupid}::action::hue`;
        } else {
            bridgePath = `${this._rndID()}::lights::${lightid}::state::hue`;
        }

        if (this.colorPicker[bridgeid] !== undefined) {
            delete(this.colorPicker[bridgeid]);
        }
        this.colorPicker[bridgeid] = colorPickerBox;

        let dataColor = {
            "bridgeid": bridgeid,
            "bridgePath": bridgePath,
            "type": "set-color"
        }

        colorPickerBox.connect(
            "color-picked",
                this._menuEventHandler.bind(this, dataColor)
        );

        let dataBrightness = {
            "bridgeid": bridgeid,
            "bridgePath": bridgePath,
            "type": "brightness-colorpicker"
        }

        colorPickerBox.connect(
            "brightness-picked",
            this._menuEventHandler.bind(this, dataBrightness)
        );

        this._compactMenuBridges[bridgeid]["control"]["object"].menu.addMenuItem(controlItem);
    }

    /**
     * Clear tmp items in refresh list.
     * So destroyed items will not be attempted
     * to be refreshed.
     * 
     * @method _compactMenuClearTmpObjects
     * @private
     * @param {String} bridgeid
     */
    _compactMenuClearTmpObjects(bridgeid, tier) {
        /* remove previously created object from refreshing */

        for (let i in this.refreshMenuObjects) {
            if (this.refreshMenuObjects[i]["tmpTier"] === 0) {
                continue;
            }

            if (this.refreshMenuObjects[i]["tmpTier"] < tier) {
                continue;
            }

            if (this.refreshMenuObjects[i]["bridgeid"] !== bridgeid) {
                continue;

            }

            delete (this.refreshMenuObjects[i]);
        }
    }

    /**
     * Wipes lights menu and creates lights menu items for
     * selected group.
     * 
     * @method _createCompactMenuLightsSubmenu
     * @private
     * @param {String} bridgeid
     * @param {String} groupid
     */
    _createCompactMenuLightsSubmenu(bridgeid, groupid) {
        let data = this.bridesData[bridgeid];

        this._compactMenuBridges[bridgeid]["lights"]["object"].menu.removeAll();

        let lightItems = this._createMenuLights(
            bridgeid,
            data,
            data["groups"][groupid]["lights"],
            groupid,
            "lights"
        );
        for (let lightItem in lightItems) {
            this._compactMenuBridges[bridgeid]["lights"]["object"].menu.addMenuItem(lightItems[lightItem]);
        }

        this._selectCompactMenuLights(bridgeid, groupid, null);
        this._setCompactMenuControl(bridgeid, groupid, null);
    }

    /**
     * Sets the compact menu top-item of lights menu
     * to the selected light/group
     * 
     * @method _selectCompactMenuLights
     * @private
     * @param {String} bridgeid
     * @param {String} groupid
     * @param {String} lightid
     */
    _selectCompactMenuLights(bridgeid, groupid, lightid) {
        let lightIcon = null;
        let data = this.bridesData[bridgeid];
        let defaultValue;

        this._compactMenuClearTmpObjects(bridgeid, 2);

        if (this._compactMenuBridges[bridgeid]["lights"]["icon"] != null){
            this._compactMenuBridges[bridgeid]["lights"]["object"].remove_child(
                this._compactMenuBridges[bridgeid]["lights"]["icon"]
            );

            this._compactMenuBridges[bridgeid]["lights"]["icon"] = null;
        }

        if (this._compactMenuBridges[bridgeid]["lights"]["switch"] != null){
            this._compactMenuBridges[bridgeid]["lights"]["object"].remove_child(
                this._compactMenuBridges[bridgeid]["lights"]["switch"]
            );

            this._compactMenuBridges[bridgeid]["lights"]["switch"] = null;
        }

        if (this._compactMenuBridges[bridgeid]["lights"]["slider"] != null){
            this._compactMenuBridges[bridgeid]["lights"]["box"].remove_child(
                this._compactMenuBridges[bridgeid]["lights"]["slider"]
            );

            this._compactMenuBridges[bridgeid]["lights"]["slider"] = null;
        }

        if (groupid !== null) {

            if (this._iconPack !== PhueIconPack.NONE) {
                lightIcon = this._getIconByPath(
                    Me.dir.get_path() + `/media/HueIcons/bulbGroup.svg`
                );
            }

            if (lightIcon !== null) {
                this._compactMenuBridges[bridgeid]["lights"]["object"].insert_child_at_index(lightIcon, 1);
            }

            this._compactMenuBridges[bridgeid]["lights"]["icon"] = lightIcon;

            this._compactMenuBridges[bridgeid]["lights"]["object"].label.text = _("All Lights");

            defaultValue = data["groups"][groupid]["state"]["all_on"];
            let groupSwitch = this._createLightSwitch(bridgeid, null, groupid, defaultValue, 2);
            this._compactMenuBridges[bridgeid]["lights"]["object"].add(groupSwitch);
            this._compactMenuBridges[bridgeid]["lights"]["switch"] = groupSwitch;

        } else {
            lightIcon = this._tryGetLightIcon(data["lights"][lightid]);
            this._compactMenuBridges[bridgeid]["lights"]["object"].insert_child_at_index(lightIcon, 1);
            this._compactMenuBridges[bridgeid]["lights"]["icon"] = lightIcon;
            
            this._compactMenuBridges[bridgeid]["lights"]["object"].label.text = data["lights"][lightid]["name"];

            /**
             * If brightness is possible, add a slider
             */
            let lightSlider = null;
            if (data["lights"][lightid]["state"]["bri"] !== undefined) {

                if (data["lights"][lightid]["state"]["on"]) {
                    defaultValue = data["lights"][lightid]["state"]["bri"] / 255;
                } else {
                    defaultValue = 0;
                }

                lightSlider = this._createBrightnessSlider(bridgeid, lightid, groupid, defaultValue, true);
                this._compactMenuBridges[bridgeid]["lights"]["box"].add(lightSlider);
            }

            defaultValue = data["lights"][lightid]["state"]["on"];
            let lightSwitch = this._createLightSwitch(bridgeid, lightid, groupid, defaultValue, 2);

            this._compactMenuBridges[bridgeid]["lights"]["object"].add(lightSwitch);

            this._compactMenuBridges[bridgeid]["lights"]["switch"] = lightSwitch;
            this._compactMenuBridges[bridgeid]["lights"]["slider"] = lightSlider;
        }
    }

    /**
     * Select group in compact menu.
     * 
     * @method _selectCompactMenuGroup
     * @private
     * @param {String} bridgeid 
     * @param {String} groupid
     */
    _selectCompactMenuGroup(bridgeid, groupid) {
        let groupIcon = null;
        let data = this.bridesData[bridgeid];
        let defaultValue;

        if (groupid === "0") {
            this._openMenuDefault = this._compactMenuBridges[bridgeid]["groups"]["object"].menu;
        } else {
            this._openMenuDefault = this._compactMenuBridges[bridgeid]["lights"]["object"].menu;
        }

        this._compactMenuBridges[bridgeid]["selected-group"] = groupid;

        this._compactMenuClearTmpObjects(bridgeid, 1);

        if (this._compactMenuBridges[bridgeid]["groups"]["icon"] !== null){
            this._compactMenuBridges[bridgeid]["groups"]["object"].remove_child(
                this._compactMenuBridges[bridgeid]["groups"]["icon"]
            );

            this._compactMenuBridges[bridgeid]["groups"]["icon"] = null;
        }

        if (this._compactMenuBridges[bridgeid]["groups"]["switch"] !== null){
            this._compactMenuBridges[bridgeid]["groups"]["object"].remove_child(
                this._compactMenuBridges[bridgeid]["groups"]["switch"]
            );

            this._compactMenuBridges[bridgeid]["groups"]["switch"] = null;
        }

        if (this._compactMenuBridges[bridgeid]["groups"]["slider"] !== null){
            this._compactMenuBridges[bridgeid]["groups"]["box"].remove_child(
                this._compactMenuBridges[bridgeid]["groups"]["slider"]
            );

            this._compactMenuBridges[bridgeid]["groups"]["slider"] = null;
        }

        if (this._checkBrightnessAttributeLightOrGroup(bridgeid, "groups", groupid)) {
            defaultValue = this._getGroupBrightness(bridgeid, groupid) / 255;

            let groupSlider = this._createBrightnessSlider(bridgeid, null, groupid, defaultValue, true);
            this._compactMenuBridges[bridgeid]["groups"]["box"].insert_child_at_index(groupSlider, 1);
            this._compactMenuBridges[bridgeid]["groups"]["slider"] = groupSlider;
        }

        groupIcon = this._tryGetGroupIcon(bridgeid, groupid);

        if (groupIcon !== null) {
            this._compactMenuBridges[bridgeid]["groups"]["object"].insert_child_at_index(groupIcon, 1);
            this._compactMenuBridges[bridgeid]["groups"]["icon"] = groupIcon;
        }

        this._compactMenuBridges[bridgeid]["groups"]["object"].label.text = this._getGroupName(bridgeid, groupid);

        let groupSwitch = this._createGroupSwitch(bridgeid, groupid, true);
        this._compactMenuBridges[bridgeid]["groups"]["object"].add(groupSwitch);
        this._compactMenuBridges[bridgeid]["groups"]["switch"] = groupSwitch;

        /* lights */
        this._createCompactMenuLightsSubmenu(bridgeid, groupid);

        /* scenes */
        if (this._showScenes && this._compactMenuBridges[bridgeid]["scenes"] !== undefined) {
            this._compactMenuBridges[bridgeid]["scenes"]["object"].menu.removeAll();

            this._compactMenuBridges[bridgeid]["scenes"]["object"].visible = true;

            let scenesItems = this._createMenuLights(
                bridgeid,
                data,
                data["groups"][groupid]["lights"],
                groupid,
                "scenes"
            );
            for (let sceneItem in scenesItems) {
                this._compactMenuBridges[bridgeid]["scenes"]["object"].menu.addMenuItem(scenesItems[sceneItem]);
            }

            if (scenesItems.length === 0) {
                this._compactMenuBridges[bridgeid]["scenes"]["object"].visible = false;
            }
        }

        /* control */
        this._setCompactMenuControl(bridgeid, groupid, null);

        /**
         * ask for async all data,
         * which will invoke refreshMenu
         */
        this.hue.instances[bridgeid].getAll();
    }

    /**
     * Creates items of groups for compact menu,
     * also adds callbe for such a item. In this
     * callback the top-menu item is modified
     * 
     * @method _createCompactGroups
     * @private
     * @param {String} bridgeid
     * @param {Object} data
     * @param {String} groupType
     * @return {Object} items of menu
     */
    _createCompactGroups(bridgeid, data, groupType) {

        let menuItems = [];
        let groupIcon = null;
        let defaultValue;

        if (data["groups"] === undefined) {
            return [];
        }

        for (let groupid in data["groups"]) {
            if (data["groups"][groupid]["type"] !== groupType) {
                continue;
            }

            if (data["groups"][groupid]["type"] === "LightGroup" &&
                groupid !== "0") {
                /* With type "LightGroup", we show only group 0 with all lights */
                continue;
            }

            let groupItem = new PopupMenu.PopupMenuItem(
                this._getGroupName(bridgeid, groupid)
            );

            let label = groupItem.label
            groupItem.remove_child(groupItem.label);
            let itemBox = new St.BoxLayout();
            itemBox.vertical = true;
            itemBox.add(label);
            if (this._checkBrightnessAttributeLightOrGroup(bridgeid, "groups", groupid)) {
                defaultValue = this._getGroupBrightness(bridgeid, groupid) / 255;

                itemBox.add(this._createBrightnessSlider(bridgeid, null, groupid, defaultValue));
            }
            groupItem.insert_child_at_index(itemBox, 1);

            groupIcon = this._tryGetGroupIcon(bridgeid, groupid);
            if (groupIcon !== null) {
                groupItem.insert_child_at_index(groupIcon, 1);
            }

            groupItem.set_x_align(Clutter.ActorAlign.FILL);
            groupItem.label.set_x_expand(true);

            groupItem.add(this._createGroupSwitch(bridgeid, groupid));

            groupItem.originalActivate = groupItem.activate;
            groupItem.activate = (event) => {
                /**
                 * activate function is used here becase
                 * the menu.open(true) does not work with
                 * 'button-press-event' signal correctly
                 */

                if (!this.hue.instances[bridgeid].isConnected()) {
                    return groupItem.originalActivate(event);
                }

                this._menuSelected[bridgeid] = {"groupid": groupid}
                this.writeMenuSelectedSettings();

                this._selectCompactMenuGroup(bridgeid, groupid);

                this._compactMenuBridges[bridgeid]["lights"]["object"].menu.open(true);

                if (this._compactMenuBridges[bridgeid]["groups"]["hidden-item"] !== undefined) {
                    this._compactMenuBridges[bridgeid]["groups"]["hidden-item"].visible = true;
                }

                groupItem.visible = false;
                this._compactMenuBridges[bridgeid]["groups"]["hidden-item"] = groupItem;

                return groupItem.originalActivate(event);
            }

            let hiddenGroup = false;

            if (this._menuSelected[bridgeid] !== undefined &&
                this._menuSelected[bridgeid]["groupid"] !== undefined &&
                groupid === this._menuSelected[bridgeid]["groupid"].toString()) {

                hiddenGroup = true;
            }

            if ((this._menuSelected[bridgeid] === undefined ||
                Object.keys(this._menuSelected[bridgeid]).length === 0) &&
                groupid === "0") {

                hiddenGroup = true;
            }

            if (hiddenGroup) {

                groupItem.visible = false;
                this._compactMenuBridges[bridgeid]["groups"]["hidden-item"] = groupItem;
            }

            menuItems.push(groupItem);
        }

        return menuItems;
    }

    /**
     * Creates groups (rooms/zones) menu
     * for compact menu
     * 
     * @method _createCompactMenuGroups
     * @private
     * @param {String} bridgeid
     * @param {Object} data
     * @return {Object} menu items
     */
    _createCompactMenuGroups(bridgeid, data) {
        let menuItems = [];
        let items = [];

        if (this._compactMenuBridges === undefined) {
            this._compactMenuBridges = {};
        }

        this._compactMenuBridges[bridgeid] = {};

        let groupsSubMenu = new PopupMenu.PopupSubMenuMenuItem(
            _("No group selected")
        );

        /* disable closing menu on item activated */
        groupsSubMenu.menu.itemActivated = (animate) => {};

        let label = groupsSubMenu.label
        groupsSubMenu.remove_child(groupsSubMenu.label);
        let itemBox = new St.BoxLayout();
        itemBox.vertical = true;
        itemBox.add(label);
        groupsSubMenu.insert_child_at_index(itemBox, 1);

        this._compactMenuBridges[bridgeid]["groups"] = {}
        this._compactMenuBridges[bridgeid]["groups"]["object"] = groupsSubMenu;
        this._compactMenuBridges[bridgeid]["groups"]["icon"] = null;
        this._compactMenuBridges[bridgeid]["groups"]["box"] = itemBox;
        this._compactMenuBridges[bridgeid]["groups"]["switch"] = null;
        this._compactMenuBridges[bridgeid]["groups"]["slider"] = null;
        this._compactMenuBridges[bridgeid]["selected-group"] = null;

        this._openMenuDefault = groupsSubMenu.menu;

        groupsSubMenu.connect(
            'button-press-event',
            () => {
                this.hue.instances[bridgeid].getAll();
            }
        );

        this._lastOpenedMenu = {"last": groupsSubMenu.menu, "opening": null};
        groupsSubMenu.menu.connect(
            'open-state-changed',
            (menu, isOpen) => {
                this._handleLastOpenedMenu(menu, isOpen);
            }
        );

        menuItems.push(groupsSubMenu);

        items = items.concat(
            this._createCompactGroups(bridgeid, data, "LightGroup")
        );

        items = items.concat(
            [new PopupMenu.PopupSeparatorMenuItem()]
        );

        if (this._zonesFirst) {
            items = items.concat(
                this._createCompactGroups(bridgeid, data, "Zone")
            );

            if (items.length > 0) {
                items = items.concat(
                    [new PopupMenu.PopupSeparatorMenuItem()]
                );
            }

            items = items.concat(
                this._createCompactGroups(bridgeid, data, "Room")
            );
        } else {
            items = items.concat(
                this._createCompactGroups(bridgeid, data, "Room")
            );

            if (items.length > 0) {
                items = items.concat(
                    [new PopupMenu.PopupSeparatorMenuItem()]
                );
            }

            items = items.concat(
                this._createCompactGroups(bridgeid, data, "Zone")
            );
        }

        for (let i in items) {
            groupsSubMenu.menu.addMenuItem(items[i]);
        }

        return menuItems;
    }

    /**
     * Creates lights menu frame for compact men.
     * No lights selected yet.
     * 
     * @method _createCompactMenuLights
     * @private
     * @param {String} bridgeid
     * @param {Object} data
     * @return {Object} menu items
     */
    _createCompactMenuLights(bridgeid, data) {
        let lightsSubMenu = new PopupMenu.PopupSubMenuMenuItem(
            _("None")
        );

        /* disable closing menu on item activated */
        lightsSubMenu.menu.itemActivated = (animate) => {};

        let label = lightsSubMenu.label
        lightsSubMenu.remove_child(lightsSubMenu.label);
        let itemBox = new St.BoxLayout();
        itemBox.vertical = true;
        itemBox.add(label);
        lightsSubMenu.insert_child_at_index(itemBox, 1);

        lightsSubMenu.connect(
            'button-press-event',
            () => {
                /**
                 * ask for async all data,
                 * which will invoke refreshMenu
                 */
                this.hue.instances[bridgeid].getAll();
            }
        );

        lightsSubMenu.menu.connect(
            'open-state-changed',
            (menu, isOpen) => {
                this._handleLastOpenedMenu(menu, isOpen);
            }
        );

        this._compactMenuBridges[bridgeid]["lights"] = {};
        this._compactMenuBridges[bridgeid]["lights"]["object"] = lightsSubMenu;
        this._compactMenuBridges[bridgeid]["lights"]["icon"] = null;
        this._compactMenuBridges[bridgeid]["lights"]["box"] = itemBox;
        this._compactMenuBridges[bridgeid]["lights"]["switch"] = null;
        this._compactMenuBridges[bridgeid]["lights"]["slider"] = null;

        return lightsSubMenu;
    }

    /**
     * Creates scenes menu for compact menu
     * based on item selected in group menu.
     * 
     * @method _createCompactMenuScenes
     * @private
     * @param {String} bridgeid
     * @param {Object} data
     * @return {Object} menu items
     */
    _createCompactMenuScenes(bridgeid, data) {
        let scenesSubMenu = new PopupMenu.PopupSubMenuMenuItem(
            _("Scenes")
        );

        /* disable closing menu on item activated */
        scenesSubMenu.menu.itemActivated = (animate) => {};

        let scenesIcon = null;
        if (this._iconPack !== PhueIconPack.NONE) {
            let iconPath = "";

            iconPath = Me.dir.get_path() + `/media/HueIcons/uicontrolsScenes.svg`

            scenesIcon = this._getIconByPath(iconPath);
        }

        if (scenesIcon !== null) {
            scenesSubMenu.insert_child_at_index(scenesIcon, 1);
        }

        scenesSubMenu.menu.connect(
            'open-state-changed',
            (menu, isOpen) => {
                this._handleLastOpenedMenu(menu, isOpen);
            }
        );

        this._compactMenuBridges[bridgeid]["scenes"] = {};
        this._compactMenuBridges[bridgeid]["scenes"]["object"] = scenesSubMenu;
        this._compactMenuBridges[bridgeid]["scenes"]["icon"] = scenesIcon;

        if (this._compactMenuBridges[bridgeid]["selected-group"] === null) {

            scenesSubMenu.menu.addMenuItem(
                new PopupMenu.PopupMenuItem(
                    _("No room/zone selected")
                )
            );

            scenesSubMenu.visible = false;

            return scenesSubMenu;
        }

        let groupid = this._compactMenuBridges[bridgeid]["selected-group"];

        let lightItems = this._createMenuLights(
            bridgeid,
            data,
            data["groups"][groupid]["lights"],
            groupid,
            "scenes"
        );
        for (let lightItem in lightItems) {
            scenesSubMenu.menu.addMenuItem(lightItems[lightItem]);
        }

        return scenesSubMenu;
    }

    _createCompactMenuControl(bridgeid, data) {
        let controlSubMenu = new PopupMenu.PopupSubMenuMenuItem(
            _("Color & Temperature")
        );

        /* disable closing menu on item activated */
        controlSubMenu.menu.itemActivated = (animate) => {};

        let controlIcon = null;
        if (this._iconPack !== PhueIconPack.NONE) {
            let iconPath = "";

            iconPath = Me.dir.get_path() + `/media/HueIcons/uicontrolsColorScenes.svg`

            controlIcon = this._getIconByPath(iconPath);
        }

        if (controlIcon !== null) {
            controlSubMenu.insert_child_at_index(controlIcon, 1);
        }

        controlSubMenu.menu.connect(
            'open-state-changed',
            (menu, isOpen) => {
                this._handleLastOpenedMenu(menu, isOpen);
            }
        );

        this._compactMenuBridges[bridgeid]["control"] = {};
        this._compactMenuBridges[bridgeid]["control"]["object"] = controlSubMenu;

        return controlSubMenu;
    }

    /**
     * Creates array of submenus for groups of bridge.
     * 
     * @method _createMenuGroups
     * @private
     * @param {String} bridgeid which bridge we use here
     * @param {Object} dictionary data for the bridgeid
     * @param {String} "Zone" or "Room"
     * @return {Object} array of submenus
     */
    _createMenuGroups(bridgeid, data, groupType) {

        let menuItems = [];
        let groupIcon = null;
        let defaultValue;

        if (data["groups"] === undefined) {
            return [];
        }

        for (let groupid in data["groups"]) {
            if (data["groups"][groupid]["type"] !== groupType) {
                continue;
            }

            if (data["groups"][groupid]["type"] === "LightGroup" &&
                groupid !== "0") {
                /* With type "LightGroup", we show only group 0 with all lights */
                continue;
            }

            let groupItem = new PopupMenu.PopupSubMenuMenuItem(
                this._getGroupName(bridgeid, groupid)
            );

            let label = groupItem.label
            groupItem.remove_child(groupItem.label);
            let itemBox = new St.BoxLayout();
            itemBox.vertical = true;
            itemBox.add(label);
            if (this._checkBrightnessAttributeLightOrGroup(bridgeid, "groups", groupid)) {
                defaultValue = this._getGroupBrightness(bridgeid, groupid) / 255;

                itemBox.add(this._createBrightnessSlider(bridgeid, null, groupid, defaultValue));
            }
            groupItem.insert_child_at_index(itemBox, 1);

            /* disable closing menu on item activated */
            groupItem.menu.itemActivated = (animate) => {};

            groupIcon = this._tryGetGroupIcon(bridgeid, groupid);
            if (groupIcon !== null) {
                groupItem.insert_child_at_index(groupIcon, 1);
            }

            groupItem.add(this._createGroupSwitch(bridgeid, groupid));

            menuItems.push(groupItem);

            let lightItems = this._createMenuLights(
                bridgeid,
                data,
                data["groups"][groupid]["lights"],
                groupid
            );
            for (let lightItem in lightItems) {
                groupItem.menu.addMenuItem(lightItems[lightItem]);
            }
        }

        return menuItems;
    }

    /**
     * Creates switch for entertainment item
     * 
     * @method _createEntertainmentSwitch
     * @private
     * @param {String} bridgeid 
     * @param {String} groupid 
     * @return {Object} switch button
     */
    _createEntertainmentSwitch(bridgeid, groupid) {
        let switchBox;
        let switchButton;

        let bridgePath = `${this._rndID()}::groups::${groupid}::stream::active`;

        switchBox = new PopupMenu.Switch(false);
        switchButton = new St.Button({reactive: true, can_focus: true});
        switchButton.set_x_align(Clutter.ActorAlign.END);
        switchButton.set_x_expand(false);
        switchButton.child = switchBox;
        switchButton.connect(
            "button-press-event",
            () => {
                switchBox.toggle();
            }
        );
        switchButton.connect(
            "button-press-event",
            this._menuEventHandler.bind(
                this,
                {
                    "bridgePath": bridgePath,
                    "bridgeid": bridgeid,
                    "object": switchBox,
                    "type": "switchEntertainment"
                }
            )
        );

        this.refreshMenuObjects[bridgePath] = {
            "bridgeid": bridgeid,
            "object": switchBox,
            "type": "switch",
            "tmpTier": 0
        }

        return switchButton;
    }

    /**
     * Creates entertainment item
     * 
     * @method _createItemEntertainment
     * @private
     * @param {String} bridgeid which bridge we use here
     * @param {Object} dictionary data for the bridgeid
     * @param {Number} groupid of the entertainment group
     * @return {Object} menuitem with group controls
     */
    _createItemEntertainment(bridgeid, data, groupid) {
        let entertainment;

        entertainment = new PopupMenu.PopupMenuItem(
            data["groups"][groupid]["name"]
        );

        entertainment.set_x_align(Clutter.ActorAlign.FILL);
        entertainment.label.set_x_expand(true);

        entertainment.add(this._createEntertainmentSwitch(bridgeid, groupid));

        return entertainment;
    }

    /**
     * Creates item with slider used by entertainment settings
     * 
     * @method _createEntertainmentSliderItem
     * @private
     * @param {String} bridgeid which bridge we use here
     * @param {String} name used with the item
     * @param {Number} default value
     * @return {Object} menuitem with group controls
     */
    _createEntertainmentSliderItem(bridgeid, name, defaultValue) {
        let entertainmentSliderItem;
        let bridgePath = `${this._rndID()}`;

        entertainmentSliderItem = new PopupMenu.PopupMenuItem(
            name
        );

        entertainmentSliderItem.set_x_align(Clutter.ActorAlign.FILL);
        entertainmentSliderItem.label.set_x_expand(true);

        let slider = new Slider.Slider(0);

        slider.set_width(200);
        slider.set_x_align(Clutter.ActorAlign.END);
        slider.set_x_expand(false);
        slider.value = defaultValue;

        entertainmentSliderItem.add(slider);

        slider.connect(
            "drag-end",
            this._menuEventHandler.bind(
                this,
                {
                    "bridgePath": bridgePath,
                    "bridgeid": bridgeid,
                    "object":slider,
                    "type": "entertainment" + name
                }
            )
        );

        return entertainmentSliderItem;
    }

    /**
     * Creates items with possible entertainment effects
     * 
     * @method _createsEntertainmentServiceItems
     * @private
     * @param {String} bridgeid which bridge we use here
     * @return {Object} menuitems
     */
    _createsEntertainmentServiceItems(bridgeid) {
        let bridgePath = `${this._rndID()}`;
        let items = [];
        let switchBoxes = [];
        let displaysItems = [];
        let modes = [
            Utils.entertainmentMode.SYNC,
            Utils.entertainmentMode.SELECTION,
            Utils.entertainmentMode.CURSOR,
            Utils.entertainmentMode.RANDOM,
        ];
        let signal;
        let icon;

        let displaysNumber = global.display.get_n_monitors();
        if (displaysNumber > 1) {
            for (let i = 0; i < displaysNumber; i++) {
                displaysItems.push([Utils.entertainmentMode.DISPLAYN, i]);
            }
        }

        modes = displaysItems.concat(modes);

        this._isStreaming[bridgeid]["entertainmentModeSwitches"] = [];

        for (let service of modes) {
            let serviceLabel;
            let displayGeometry = [];

            if (service instanceof Array && service[0] === Utils.entertainmentMode.DISPLAYN) {
                let i = service[1];
                let monitorRectangle = global.display.get_monitor_geometry(i);

                displayGeometry = [
                    monitorRectangle.x,
                    monitorRectangle.y,
                    monitorRectangle.width,
                    monitorRectangle.height
                ];

                serviceLabel = _("Display") + ` ${i + 1} (${displayGeometry[2]}x${displayGeometry[3]})`;
            } else {
                serviceLabel = Utils.entertainmentModeText[service];
            }

            let serviceItem = new PopupMenu.PopupMenuItem(
                serviceLabel
            );

            let switchBox = new PopupMenu.Switch(false);
            switchBoxes.push(switchBox);
            let switchButton = new St.Button({reactive: true, can_focus: true});
            switchButton.set_x_align(Clutter.ActorAlign.END);
            switchButton.set_x_expand(false);
            switchButton.child = switchBox;

            if (this._isStreaming[bridgeid]["entertainmentMode"] === service) {
                switchBox.state = true;
            }

            signal = switchButton.connect(
                "button-press-event",
                () => {
                    switchBox.toggle();

                    if (switchBox.state === false) {
                        switchBox.state = true;
                    }
                    for (let i of switchBoxes) {
                        if (i !== switchBox) {
                            i.state = false;
                        }
                    }
                }
            );
            this._appendSignal(signal, switchButton, true);

            signal = switchButton.connect(
                "button-press-event",
                this._menuEventHandler.bind(
                    this,
                    {
                        "bridgePath": bridgePath,
                        "bridgeid": bridgeid,
                        "object": switchButton,
                        "service": service instanceof Array ? service[0]: service,
                        "syncGeometry": displayGeometry,
                        "type": "entertainmentMode"
                    }
                )
            );
            this._appendSignal(signal, switchButton, true);

            serviceItem.set_x_align(Clutter.ActorAlign.FILL);
            serviceItem.label.set_x_expand(true);

            serviceItem.add(switchButton);

            this._isStreaming[bridgeid]["entertainmentModeSwitches"].push(
                [service, switchBox]
            );

            items.push(serviceItem);
        }

        this.refreshMenuObjects[`special::${bridgeid}::entertainment-mode-switches`] = {
            "bridgeid": bridgeid,
            "object": null,
            "type": "entertainment-mode-switches",
            "tmpTier": 0
        }

        items.push(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        /**
         * Selected area default group selector.
         */
        let setSelectionGroupItem = new PopupMenu.PopupMenuItem(
            ""
        );

        signal = setSelectionGroupItem.connect(
            'button-press-event',
            () => { this.setDefaultSelectionGroup(); }
        );
        this._appendSignal(signal, setSelectionGroupItem, true);

        this.refreshMenuObjects[`special::${bridgeid}::entertainment-default-selection-label`] = {
            "bridgeid": bridgeid,
            "object": setSelectionGroupItem.label,
            "type": "entertainment-default-selection-label",
            "tmpTier": 0
        }

        items.push(setSelectionGroupItem);


        /**
         * Refresh menu item
         */
        let refreshMenuItem = new PopupMenu.PopupMenuItem(
            _("Refresh displays")
        );

        if (this._iconPack !== PhueIconPack.NONE) {
            icon = this._getGnomeIcon("emblem-synchronizing-symbolic");

            if (icon !== null){
                refreshMenuItem.insert_child_at_index(icon, 1);
            }
        }

        signal = refreshMenuItem.connect(
            'button-press-event',
            () => { this.rebuildMenuStart(); }
        );
        this._appendSignal(signal, refreshMenuItem, true);

        items.push(refreshMenuItem);

        return items;
    }

    _createEntertainmentMainSwitch(bridgeid) {
        let switchBox;
        let switchButton;

        let bridgePath = `${this._rndID()}`;

        switchBox = new PopupMenu.Switch(false);
        switchButton = new St.Button({reactive: true, can_focus: true});
        switchButton.set_x_align(Clutter.ActorAlign.END);
        switchButton.set_x_expand(false);
        switchButton.child = switchBox;
        switchButton.connect(
            "button-press-event",
            () => {
                switchBox.toggle();
            }
        );

        switchButton.connect(
            "button-press-event",
            this._menuEventHandler.bind(
                this,
                {
                    "bridgePath": bridgePath,
                    "bridgeid": bridgeid,
                    "object": switchBox,
                    "type": "mainSwitchEntertainment"
                }
            )
        );

        this.refreshMenuObjects[`special::${bridgeid}::main-switch-entertainment`] = {
            "bridgeid": bridgeid,
            "object": switchBox,
            "type": "main-switch-entertainment",
            "tmpTier": 0
        }

        return switchButton;
    }

    /**
     * Creates entertainment menu
     * 
     * @method _createEntertainment
     * @private
     * @param {String} bridgeid which bridge we use here
     * @param {Object} dictionary data for the bridgeid
     * @return {Object} menuitem with group controls
     */
     _createEntertainment(bridgeid, data) {

        let entertainmentMainItem;
        let entertainmentModeItem;
        let entertainmentIcon = null;
        let itemCounter = 0;

        if (data["groups"] === undefined) {
            return [];
        }

        entertainmentMainItem = new PopupMenu.PopupSubMenuMenuItem(
            _("Entertainment areas")
        );

        /* disable closing menu on item activated */
        entertainmentMainItem.menu.itemActivated = (animate) => {};

        if (this._compactMenu) {
            entertainmentMainItem.menu.connect(
                'open-state-changed',
                (menu, isOpen) => {
                    this._handleLastOpenedMenu(menu, isOpen);
                }
            );
        }

        this.refreshMenuObjects[`special::${bridgeid}::entertainment-label`] = {
            "bridgeid": bridgeid,
            "object": entertainmentMainItem.label,
            "type": "entertainment-label",
            "tmpTier": 0
        }

        entertainmentMainItem.set_x_align(Clutter.ActorAlign.FILL);
        entertainmentMainItem.label.set_x_expand(true);

        entertainmentMainItem.add(this._createEntertainmentMainSwitch(bridgeid));

        if (this._iconPack !== PhueIconPack.NONE) {
            let iconPath = "";

            iconPath = Me.dir.get_path() + `/media/HueIcons/roomsMancave.svg`

            entertainmentIcon = this._getIconByPath(iconPath);
        }

        if (entertainmentIcon !== null) {
            entertainmentMainItem.insert_child_at_index(entertainmentIcon, 1);
        }

        let entertainmentIntensityItem = this._createEntertainmentSliderItem(
            bridgeid,
            "Intensity",
            ((255 - this._isStreaming[bridgeid]["intensity"] - 40)) / 100
        );
        entertainmentMainItem.menu.addMenuItem(entertainmentIntensityItem);

        let entertainmentBrightnessItem = this._createEntertainmentSliderItem(
            bridgeid,
            "Brightness",
            this._isStreaming[bridgeid]["brightness"] / 255
        );
        entertainmentMainItem.menu.addMenuItem(entertainmentBrightnessItem);

        entertainmentMainItem.menu.addMenuItem(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        for (let groupid in data["groups"]) {

            if (data["groups"][groupid]["type"] !== "Entertainment") {
                continue;
            }

            let entertainmentItem = this._createItemEntertainment(
                bridgeid,
                data,
                groupid
            );

            entertainmentMainItem.menu.addMenuItem(entertainmentItem);

            itemCounter++;
        }

        if (itemCounter === 0) {
            return [];
        }

        entertainmentModeItem = new PopupMenu.PopupSubMenuMenuItem(
            _("Entertainment mode")
        );

        /* disable closing menu on item activated */
        entertainmentModeItem.menu.itemActivated = (animate) => {};

        if (this._compactMenu) {
            entertainmentModeItem.menu.connect(
                'open-state-changed',
                (menu, isOpen) => {
                    this._handleLastOpenedMenu(menu, isOpen);
                }
            );
        }

        this.refreshMenuObjects[`special::${bridgeid}::entertainment-mode-label`] = {
            "bridgeid": bridgeid,
            "object": entertainmentModeItem.label,
            "type": "entertainment-mode-label",
            "tmpTier": 0
        }

        if (this._iconPack !== PhueIconPack.NONE) {
            let iconPath = "";

            iconPath = Me.dir.get_path() + `/media/HueIcons/roomsMancave.svg`

            entertainmentIcon = this._getIconByPath(iconPath);
        }

        if (entertainmentIcon !== null) {
            entertainmentModeItem.insert_child_at_index(entertainmentIcon, 1);
        }

        for (let serviceItem of this._createsEntertainmentServiceItems(bridgeid)) {
            entertainmentModeItem.menu.addMenuItem(serviceItem);
        }

        return [entertainmentMainItem, entertainmentModeItem];
    }

    /**
     * Select saved group and light in compact menu.
     * 
     * @method _selectCompactMenu
     * @private
     * @param {String} bridgeid 
     */
    _selectCompactMenu(bridgeid) {

        if (this.bridesData[bridgeid] === undefined ||
            this._menuSelected[bridgeid] === undefined) {

            this._menuSelected[bridgeid] = {};
        }

        if (this._menuSelected[bridgeid]["lightid"] === 0) {
            /* 0 is for no light, it is unknown lightid */
            delete(this._menuSelected[bridgeid]["lightid"]);
        }

        if (this._menuSelected[bridgeid]["groupid"] !== undefined &&
            this.bridesData[bridgeid]["groups"][this._menuSelected[bridgeid]["groupid"]] === undefined) {
            delete(this._menuSelected[bridgeid]["groupid"]);
        }

        if (this._menuSelected[bridgeid]["lightid"] !== undefined &&
            this.bridesData[bridgeid]["lights"][this._menuSelected[bridgeid]["lightid"]] === undefined) {

            delete(this._menuSelected[bridgeid]["lightid"]);
        }

        if (this._menuSelected[bridgeid] === undefined ||
            this._menuSelected[bridgeid]["groupid"] === undefined ||
            this._menuSelected[bridgeid]["groupid"] === 0) {

            this._selectCompactMenuGroup(bridgeid, "0");

        } else {
            this._selectCompactMenuGroup(
                bridgeid,
                this._menuSelected[bridgeid]["groupid"],
                null
            );

            this._setCompactMenuControl(
                bridgeid,
                this._menuSelected[bridgeid]["groupid"],
                null
            );
        }


        if (this._menuSelected[bridgeid] !== undefined &&
            this._menuSelected[bridgeid]["lightid"] !== undefined) {

            this._selectCompactMenuLights(
                bridgeid,
                null,
                this._menuSelected[bridgeid]["lightid"]
            );

            this._setCompactMenuControl(
                bridgeid,
                null,
                this._menuSelected[bridgeid]["lightid"]
            );
        }
    }

    /**
     * Creates array of submenus of compact menu for bridge.
     * 
     * @method _createCompactMenuBridge
     * @private
     * @param {String} bridgeid which bridge we use here
     * @return {Object} array of bridge label and submenus of the bridge
     */
    _createCompactMenuBridge(bridgeid) {
        let items = [];
        let data = {};

        data = this.bridesData[bridgeid];

        if (data["config"] === undefined) {
            return [];
        }

        items.push(this._createSubMenuBridge(bridgeid, data));

        items = items.concat(
            this._createEntertainment(bridgeid, data)
        );

        items = items.concat(
            this._createCompactMenuGroups(bridgeid, data)
        );

        items = items.concat(
            this._createCompactMenuLights(bridgeid, data)
        );

        if (this._showScenes) {
            items = items.concat(
                this._createCompactMenuScenes(bridgeid, data)
            );
        }

        items = items.concat(
            this._createCompactMenuControl(bridgeid, data)
        );

        this._selectCompactMenu(bridgeid);

        return items;
    }

    /**
     * Creates array of submenus for bridge.
     * 
     * @method _createMenuBridge
     * @private
     * @param {String} bridgeid which bridge we use here
     * @return {Object} array of bridge label and submenus of the bridge
     */
    _createMenuBridge(bridgeid) {

        let items = [];
        let data = {};

        data = this.bridesData[bridgeid];

        if (data["config"] === undefined) {
            return [];
        }

        items.push(this._createSubMenuBridge(bridgeid, data));

        items = items.concat(
            this._createEntertainment(bridgeid, data)
        );

        items = items.concat(
            this._createMenuGroups(bridgeid, data, "LightGroup")
        );

        if (this._zonesFirst) {
            items = items.concat(
                this._createMenuGroups(bridgeid, data, "Zone")
            );
            items = items.concat(
                this._createMenuGroups(bridgeid, data, "Room")
            );
        } else {
            items = items.concat(
                this._createMenuGroups(bridgeid, data, "Room")
            );
            items = items.concat(
                this._createMenuGroups(bridgeid, data, "Zone")
            );
        }

        return items;
    }

    /**
     * Check if light related to the brightness is off.
     * Thus the brightness should be off.
     * @method _checkBrightnessOfLight
     * @private
     * @param {bridgeid} bridgeid
     * @param {Object} parsedBridgePath
     * @returns {Boolean} true for yes
     */
    _checkBrightnessOfLight(bridgeid, p) {

        if (p[1] == "lights") {
            let light = this.bridesData[bridgeid]["lights"][p[2]];
            return light["state"]["on"];
        }

        if (p[1] == "groups") {
            let group = this.bridesData[bridgeid]["groups"][p[2]];
            return group["state"]["any_on"];
        }

        return true;
    }

    /**
     * Check if light belongs to an entertaiment group
     * and the group's stream is active now.
     * 
     * @method _checkEntertainmentStream
     * @private
     * @param {bridgeid} bridgeid
     * @param {Object} parsedBridgePath
     * @returns {Boolean} true for yes
     */
    _checkEntertainmentStream(bridgeid, p) {
        if (p[1] !== "lights") {
            return false;
        }

        if (this.bridesData[bridgeid]["groups"] === undefined) {
            return false;
        }

        for (let group in this.bridesData[bridgeid]["groups"]) {
            if (this.bridesData[bridgeid]["groups"][group]["type"] !== "Entertainment") {
                continue;
            }

            if (this.bridesData[bridgeid]["groups"][group]["stream"] === undefined) {
                continue;
            }

            if (! this.bridesData[bridgeid]["groups"][group]["stream"]["active"]) {
                continue;
            }

            for (let light in this.bridesData[bridgeid]["groups"][group]["lights"]) {
                if (parseInt(this.bridesData[bridgeid]["groups"][group]["lights"][light]) === parseInt(p[2])) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Let the user select area on screen and call callback.
     * 
     * @method _entertainmentSelectArea
     * @private
     * @param {bridgeid} bridgeid
     * @param {object} callback
     * @param {object} arguments for callback
     */
    _entertainmentSelectArea(bridgeid, callback, ...args) {
        Utils.logDebug(`Select area for entertainment for bridge ${bridgeid}`);

        let areaSelector = new AreaSelector.AreaSelector();
        let areaSelectorSignals = [];

        let signal = areaSelector.connect("area-selected", () => {
            this._isStreaming[bridgeid]["syncGeometry"] = areaSelector.getRectangle();

            for(let s in areaSelectorSignals) {
                areaSelector.disconnect(areaSelectorSignals[s]);
            }

            callback.apply(this, args);

            return;
        });
        areaSelectorSignals.push(signal);

        areaSelector.connect("area-canceled", () => {
            Utils.logDebug("Select streaming canceled.");

            this._isStreaming[bridgeid]["entertainment"].closeBridge();

            for(let s in areaSelectorSignals) {
                areaSelector.disconnect(areaSelectorSignals[s]);
            }

            return;
        });
        areaSelectorSignals.push(signal);
    }

    /**
     * Starts the entertainment stream with selected effect
     * 
     * @method _startEntertainmentStream
     * @private
     * @param {bridgeid} bridgeid
     * @param {groupid} groupid
     */
    _startEntertainmentStream(bridgeid, groupid) {
        let gradient = false;
        let streamingLights = [];
        for (let i in this.bridesData[bridgeid]["groups"][groupid]["lights"]) {
            let light = this.bridesData[bridgeid]["groups"][groupid]["lights"][i];

            if (this.bridesData[bridgeid]["lights"][light]["productname"].indexOf("gradient") >= 0) {
                gradient = true;
                continue;
            }

            streamingLights.push(parseInt(light));
        }

        /**
         * gradient light strip not working with api 1 anymore:(
         * It even disables the stream to the entertainment group now...
         * We need to wait for api 2 to be publicized by Philips Hue...
         * TODO
         */
        gradient = false;

        let streamingLightsLocations = {};
        for (let i in this.bridesData[bridgeid]["groups"][groupid]["locations"]) {
            streamingLightsLocations[parseInt(i)] = this.bridesData[bridgeid]["groups"][groupid]["locations"][i];
        }

        switch(this._isStreaming[bridgeid]["entertainmentMode"]) {

            case Utils.entertainmentMode.SYNC:
                this._isStreaming[bridgeid]["syncGeometry"] = undefined;
            case Utils.entertainmentMode.SELECTION:
            case Utils.entertainmentMode.DISPLAYN:
                Utils.logDebug(`Starting sync sreen ${
                    JSON.stringify(this._isStreaming[bridgeid]["syncGeometry"])
                } entertainment for bridge ${bridgeid} group ${groupid}`);

                this._isStreaming[bridgeid]["entertainment"].startSyncScreen(
                    this._isStreaming[bridgeid]["syncGeometry"],
                    streamingLights,
                    streamingLightsLocations,
                    gradient);
                break;

            case Utils.entertainmentMode.CURSOR:
                Utils.logDebug(`Starting track cursor entertainment for bridge ${bridgeid} group ${groupid}`);

                this._isStreaming[bridgeid]["entertainment"].startCursorColor(
                    streamingLights,
                    streamingLightsLocations,
                    gradient);
                break;

            case Utils.entertainmentMode.RANDOM:
                Utils.logDebug(`Starting random entertainment for bridge ${bridgeid} group ${groupid}`);

                this._isStreaming[bridgeid]["entertainment"].startRandom(
                    streamingLights,
                    streamingLightsLocations,
                    gradient);
                break;

            default:
        }
    }

    /**
     * This is called when sync selection area shortcut is pressed.
     * 
     * @method _syncSelectionShortCut
     * @private
     */
    _syncSelectionShortCut(bridgeid, groupid) {

        if (this._isStreaming === undefined) {
            return;
        }

        if (!this.hue.instances[bridgeid].isConnected()) {
            Main.notify(
                _("Hue Lights - key shortcut: ") + this._syncSelectionKeyShortcut,
                _("Please check the connection to Philips Hue bridge.")
            );

            return;
        }

        groupid = parseInt(groupid);

        if (this._isStreaming[bridgeid]["state"] === StreamState.RUNNING) {
            if (this._isStreaming[bridgeid]["groupid"] !== groupid) {
                Main.notify(
                    _("Hue Lights - key shortcut: ") + this._syncSelectionKeyShortcut,
                    _("Disable previous entertainment stream.")
                );

                Utils.logDebug(`Entertainment group ${this._isStreaming[bridgeid]["groupid"]} is already streaming.`);
                return;
            }

            this._isStreaming[bridgeid]["entertainmentMode"] = Utils.entertainmentMode.SELECTION;

            this._entertainmentSelectArea(
                bridgeid,
                this._startEntertainmentStream,
                bridgeid,
                groupid
            );
        } else {
            this._isStreaming[bridgeid]["entertainmentMode"] = Utils.entertainmentMode.SELECTION;

            this._entertainmentSelectArea(
                bridgeid,
                () => {
                    if (!this.hue.instances[bridgeid].isConnected()){
                        this._checkHueLightsIsStreaming(bridgeid);
                        return;
                    }

                    if (!this._checkClientKey(bridgeid)) {
                        return;
                    }

                    if (this._checkAnyEntertainmentActive(bridgeid)) {
                        return;
                    }

                    if (this._isStreaming[bridgeid]["state"] === StreamState.STOPPED) {
                        this._isStreaming[bridgeid]["groupid"] = groupid;

                        this._isStreaming[bridgeid]["state"] = StreamState.STARTING;

                        /* ask to start a new stream with select area service */
                        this.hue.instances[bridgeid].enableStream(
                            groupid,
                        );
                    }
                }
            );
        }
    }

    /**
     * Check if bridge generated the clientkey needed for
     * entertainment api. If not a message is displayed
     * 
     * @method _checkClientKey
     * @private
     * @param {bridgeid} bridgeid
     * @returns {Boolean} true for yes
     */
    _checkClientKey(bridgeid) {
        if (this.hue.bridges[bridgeid] === undefined ||
            this.hue.bridges[bridgeid]["clientkey"] === undefined) {

            Main.notify(
                _("Hue Lights - ") + this.hue.bridges[bridgeid]["name"],
                _("Please, remove Philips hue bridge and connect it again.")
            );

            Utils.logDebug("Client key not available");

            return false;
        }

        Utils.logDebug("Client key available");

        return true;
    }

    /**
     * Check if bridge has active entertainment stream
     * and if its not started, start the entertainment stream.
     * 
     * @method _checkHueLightsIsStreaming
     * @private
     * @param {bridgeid} bridgeid
     */
    _checkHueLightsIsStreaming(bridgeid) {
        let groupid;
        let signal;

        if (this._isStreaming[bridgeid] === undefined) {
            return;
        }

        if (!this.hue.instances[bridgeid].isConnected()) {
            Utils.logDebug(`Bridge ${bridgeid} disconnected while checking entertainment stream.`);

            this._isStreaming[bridgeid]["state"] = StreamState.STOPPED;

            if (this._isStreaming[bridgeid]["entertainment"] !== undefined) {
                delete(this._isStreaming[bridgeid]["entertainment"]);
            }

            return;
        }

        Utils.logDebug(`Bridge ${bridgeid} checking for entertainment streams: ${JSON.stringify(this._isStreaming)}`);

        switch (this._isStreaming[bridgeid]["state"]) {
            case StreamState.STOPPED:
                break;

            case StreamState.STARTING:
                break;

            case StreamState.STARTED:
                if (!this._checkClientKey(bridgeid)) {
                    this._isStreaming[bridgeid]["state"] = StreamState.STOPPED;
                    return;
                }

                if (this._isStreaming[bridgeid]["entertainment"] !== undefined) {
                    return;
                }

                groupid = this._isStreaming[bridgeid]["groupid"];

                this._isStreaming[bridgeid]["entertainment"] = new HueEntertainment.PhueEntertainment(
                    {
                        ip: this.hue.bridges[bridgeid]["ip"],
                        username: this.hue.bridges[bridgeid]["username"],
                        clientkey: this.hue.bridges[bridgeid]["clientkey"]
                    }
                );

                this._isStreaming[bridgeid]["entertainment"].setIntensity(
                    this._isStreaming[bridgeid]["intensity"]
                );

                this._isStreaming[bridgeid]["entertainment"].setBrightness(
                    this._isStreaming[bridgeid]["brightness"]
                );

                signal = this._isStreaming[bridgeid]["entertainment"].connect("connected", () => {
                    this._startEntertainmentStream(bridgeid, groupid);
                    this._isStreaming[bridgeid]["state"] = StreamState.RUNNING;
                });
                this._appendSignal(signal, this._isStreaming[bridgeid]["entertainment"], true);

                signal = this._isStreaming[bridgeid]["entertainment"].connect("disconnected", () => {
                    this._isStreaming[bridgeid]["state"] = StreamState.STOPPED;
                    delete(this._isStreaming[bridgeid]["entertainment"]);

                    groupid = this._isStreaming[bridgeid]["groupid"];
                    if (this.bridesData[bridgeid]["groups"][groupid] !== undefined &&
                        this.bridesData[bridgeid]["groups"][groupid]["stream"]["active"]) {

                        this.hue.instances[bridgeid].disableStream(groupid);
                    }
                });
                this._appendSignal(signal, this._isStreaming[bridgeid]["entertainment"], true);

                this._isStreaming[bridgeid]["entertainment"].connectBridge();

                break;

            case StreamState.STOPPING:
                if (this._isStreaming[bridgeid]["entertainment"] !== undefined) {
                    this._isStreaming[bridgeid]["entertainment"].closeBridge();
                } else {
                    this._isStreaming[bridgeid]["state"] = StreamState.STOPPED;
                }

                break;

            case StreamState.RUNNING:
                groupid = this._isStreaming[bridgeid]["groupid"];

                if (!this.bridesData[bridgeid]["groups"][groupid]["stream"]["active"]) {
                    /* another app disabled stream */

                    this._isStreaming[bridgeid]["state"] = StreamState.STOPPED;

                    if (this._isStreaming[bridgeid]["entertainment"] !== undefined) {
                        delete(this._isStreaming[bridgeid]["entertainment"]);
                    }
                }

                break;

            case StreamState.FAILED:
                if (this._isStreaming[bridgeid]["entertainment"] !== undefined) {
                    delete(this._isStreaming[bridgeid]["entertainment"]);
                }

                groupid = this._isStreaming[bridgeid]["groupid"];

                if (this.bridesData[bridgeid]["groups"][groupid] !== undefined &&
                    this.bridesData[bridgeid]["groups"][groupid]["stream"]["active"]) {

                    this.hue.instances[bridgeid].disableStream(groupid);
                }

                this._isStreaming[bridgeid]["state"] = StreamState.STOPPED;

                Utils.logDebug(`Bridge ${bridgeid} failed to start entertainment group ${groupid}`);
                break;

            default:
                break;
        }
    }

    /**
     * Sets the color of slider
     * 
     * @method _setSliderColor
     * @private
     * @param {Object} slider
     * @param {Array} array with RGB
     */
    _setSliderColor(object, [r, g, b]) {
        r = ('0' + r.toString(16)).slice(-2);
        g = ('0' + g.toString(16)).slice(-2);
        b = ('0' + b.toString(16)).slice(-2);

        let styleColor = `#${r}${g}${b}`;

        object.style = `-barlevel-active-background-color: ${styleColor}; -barlevel-active-border-color: ${styleColor}`;
    }

    /**
     * Sets the color of switch
     * 
     * @method _setSwitchColor
     * @private
     * @param {Object} switch
     * @param {Array} array with RGB
     */
    _setSwitchColor(object, [r, g, b]) {
        let color = new Clutter.Color({
            red: r,
            green: g,
            blue: b,
            alpha: 255
        });

        object.clear_effects();

        let colorEffect = new Clutter.ColorizeEffect({tint: color});
        object.add_effect(colorEffect);

        let briConEffect = new Clutter.BrightnessContrastEffect();
        briConEffect.set_brightness(0.4);
        briConEffect.set_contrast(0.4);

        object.add_effect(briConEffect);
    }

    /**
     * If change happened, the controls in menu are refreshed.
     * 
     * @method refreshMenu
     */
    refreshMenu() {

        let bridgeid = "";
        let groupid = "";
        let type = "";
        let object = null;
        let parsedBridgePath = [];
        let value;
        let r = 0;
        let g = 0;
        let b = 0;

        Utils.logDebug("Refreshing menu.");

        for (let bridgePath in this.refreshMenuObjects) {

            bridgeid = this.refreshMenuObjects[bridgePath]["bridgeid"];
            object = this.refreshMenuObjects[bridgePath]["object"];
            type = this.refreshMenuObjects[bridgePath]["type"];

            if (this.bridesData[bridgeid].length === 0) {
                continue;
            }

            parsedBridgePath = bridgePath.split("::");

            if (parsedBridgePath[1] === "groups" &&
                parsedBridgePath[2] === "0" &&
                    (this.bridesData[bridgeid]["groups"][0] === undefined ||
                    this.bridesData[bridgeid]["groups"][0].length === 0)) {

                /* group zero is not loaded, skipping for now */
                continue;
            }

            switch (type) {

                case "switch":

                    parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                    value = this.bridesData[bridgeid];
                    for (let i in parsedBridgePath) {
                        if (i == 0) {
                            continue;
                        }

                        if (value === undefined){
                            break;
                        }

                        value = value[parsedBridgePath[i]];
                    }

                    if (object.state !== value) {
                        object.state = value;
                    }

                    if (this._checkEntertainmentStream(bridgeid, parsedBridgePath)) {
                        object.state = true;
                    }

                    break;

                case "brightness":

                    parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                    value = this.bridesData[bridgeid];
                    for (let i in parsedBridgePath) {
                        if (i == 0) {
                            continue;
                        }

                        value = value[parsedBridgePath[i]];
                    }

                    if (parsedBridgePath[1] === "groups") {
                        value = this._getGroupBrightness(bridgeid, parsedBridgePath[2]);
                    }

                    value = value/255;

                    if (!this._checkBrightnessOfLight(bridgeid, parsedBridgePath)) {
                        value = 0;
                    }

                    if (object.value !== value) {
                        object.value = value;
                    }

                    object.visible = true;
                    if (this._checkEntertainmentStream(bridgeid, parsedBridgePath)) {
                        object.visible = false;
                        object.value = 0;
                    }

                    break;

                case "slider-color":
                    parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                    value = this.bridesData[bridgeid];
                    for (let i in parsedBridgePath) {
                        if (i == 0) {
                            continue;
                        }

                        value = value[parsedBridgePath[i]];
                    }

                    if (parsedBridgePath[1] === "lights" &&  !value["on"] ||
                        (parsedBridgePath[1] === "groups" &&
                        this._getGroupBrightness(bridgeid, parsedBridgePath[2]) === 0)) {

                        object.style = null;

                        break;
                    }

                    if (parsedBridgePath[1] === "lights") {
                        [r, g, b] = this._getLightOrGroupColor(bridgeid, null, parsedBridgePath[2]);
                    } else {
                        [r, g, b] = this._getLightOrGroupColor(bridgeid, parsedBridgePath[2], null);
                    }

                    this._setSliderColor(object, [r, g, b]);

                    break;

                case "switch-color":
                    parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                    if (!object.state) {
                        object.clear_effects();
                        break;
                    }

                    value = this.bridesData[bridgeid];
                    for (let i in parsedBridgePath) {
                        if (i == 0) {
                            continue;
                        }

                        value = value[parsedBridgePath[i]];
                    }

                    if (parsedBridgePath[1] === "lights" &&  !value["on"] ||
                        (parsedBridgePath[1] === "groups" &&
                        this._getGroupBrightness(bridgeid, parsedBridgePath[2]) === 0)) {

                        object.clear_effects();

                        break;
                    }

                    if (parsedBridgePath[1] === "lights") {
                        [r, g, b] = this._getLightOrGroupColor(bridgeid, null, parsedBridgePath[2]);
                    } else {
                        [r, g, b] = this._getLightOrGroupColor(bridgeid, parsedBridgePath[2], null);
                    }

                    this._setSwitchColor(object, [r, g, b]);

                    break;

                case "battery":

                    parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                    value = this.bridesData[bridgeid];
                    for (let i in parsedBridgePath) {
                        if (i == 0) {
                            continue;
                        }

                        value = value[parsedBridgePath[i]];
                    }

                    value = `${value}%`;

                    if (object.text !== value) {
                        object.text = value;
                    }

                    break;

                case "temperature":

                    parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                    value = this.bridesData[bridgeid];
                    for (let i in parsedBridgePath) {
                        if (i == 0) {
                            continue;
                        }

                        value = value[parsedBridgePath[i]];
                    }

                    value = value/100;

                    value = `${Math.round(value)}°C/${Math.round(value * 1.8 + 32)}°F`;

                    if (object.text !== value) {
                        object.text = value;
                    }

                    break;

                case "light-level":

                    parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                    value = this.bridesData[bridgeid];
                    for (let i in parsedBridgePath) {
                        if (i == 0) {
                            continue;
                        }

                        value = value[parsedBridgePath[i]];
                    }

                    value = Math.round(Math.pow(10, (value - 1) / 10000));

                    value = `${value} lux`;

                    if (object.text !== value) {
                        object.text = value;
                    }

                    break;

                case "entertainment-label":

                    object.text = _("Entertainment areas");

                    if (this.bridesData[bridgeid]["groups"] === undefined) {
                        break;
                    }

                    for (let groupid in this.bridesData[bridgeid]["groups"]) {
                        if (this.bridesData[bridgeid]["groups"][groupid]["type"] !== "Entertainment") {
                            continue;
                        }

                        if (this.bridesData[bridgeid]["groups"][groupid]["stream"]["active"]) {
                            object.text = `${this.bridesData[bridgeid]["groups"][groupid]["name"]} ` + _("is syncing");
                        }
                    }

                    break;

                case "main-switch-entertainment":

                    object.visible = false;
                    object.state = false;

                    if (this._isStreaming[bridgeid] === undefined) {
                        break;
                    }

                    for (let groupid in this.bridesData[bridgeid]["groups"]) {
                        if (this.bridesData[bridgeid]["groups"][groupid]["type"] !== "Entertainment") {
                            continue;
                        }

                        if (this.bridesData[bridgeid]["groups"][groupid]["stream"]["active"]) {
                            object.visible = true;
                            object.state = true;
                        }
                    }

                    break;

                case "entertainment-mode-label":

                    object.text = _("Entertainment mode");

                    if (this._isStreaming[bridgeid] === undefined) {
                        break;
                    }

                    if (this._isStreaming[bridgeid]["entertainmentMode"] === undefined) {
                        break;
                    }

                    let additionlLabel = "";
                    if (this._isStreaming[bridgeid]["entertainmentMode"] === Utils.entertainmentMode.DISPLAYN) {

                        if (this._isStreaming[bridgeid]["syncGeometry"] === undefined) {
                            break;
                        }

                        let [x, y, w, h] = this._isStreaming[bridgeid]["syncGeometry"];
                        let rect = new Meta.Rectangle({ x, y, width: w, height: h });
                        let monitorN = global.display.get_monitor_index_for_rect(rect);
                        additionlLabel = ` ${monitorN + 1} (${w}x${h})`;
                    }

                    object.text = _("Sync") + ` ${Utils.entertainmentModeText[this._isStreaming[bridgeid]["entertainmentMode"]]}${additionlLabel}`;

                    break;

                case "entertainment-mode-switches":

                    if (this._isStreaming[bridgeid] === undefined) {
                        break;
                    }

                    if (this._isStreaming[bridgeid]["entertainmentMode"] === undefined) {
                        break;
                    }

                    if (this._isStreaming[bridgeid]["entertainmentModeSwitches"] === undefined) {
                        break;
                    }

                    let entertainmentSwitchBoxes = this._isStreaming[bridgeid]["entertainmentModeSwitches"];

                    for (let [service, modeSwitch] of entertainmentSwitchBoxes) {

                        if (service instanceof Array &&
                            service[0] === Utils.entertainmentMode.DISPLAYN) {

                            if (this._isStreaming[bridgeid]["entertainmentMode"] !== Utils.entertainmentMode.DISPLAYN ||
                                this._isStreaming[bridgeid]["syncGeometry"] === undefined) {

                                modeSwitch.state = false;
                                continue;
                            }

                            let [x, y, w, h] = this._isStreaming[bridgeid]["syncGeometry"];
                            let rect = new Meta.Rectangle({ x, y, width: w, height: h });
                            let monitorN = global.display.get_monitor_index_for_rect(rect);

                            if (service[1] !== monitorN) {
                                modeSwitch.state = false;
                            } else {
                                modeSwitch.state = true;
                            }

                        } else if (this._isStreaming[bridgeid]["entertainmentMode"] !== service) {
                            modeSwitch.state = false;
                        } else {
                            modeSwitch.state = true;
                        }
                    }

                    break;

                case "entertainment-default-selection-label":

                    object.text = _("Set shortcut for ") + `${Utils.entertainmentModeText[Utils.entertainmentMode.SELECTION]}`;

                    if (this._syncSelectionDefault !== {}) {
                        bridgeid = this._syncSelectionDefault["bridgeid"];
                        groupid = this._syncSelectionDefault["groupid"];

                        if (this.bridesData[bridgeid] === undefined) {
                            break;
                        }

                        let bridgeName = this.bridesData[bridgeid]["config"]["name"];
                        let groupName = this.bridesData[bridgeid]["groups"][groupid]["name"]
                        object.text = Utils.entertainmentModeText[Utils.entertainmentMode.SELECTION];
                        object.text = object.text + ` ${_("shortcut")}: ${bridgeName}-${groupName}`;
                        object.text = object.text + ` (${this._syncSelectionKeyShortcut})`;
                    }

                    break;

                default:

                    break;
            }
        }
    }

    /**
     * Connect signals from bridge instance.
     * The signals handles async data events.
     * 
     * @method _connectHueInstance
     * @private
     * @param {String} bridgeid
     */
    _connectHueInstance(bridgeid) {

        let signal;

        signal = this.hue.instances[bridgeid].connect(
            "change-occurred",
            () => {
                /* ask for async all data,
                 * which will invoke refreshMenu*/
                this.hue.instances[bridgeid].getAll();
            }
        );
        this._appendSignal(signal, this.hue.instances[bridgeid], true);

        signal = this.hue.instances[bridgeid].connect(
            "all-data",
            () => {
                this.bridesData[bridgeid] = {};

                if (this.hue.instances[bridgeid].isConnected()) {
                    this.bridesData[bridgeid] = this.hue.instances[bridgeid].getAsyncData();
                }

                this._checkRebuildReady(bridgeid);

                if (this.bridgeInProblem[bridgeid] !== undefined &&
                    this.bridgeInProblem[bridgeid]) {
                        Main.notify(
                            _("Hue Lights - ") + this.hue.bridges[bridgeid]["name"],
                            _("Connection to Philips Hue bridge restored")
                        );

                        if ((! this._bridgesInMenuShowed.includes(bridgeid)) &&
                            (! this._bridgesInMenuShowed.includes(this._defaultBridgeInMenu))
                            ) {

                            this.rebuildMenuStart();
                        }
                }
                this.bridgeInProblem[bridgeid] = false;

                if (this._rebuildingMenu === false) {
                    this.refreshMenu();

                    this._checkHueLightsIsStreaming(bridgeid);
                }
            }
        );
        this._appendSignal(signal, this.hue.instances[bridgeid], true);

        signal = this.hue.instances[bridgeid].connect(
            "lights-data",
            () => {
                if (this._waitingNotification[bridgeid] !== undefined &&
                    this._waitingNotification[bridgeid]) {

                    this._waitingNotification[bridgeid] = false;

                    this.oldNotifylight[bridgeid] = {};

                    this.notifyBackupLight(
                        bridgeid,
                        this.hue.instances[bridgeid].getAsyncData()
                    );

                    this.queueNotify(bridgeid);
                }
            }
        );
        this._appendSignal(signal, this.hue.instances[bridgeid], true);

        signal = this.hue.instances[bridgeid].connect(
            "config-data",
            () => {
                let data = this.hue.instances[bridgeid].getAsyncData();
                this.hue.bridges[bridgeid]["name"] = data["name"];
                this.hue.bridges[bridgeid]["mac"] = data["mac"];
            }
        );
        this._appendSignal(signal, this.hue.instances[bridgeid], true);

        signal = this.hue.instances[bridgeid].connect(
            "stream-enabled",
            () => {
                let streamRes = this.hue.instances[bridgeid].getAsyncData();

                if (streamRes[0] !== undefined && streamRes[0]["success"] !== undefined) {
                    /**
                     * TODO After the last update 29/7/2021 an issue occured.
                     * Even if we asynchronously check that the stream is successfully started,
                     * the bridge is not ready to accept the UDP msg yet:(.
                     * I suspect, the bridge will send a push notification when stream is ready,
                     * but the new api with push notifications was not published yet and it is
                     * unknown :-(.
                     * So lets just wait a moment for bridge to be ready.
                     * This is a workaround - the timeout should not be needed.
                     * I will rewrite once they fix the bridge or provide the new api.
                     */
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 700, () => {
                        this._isStreaming[bridgeid]["state"] = StreamState.STARTED;
                        this._checkHueLightsIsStreaming(bridgeid);
                    });
                }
                this.hue.instances[bridgeid].getAll();
            }
        );
        this._appendSignal(signal, this.hue.instances[bridgeid], true);

        signal = this.hue.instances[bridgeid].connect(
            "connection-problem",
            () => {
                this.bridesData[bridgeid] = {};

                this._checkRebuildReady(bridgeid);

                if (this.bridgeInProblem[bridgeid] !== undefined &&
                    this.bridgeInProblem[bridgeid]) {
                    /* already noticed */
                    return;
                    }

                Main.notify(
                    _("Hue Lights - ") + this.hue.bridges[bridgeid]["name"],
                    _("Please check the connection to Philips Hue bridge.")
                );

                this.bridgeInProblem[bridgeid] = true;

                this._checkHueLightsIsStreaming(bridgeid);
            }
        );
        this._appendSignal(signal, this.hue.instances[bridgeid], true);
    }

    /**
     * Check if another app already using
     * the entertainment areas
     *
     * @method _checkAnyEntertainmentActive
     * @private
     * @param {String} bridgeid
     * @return {Boolean} true if already useing
     */
    _checkAnyEntertainmentActive(bridgeid) {
        for (let groupid in this.bridesData[bridgeid]["groups"]) {
            if (this.bridesData[bridgeid]["groups"][groupid]["type"] === "Entertainment" &&
                this.bridesData[bridgeid]["groups"][groupid]["stream"]["active"]) {

                Utils.logDebug(`Another app already streaming group ${groupid} on bridge ${bridgeid}`);

                Main.notify(
                    _("Hue Lights - ") + this.hue.bridges[bridgeid]["name"],
                    _("Another app is already using the entertainment areas.")
                );
                return true;
            }
        }

        return false;
    }

    /**
     * Initialize entertainment stream
     * based on settings. If tehre is a autostart
     * entertainment area, start it.
     *
     * @method entertainmentInit
     * @param {String} bridgeid
     */
    entertainmentInit(bridgeid, tryAutostart = false) {

        Utils.logDebug(`Bridge ${bridgeid} is initializing entertainment.`);

        if (this._isStreaming[bridgeid] !== undefined &&
            this._isStreaming[bridgeid]["entertainmentMode"] !== undefined &&
            this._isStreaming[bridgeid]["entertainmentMode"] === Utils.entertainmentMode.DISPLAYN) {

            delete(this._isStreaming[bridgeid]);
        }

        if (this._isStreaming[bridgeid] === undefined) {
            this._isStreaming[bridgeid] = {};

            this._isStreaming[bridgeid]["state"] = StreamState.STOPPED;

            if (this._entertainment[bridgeid] !== undefined &&
                this._entertainment[bridgeid]["intensity"] !== undefined) {

                this._isStreaming[bridgeid]["intensity"] = this._entertainment[bridgeid]["intensity"];
            } else {
                this._isStreaming[bridgeid]["intensity"] = 150;
            }

            if (this._entertainment[bridgeid] !== undefined &&
                this._entertainment[bridgeid]["bri"] !== undefined) {

                this._isStreaming[bridgeid]["brightness"] = this._entertainment[bridgeid]["bri"];
            } else {
                this._isStreaming[bridgeid]["brightness"] = 255;
            }

            if (this._entertainment[bridgeid] !== undefined &&
                this._entertainment[bridgeid]["mode"] !== undefined) {

                this._isStreaming[bridgeid]["entertainmentMode"] = this._entertainment[bridgeid]["mode"];
            } else {
                this._isStreaming[bridgeid]["entertainmentMode"] = Utils.entertainmentMode.SYNC;
            }
        }

        if (tryAutostart &&
            this._entertainment[bridgeid] !== undefined &&
            this._entertainment[bridgeid]["autostart"] !== undefined &&
            this._entertainment[bridgeid]["autostart"] >= 0) {

            let groupid = this._entertainment[bridgeid]["autostart"];

            Utils.logDebug(`Entertainment init tries to autostart group ${groupid} on bridge ${bridgeid}`);

            if (this.bridesData[bridgeid]["groups"][groupid] === undefined) {
                return;
            }

            if (this.bridesData[bridgeid]["groups"][groupid]["type"] !== "Entertainment") {
                return;
            }

            if (this._checkAnyEntertainmentActive(bridgeid)) {

                Utils.logDebug(`Entertainment init will not autostart group: ${groupid}`);
                return;
            }

            this._isStreaming[bridgeid]["state"] = StreamState.STARTING;

            this._isStreaming[bridgeid]["groupid"] = groupid;

            if (this._entertainment[bridgeid]["mode"] !== undefined) {
                this._isStreaming[bridgeid]["entertainmentMode"] = this._entertainment[bridgeid]["mode"];
            } else {
                this._isStreaming[bridgeid]["entertainmentMode"] = Utils.entertainmentMode.SYNC;
            }

            this.hue.instances[bridgeid].enableStream(
                groupid,
            );
        }
    }

    /**
     * Disable entertainments streams
     * on extension disable.
     * 
     * @method disableStreams
     */
    disableStreams() {

        Utils.logDebug(`Disabling all streams.`);

        for (let bridgeid in this.hue.instances) {

            if (this._isStreaming[bridgeid] === undefined ||
                this._isStreaming[bridgeid]["state"] === StreamState.STOPPED) {

                continue;
            }

            this._isStreaming[bridgeid]["state"] = StreamState.STOPPING;

            if (this._isStreaming[bridgeid]["entertainment"] !== undefined) {

                this._isStreaming[bridgeid]["entertainment"].closeBridge();
                if (this._isStreaming[bridgeid]["groupid"] !== undefined) {
                    this.hue.instances[bridgeid].disableStream(
                        this._isStreaming[bridgeid]["groupid"]
                    );
                }

                delete(this._isStreaming[bridgeid]["entertainment"]);
            }

            this._isStreaming[bridgeid]["state"] = StreamState.STOPPED;
        }
    }

    /**
     * Append signal to the disctonary with signals.
     * 
     * @method _appendSignal
     * @private
     * @param {Number} signal number
     * @param {Object} object signal is connected
     * @param {Boolean} disconnect all signals
     * @param {Boolean} disconnect temporal signals
     */
    _appendSignal(signal, object, rebuild, tmp = false) {
        this._signals[signal] = {
            "object": object,
            "rebuild": rebuild,
            "tmp": tmp
        }
    }

    /**
     * Disconect signals
     * 
     * @method disconnectSignals
     * @param {Boolean} disconnect all
     * @param {Boolean} disconnect only tmp signals and return
     */
    disconnectSignals(all, onlyTmp = false) {
        let toDisconnect = "rebuild";

        if (onlyTmp) {
            toDisconnect = "tmp";
        }

        for (let id in this._signals) {
            if (this._signals[id][toDisconnect] || all) {
                try {
                    this._signals[id]["object"].disconnect(id);
                    delete(this._signals[id]);
                } catch {
                    continue;
                }
            }
        }
    }

    /**
     * Prepare list of bridges shown in the menu.
     * 
     * @method getBridgesInMenu
     * @return {Object} Array of bridges for creating menu.
     */
    getBridgesInMenu(currentBridges) {
        let bridges = [];
        let currentConnected = [];
        let defaultIsConnected = false;
        this._defaultBridgeInMenu = "";

        /**
         * check if any bridge is online,
         * and if default bridge is not online
         * dont change the list
         */
        for (let bridgeid of currentBridges) {
            if (this.hue.instances[bridgeid] === undefined) {
                continue;
            }

            if (this.hue.instances[bridgeid].isConnected()) {
                if (this.hue.bridges[bridgeid]["default"] !== undefined &&
                    this.hue.bridges[bridgeid]["default"] === bridgeid) {
                    defaultIsConnected = true;
                }

                currentConnected.push(bridgeid);
            }
        }

        if (currentConnected.length > 0 && !defaultIsConnected) {
            return currentBridges;
        }

        let defaultExists = false;
        for (let bridgeid in this.hue.bridges) {
            if (this.hue.bridges[bridgeid]["default"] === undefined) {
                continue;
            }

            if (this.hue.bridges[bridgeid]["default"] !== bridgeid) {
                continue;
            }

            if (this.hue.instances[bridgeid] === undefined){
                continue;
            }

            if (!this.hue.instances[bridgeid].isConnected()){
                continue;
            }

            bridges.push(bridgeid);
            defaultExists = true;
            this._defaultBridgeInMenu = bridgeid;
        }

        if (!defaultExists) {
            for (let bridgeid in this.hue.instances) {
                bridges.push(bridgeid);
            }
        }

        return bridges;
    }

    /**
     * Creates Refresh menu item and
     * settings item. Items can be in one item
     * or multipe items.
     * 
     * @method _createSettingItems
     * @private
     * @param {Boolean} true for reduced number of items
     * @return {Object} array of menu items
     */
    _createSettingItems(reduced) {
        let icon;
        let items = [];
        let signal;

        if (!reduced) {
            /**
             * Switch menu
             */
            let swichMenuText;
            if (this._compactMenu) {
                swichMenuText = _("Switch to standard menu");
            }
            if (!this._compactMenu) {
                swichMenuText = _("Switch to compact menu");
            }
            let switchMenuItem = new PopupMenu.PopupMenuItem(
                swichMenuText
            );

            if (this._iconPack !== PhueIconPack.NONE) {
                icon = this._getIconByPath(Me.dir.get_path() + "/media/HueIcons/settingsSoftwareUpdate.svg");

                if (icon !== null){
                    switchMenuItem.insert_child_at_index(icon, 1);
                }
            }

            signal = switchMenuItem.connect(
                'button-press-event',
                () => {
                    this._compactMenu = !this._compactMenu;
                    this.rebuildMenuStart();
                }
            );
            this._appendSignal(signal, switchMenuItem, true);

            items.push(switchMenuItem);
        }

        /**
         * Refresh menu item
         */
        let refreshMenuItem = new PopupMenu.PopupMenuItem(
            _("Refresh menu")
        );

        if (this._iconPack !== PhueIconPack.NONE) {
            icon = this._getGnomeIcon("emblem-synchronizing-symbolic");

            if (icon !== null){
                refreshMenuItem.insert_child_at_index(icon, 1);
            }
        }

        signal = refreshMenuItem.connect(
            'button-press-event',
            () => { this.rebuildMenuStart(); }
        );
        this._appendSignal(signal, refreshMenuItem, true, true);

        items.push(refreshMenuItem);

        /**
         * Settings menu item
         */
        let prefsMenuItem = new PopupMenu.PopupMenuItem(
            _("Settings")
        );

        if (this._iconPack !== PhueIconPack.NONE) {
            icon = this._getIconByPath(Me.dir.get_path() + "/media/HueIcons/tabbarSettings.svg");

            if (icon !== null) {
                prefsMenuItem.insert_child_at_index(icon, 1);
            }
        }

        signal = prefsMenuItem.connect(
            'button-press-event',
            () => {Util.spawn(["gnome-shell-extension-prefs", Me.uuid]);}
        );
        this._appendSignal(signal, prefsMenuItem, true, true);
        items.push(prefsMenuItem);

        return items;
    }

    /**
     * Sets timer to open last opened menu if menu is closed.
     * 
     * @method _handleLastOpenedMenu
     * @private
     * @param {Object} menu
     * @return {Boolean} is the menu opened
     */
    _handleLastOpenedMenu(menu, isOpen) {
        if (isOpen) {
            /* another menu opened instead, ignore timed event*/
            this._lastOpenedMenu["opening"] = null;
        }

        if (!isOpen && this._lastOpenedMenu["last"] !== null) {
            this._lastOpenedMenu["opening"] = this._lastOpenedMenu["last"];

            /**
             * sets timed event to open last closed menu
             * the timer is needed because if I open another menu
             * the first menu closes and without the timer I would open
             * different menu instad
             */
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                if (this._lastOpenedMenu["opening"] !== null) {
                    this._lastOpenedMenu["opening"].open(true);
                    this._lastOpenedMenu["opening"] = null;
                }
            });
        }

        if (!isOpen) {
            this._lastOpenedMenu["last"] = menu;
        }
    }

    /**
     * Invokes rebuilding the menu.
     * 
     * @method rebuildMenuStart
     */
    rebuildMenuStart() {

        Utils.logDebug("Rebuilding menu started.");

        this.disableStreams();
        this.disconnectSignals(false);

        for (let bridgeid in this.colorPicker){
            if (this.colorPicker[bridgeid].destroy) {
                /* destroy modal dialog if exists */
                this.colorPicker[bridgeid].destroy();
            }
            delete(this.colorPicker[bridgeid]);
        }

        let oldItems = this.menu._getMenuItems();
        for (let item in oldItems){
            oldItems[item].destroy();
        }

        for (let settingsItem of this._createSettingItems(true)) {
            this.menu.addMenuItem(settingsItem);
        }

        this._rebuildingMenu = true;
        this._rebuildingMenuRes = {};
        for (let bridgeid in this.hue.bridges) {
            this._rebuildingMenuRes[bridgeid] = false;
        }

        /**
         * In case of not getting any response from some bridge
         * within the time
         * this will build menu for bridges that responded so far
         */
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
            if (this._rebuildingMenu) {
                Utils.logDebug("No response from all bridges. Rebuilding menu anyway.");

                this._rebuildingMenu = false;
                this._rebuildingMenuRes = {};

                this._rebuildMenu(this._rebuildingMenuFirstTime);
            }
        });

        this.hue.checkBridges(false);

        for (let bridgeid in this.hue.bridges) {
            this._connectHueInstance(bridgeid);
            this.hue.checkBridge(bridgeid);
        }
    }

    /**
     * Checks whether there are data form all bridges to build the menu.
     * If all data are here, run rebuild menu.
     * 
     * @method _checkRebuildReady
     * @private
     * @param {String} bridgeid of bridge that provided last data
     * @param {Boolean} is this first time building the menu
     */
    _checkRebuildReady(bridgeid) {

        if (! this._rebuildingMenu) {
            return;
        }

        this._rebuildingMenuRes[bridgeid] = true;


        for (let bridgeid in this._rebuildingMenuRes) {
            if (this._rebuildingMenuRes[bridgeid] === false) {
                return;
            }
        }

        this._rebuildingMenu = false;
        this._rebuildingMenuRes = {};

        this._rebuildMenu(this._rebuildingMenuFirstTime);
    }

    /**
     * Rebuild the menu from scratch
     * 
     * @method _rebuildMenu
     * @private
     * @param {Boolean} is this first time building the menu
     */
    _rebuildMenu(firstTime = false) {

        Utils.logDebug("Rebuilding menu.");

        let bridgeItems = [];
        let instanceCounter = 0;
        this._openMenuDefault = null;
        this.refreshMenuObjects = {};
        this._syncSelectionDefault = {};
        this._bridgesInMenuShowed = [];
        this._lastOpenedMenu = {"last": null, "opening": null};

        this.disconnectSignals(false, true);

        let oldItems = this.menu._getMenuItems();
        for (let item in oldItems){
            oldItems[item].destroy();
        }

        this._bridgesInMenu = this.getBridgesInMenu(this._bridgesInMenu);

        for (let bridgeid of this._bridgesInMenu) {

            if (!this.hue.instances[bridgeid].isConnected()){

                Utils.logDebug(`Bridge ${bridgeid} is not connected.`);
                continue;
            }

            if (this.bridesData[bridgeid] === undefined ||
                Object.keys(this.bridesData[bridgeid]).length === 0) {

                Utils.logDebug(`Bridge ${bridgeid} provides no data.`);
                continue;
            }

            if (instanceCounter > 0) {
                this.menu.addMenuItem(
                    new PopupMenu.PopupSeparatorMenuItem()
                );
            }

            this.entertainmentInit(bridgeid, firstTime);

            if (!this._compactMenu) {
                bridgeItems = this._createMenuBridge(bridgeid);
            }

            if (this._compactMenu) {
                bridgeItems = this._createCompactMenuBridge(bridgeid);
            }

            for (let item in bridgeItems) {
                this.menu.addMenuItem(bridgeItems[item]);
            }

            if (bridgeItems.length > 0) {
                instanceCounter++;
                this._bridgesInMenuShowed.push(bridgeid);
            }
        }

        if (instanceCounter === 0 ) {
            for (let settingsItem of this._createSettingItems(true)) {
                this.menu.addMenuItem(settingsItem);
            }
        }

        Main.wm.removeKeybinding("sync-selection");
        Main.wm.addKeybinding(
            "sync-selection",
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL,
            () => {
                if (Object.keys(this._syncSelectionDefault).length >= 2) {
                    this._syncSelectionShortCut(
                        this._syncSelectionDefault["bridgeid"],
                        this._syncSelectionDefault["groupid"]
                    );
                } else {
                    Main.notify(
                        _("Hue Lights - key shortcut: ") + this._syncSelectionKeyShortcut,
                        _("Set the shortcut for sync ") + Utils.entertainmentModeText[Utils.entertainmentMode.SELECTION]
                    );
                }
            }
        );

        this._rebuildingMenuFirstTime = false;

        this.refreshMenu();
    }

    /**
     * Open modal dialog for entertainment group selection.
     * Once the group is selected, the sync selected area is started.
     * 
     * @method _openSetDefaultSelectionGroup
     * @private
     * @param {String} bridgeid
     */
     _openSetDefaultSelectionGroup(bridgeid) {
        let signal;
        let groups = this.bridesData[bridgeid]["groups"];
        let groupsForSelection = {};

        for (let groupid in groups) {
            if (groups[groupid]["type"] !== "Entertainment") {
                continue;
            }

            groupsForSelection[groupid] = groups[groupid]["name"];
        }

        let groupSelector = new ModalSelector.ModalSelector({
            options: groupsForSelection,
            label: _("Select an entertainment group:")
        });
        groupSelector.show();
        groupSelector.newPosition();

        signal = groupSelector.connect(
            "selected",
            () => {
                this._syncSelectionDefault = {
                    "bridgeid": bridgeid,
                    "groupid": groupSelector.result
                }
            }
        );
        this._appendSignal(signal, groupSelector, true);
    }

    /**
     * Open modal dialog before starting sync selected area.
     * 
     * @method _openSetDefaultSelectionBridge
     * @private
     * @param {Object} dictionary with bridges present in menu
     */
     _openSetDefaultSelectionBridge(bridgesInMenu) {
        let signal;

        /* close the main manu */
        this.menu.close(false);

        if (Object.keys(bridgesInMenu).length === 0) {
            Main.notify(
                _("Hue Lights - key shortcut: ") + this._syncSelectionKeyShortcut,
                _("No bridge connected.")
            );
            return;
        }

        if (Object.keys(bridgesInMenu).length === 1) {
            this._openSetDefaultSelectionGroup(Object.keys(bridgesInMenu)[0]);
            return;
        }

        let bridgeSelector = new ModalSelector.ModalSelector({
            options: bridgesInMenu,
            label: _("Select a bridge:")
        });
        bridgeSelector.show();
        bridgeSelector.newPosition();

        signal = bridgeSelector.connect(
            "selected",
            () => {
                this._openSetDefaultSelectionGroup(bridgeSelector.result);
            }
        );
        this._appendSignal(signal, bridgeSelector, true);
    }

    /**
     * Preparation for opening modal dialog for selecting
     * default Bridge and group for sync selection.
     * 
     * @method setDefaultSelectionGroup
     */
    setDefaultSelectionGroup() {
        let bridgesSyncSelectedArea = {};
        for (let bridgeid of this._bridgesInMenu) {
            if (this.hue.instances[bridgeid].isConnected()){
                bridgesSyncSelectedArea[bridgeid] = this.bridesData[bridgeid]["config"]["name"];
            }
        }
        this._openSetDefaultSelectionBridge(bridgesSyncSelectedArea);
    }

    /**
     * Remove all key binding.
     * 
     * @method disableKeyShortcuts
     */
    disableKeyShortcuts() {
        Main.wm.removeKeybinding("sync-selection");
    }

    /**
     * Check and change indicator position in menu.
     * 
     * @method setPositionInPanel
     * @param {Enum} new position in panel
     */
    setPositionInPanel(position) {

        let children = null;

        if (this._indicatorPositionBackUp === this._indicatorPosition) {
            return;
        }

        this.get_parent().remove_actor(this);

        switch (this._indicatorPosition) {

            case PhueMenuPosition.LEFT:

                children = Main.panel._leftBox.get_children();
                Main.panel._leftBox.insert_child_at_index(
                    this,
                    children.length
                );
                break;

            case PhueMenuPosition.CENTER:

                children = Main.panel._centerBox.get_children();
                Main.panel._centerBox.insert_child_at_index(
                    this,
                    children.length
                    );
                break;

            case PhueMenuPosition.RIGHT:

                children = Main.panel._rightBox.get_children();
                Main.panel._rightBox.insert_child_at_index(this, 0);
                break;

            default:
                children = Main.panel._rightBox.get_children();
                Main.panel._rightBox.insert_child_at_index(this, 0);
        }

        this._indicatorPositionBackUp = this._indicatorPosition;
    }

    /**
     * Backup light settings from requested bridge
     * before running notification
     * 
     * @method notifyGetLight
     * @param {String} reqBridgeid
     * @param {Object} lights data
     */
    notifyBackupLight(reqBridgeid, dataLights) {

        let cmd = {};
        let lightState;

        for (let i in this._notifyLights) {

            let bridgeid = i.split("::")[0];
            let lightid = parseInt(i.split("::")[1]);

            if (bridgeid !== reqBridgeid) {
                continue;
            }

            lightState = dataLights[lightid]["state"];

            cmd = {"transitiontime": 0};

            cmd["on"] = lightState["on"];

            cmd["bri"] = lightState["bri"];

            if (lightState["colormode"] == "ct") {
                cmd["ct"] = lightState["ct"];
            }

            if (lightState["colormode"] == "xy") {
                cmd["xy"] = lightState["xy"];
            }

            this.oldNotifylight[reqBridgeid][i] = cmd;
        }

        Utils.logDebug(`Notify lights of bridge: ${reqBridgeid} backed up: ${JSON.stringify(this.oldNotifylight[reqBridgeid])}`);
    }

    /**
     * Start light notification on a bridge
     * 
     * @method startNotify
     * @param {String} requested bridge
     */
    startNotify(reqBridgeid) {

        Utils.logDebug(`Starting notify lights of bridge ${reqBridgeid}: ${JSON.stringify(this._notifyLights)}`);

        for (let i in this._notifyLights) {

            let bridgeid = i.split("::")[0];
            let lightid = parseInt(i.split("::")[1]);

            if (reqBridgeid !== bridgeid) {
                continue;
            }

            let bri = 255;
            if (this._notifyLights[i]["bri"] !== undefined) {
                bri = this._notifyLights[i]["bri"];
            }

            let r = 255;
            let g = 255;
            let b = 255;
            if (this._notifyLights[i]["r"] !== undefined) {
                r = this._notifyLights[i]["r"];
                g = this._notifyLights[i]["g"];
                b = this._notifyLights[i]["b"];
            }

            let xy = Utils.colorToHueXY(r, g, b);

            this.hue.instances[bridgeid].setLights(
                lightid,
                {"on": true, "bri":bri, "xy":xy, "transitiontime": 0 },
                PhueRequestype.NO_RESPONSE_NEED
            );

        }

    }

    /**
     * End light notification on a bridge
     * 
     * @method endNotify
     * @param {String} requested bridge
     */
    endNotify(reqBridgeid) {

        if (this.oldNotifylight === undefined) {
            return;
        }

        if (this.oldNotifylight[reqBridgeid] === undefined) {
            return;
        }

        Utils.logDebug(`Ending notify lights of bridge ${reqBridgeid}: ${JSON.stringify(this.oldNotifylight[reqBridgeid])}`);

        for (let i in this._notifyLights) {

            let bridgeid = i.split("::")[0];
            let lightid = parseInt(i.split("::")[1]);

            if (reqBridgeid !== bridgeid) {
                continue;
            }

            if (this.oldNotifylight[reqBridgeid][i] === undefined) {
                continue;
            }

            this.hue.instances[bridgeid].setLights(
                lightid,
                this.oldNotifylight[reqBridgeid][i],
                PhueRequestype.NO_RESPONSE_NEED
            );
        }
    }

    /**
     * A notification occurred in the system.
     * Ask to get lights from all bridges.
     * It will invoke queueNotify() for first notification
     * throught the getLights().
     * 
     * @method runNotify
     */
    runNotify() {
        Utils.logDebug("Notification happend in the system.");

        for (let bridgeid in this.hue.instances) {
            if (!this.hue.instances[bridgeid].isConnected()) {
                continue;
            }

            if (this._notificationQueues[bridgeid] === undefined) {
                this._notificationQueues[bridgeid] = new Queue.Queue(Queue.handlerType.TIMED);
            }

            if (this._notificationQueues[bridgeid].getQueueLength() === 0 &&
                ! this._waitingNotification[bridgeid]) {

                this._waitingNotification[bridgeid] = true;
                this.hue.instances[bridgeid].getLights();
            } else {
                this.queueNotify(bridgeid);
            }
        }
    }

    /**
     * Queue notification for a bridge.
     * 
     * @method queueNotify
     * @param {String} bridge
     */
    queueNotify(bridgeid){

        if (this.oldNotifylight[bridgeid] === undefined ||
            Object.keys(this.oldNotifylight[bridgeid]).length === 0) {

            Utils.logDebug(`Back up of notify lights for bridge ${bridgeid} empty. Ignoring notification.`);
            return;
        }

        this._notificationQueues[bridgeid].append([
            () => {
                this.startNotify(bridgeid);
            },
            100
        ]);

        this._notificationQueues[bridgeid].append([
            () => {
                this.endNotify(bridgeid);
            },
            1000
        ]);
    }
});
