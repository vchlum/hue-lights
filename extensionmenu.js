'use strict';

/**
 * extension hue-lights menu
 * JavaScript Gnome extension for Philips Hue bridges - Menu creator.
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

const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Hue = Me.imports.phue;
const PhueRequestype = Me.imports.phueapi.PhueRequestype;
const Utils = Me.imports.utils;
const ColorPicker = Me.imports.colorpicker;
const Util = imports.misc.util;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Slider = imports.ui.slider;
const GLib = imports.gi.GLib;

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

        this.refreshMenuObjects = {};
        this.oldNotifylight = {};
        this.bridgeInProblem = {}

        this._settings = ExtensionUtils.getSettings(Utils.HUELIGHTS_SETTINGS_SCHEMA);
        this._settings.connect("changed", Lang.bind(this, function() {
            if (this.readSettings()) {
                this.rebuildMenu();
            }
            this.setPositionInPanel();
            this.hue.setConnectionTimeout(this._connectionTimeout);
        }));

        this.hue = new Hue.Phue(true);

        this.readSettings();
        this.hue.setConnectionTimeout(this._connectionTimeout);
        this._indicatorPositionBackUp = -1;
        this.setPositionInPanel();

        this.colorPicker = null;

        let icon = new St.Icon({
            gicon : Gio.icon_new_for_string(Me.dir.get_path() + '/media/HueIcons/devicesBridgesV2.svg'),
            style_class : 'system-status-icon',
        });

        let iconEffect = this._getIconEffect(PhueIconPack.BRIGHT);
        icon.add_effect(iconEffect);

        this.add_child(icon);

        this.rebuildMenu();

        this.menu.connect("open-state-changed", () => {
            if (this.menu.isOpen) {
                for (let i in this.hue.instances) {
                        /* this will invoke this.refreshMenu via "all-data" */
                        this.hue.instances[i].getAll();
                }
            }
        });
    }

    /**
     * Returns effect that can be applied on icon
     * 
     * @method _getIconEffect
     * @param {Enum} requested icon effect
     * @return {Object} effect
     */
    _getIconEffect(reqEffect) {

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

        return menuNeedsRebuild;
    }

    /**
     * Generate almoust useless ID number
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
            return;
        }

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

                break;

            case "brightness-colorpicker":

                data["object"] = this.colorPicker.brightness;
                object = data["object"];
                /* no break here "brightness" continues */

            case "brightness":

                parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                value = Math.round(object.value * 254);
                if (value == 0) {
                    cmd = {"on": false, "bri": value};
                } else {
                    cmd = {"on": true, "bri": value};
                }

                if (parsedBridgePath[1] == "groups") {

                    this.hue.instances[bridgeid].actionGroup(
                        parseInt(parsedBridgePath[2]),
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

            case "color-picker":

                if (this.colorPicker !== null) {
                    this.colorPicker.destroy();
                }
                this.colorPicker = new ColorPicker.ColorPicker();
                this.colorPicker.show();
                this.colorPicker.connect("finish", () => {
                    this.colorPicker = null;
                });

                let dataColor = Object.assign({}, data);
                dataColor["type"] = "set-color";
                this.colorPicker.connect(
                    "color-picked",
                    this._menuEventHandler.bind(this, dataColor)
                );

                let dataBrightness = Object.assign({}, data);
                dataBrightness["type"] = "brightness-colorpicker";
                this.colorPicker.connect(
                    "brightness-picked",
                    this._menuEventHandler.bind(this, dataBrightness)
                );
                this.colorPicker.newPosition();

                break;

            case "set-color":

                parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                value = Utils.colorToHueXY(
                    this.colorPicker.r,
                    this.colorPicker.g,
                    this.colorPicker.b
                );
                colorTemperature = this.colorPicker.colorTemperature;

                cmd = {"on": true};

                if (colorTemperature > 0 &&
                    this.colorPicker.switchWhite.state) {

                    cmd["ct"] = Utils.kelvinToCt(colorTemperature);
                } else {
                    cmd["xy"] = value;
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
        }

        /* don't call this.refreshMenu() now... it will by called async */
    }

    /**
     * Creates slider for controlling the brightness
     * 
     * @method _createBrightnessSlider
     * @param {String} bridgeid
     * @param {Number} lightid
     * @param {Number} groupid
     * @return {Object} Brightness slider
     */
    _createBrightnessSlider(bridgeid, lightid, groupid) {

        let bridgePath = "";

        let slider = new Slider.Slider(0);
        slider.set_width(200);
        slider.set_x_align(Clutter.ActorAlign.END);
        slider.set_x_expand(false);
        slider.value = 100/254;

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
            "type": "brightness"
        }

        return slider;
    }

    /**
     * Creates switch button for torning the light on/off
     * 
     * @method _createLightSwitch
     * @param {String} bridgeid
     * @param {Number} lightid
     * @param {Number} groupid
     * @return {Object} switch button
     */
    _createLightSwitch(bridgeid, lightid, groupid) {

        let bridgePath = "";

        if (groupid !== null) {
            bridgePath = `${this._rndID()}::groups::${groupid}::state::all_on`;
        } else {
            bridgePath = `${this._rndID()}::lights::${lightid}::state::on`;
        }

        let switchBox = new PopupMenu.Switch(false);
        let switchButton = new St.Button(
            {reactive: true, can_focus: true}
        );
        switchButton.set_x_align(Clutter.ActorAlign.END);
        switchButton.set_x_expand(false);
        switchButton.child = switchBox;
        switchButton.connect(
            "button-press-event",
            Lang.bind(this, function() {
                switchBox.toggle();
            })
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
            "type": "switch"
        }

        return switchButton;
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
    _createItemLight(bridgeid, data, lightid, groupid) {

        let light;
        let bridgePath = "";

        /**
         * Decide if this is item for one light or a group.
         */
        if (groupid !== null) {
            light = new PopupMenu.PopupMenuItem(
                _("All")
            );
        } else {
            light = new PopupMenu.PopupMenuItem(
                data["lights"][lightid]["name"]
            );
        }

        light.set_x_align(Clutter.ActorAlign.FILL);
        light.label.set_x_expand(true);

        /**
         * Open color picker on mouse click
         */
        if (groupid !== null) {
            bridgePath = `${this._rndID()}::groups::${groupid}::action::hue`;
        } else {
            bridgePath = `${this._rndID()}::lights::${lightid}::state::hue`;
        }

        light.connect(
            'button-press-event',
            this._menuEventHandler.bind(
                this,
                {
                    "bridgePath": bridgePath,
                    "bridgeid": bridgeid,
                    "object":light, "type":
                    "color-picker"
                }
            )
        );

        /**
         * If brightness is possible, add a slider
         */
        if ((groupid === null &&
                data["lights"][lightid]["state"]["bri"] !== undefined) ||
            (groupid !== null &&
                data["groups"][groupid]["action"]["bri"] !== undefined)) {

            light.add(this._createBrightnessSlider(bridgeid, lightid, groupid));
        }

        /**
         * Add switch for turning the light on/off
         */
        light.add(this._createLightSwitch(bridgeid, lightid, groupid));

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

                scene.x_align = Clutter.ActorAlign.CENTER;
                scene.x_expand = true;
                scene.label.set_x_expand(false);

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
     * @return {Object} array of menuitem with light controls
     */
    _createMenuLights(bridgeid, data, lights, groupid) {

        let lightsItems = [];
        let light;

        if (lights.length === 0) {
            return [];
        }

        light = this._createItemLight(
            bridgeid,
            data,
            lights,
            groupid
        );
        lightsItems.push(light);

        for (let lightid in lights) {
            light = this._createItemLight(
                bridgeid,
                data,
                parseInt(lights[lightid]),
                null
            );
            lightsItems.push(light);
        }

        if (this._showScenes) {
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
     * @param {String} bridgeid 
     * @param {String} groupid 
     * @return {Object} switch button
     */
    _createGroupSwitch(bridgeid, groupid) {
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
            Lang.bind(this, function() {
                switchBox.toggle();
            })
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
            "type": "switch"
        }

        return switchButton;
    }

    /**
     * Read icon from FS and return icon.
     * 
     * @method _getIconByPath
     * @param {String} path to icon
     * @return {Object} icon or null if not found
     */
    _getIconByPath(iconPath) {

        let icon = null;

        try {

            icon = new St.Icon({
                gicon : Gio.icon_new_for_string(iconPath),
                style_class : 'system-status-icon',
            });

            icon.set_size(IconSize, IconSize);

            let iconEffect = this._getIconEffect(this._iconPack);
            icon.add_effect(iconEffect);

        }
        catch(err) {
            return null;
        }

        return icon;
    }

    /**
     * Tries to determine icon for group from class
     * 
     * @method _tryGetGroupIcon
     * @param {Object} group data
     * @return {Object} icon or null
     */
    _tryGetGroupIcon(groupData) {

        let iconPath = "";

        if (this._iconPack === PhueIconPack.NONE) {
            return null;
        }


        if (groupData["class"] === undefined) {
            return null;
        }

        if (Utils.getHueIconFile[groupData["class"]] === undefined) {
            return null;
        }

        iconPath = Me.dir.get_path() + `/media/HueIcons/${Utils.getHueIconFile[groupData["class"]]}.svg`

        return this._getIconByPath(iconPath);
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

        let groupItem;
        let menuItems = [];
        let groupIcon = null;

        if (data["groups"] === undefined) {
            return [];
        }

        for (let groupid in data["groups"]) {
            if (data["groups"][groupid]["type"] !== groupType) {
                continue;
            }

            groupItem = new PopupMenu.PopupSubMenuMenuItem(
                data["groups"][groupid]["name"]
            );

            groupIcon = this._tryGetGroupIcon(data["groups"][groupid]);
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

        items.push(new PopupMenu.PopupMenuItem(
            data["config"]["name"],
            {
                hover: false,
                reactive: false,
                can_focus: false
            }
        ));

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
     * 
     * @param {bridgeid} bridgeid
     * @param {Object} parsedBridgePath
     */
    _checkLightOfBrightness(bridgeid, p) {

        if (p[1] == "lights") {
            let light = this.bridesData[bridgeid]["lights"][p[2]];
            return light["state"]["on"];
        }

        if (p[1] == "groups") {
            let group = this.bridesData[bridgeid]["groups"][p[2]];
            return group["state"]["all_on"];
        }

        return true;
    }

    /**
     * If change happened, the controls in menu are refreshed.
     * 
     * @method refreshMenu
     */
    refreshMenu() {

        let bridgeid = "";
        let type = "";
        let object = null;
        let parsedBridgePath = [];
        let value;

        for (let bridgePath in this.refreshMenuObjects) {

            bridgeid = this.refreshMenuObjects[bridgePath]["bridgeid"];
            object = this.refreshMenuObjects[bridgePath]["object"];
            type = this.refreshMenuObjects[bridgePath]["type"];

            if (this.bridesData[bridgeid].length === 0) {
                continue;
            }

            parsedBridgePath = bridgePath.split("::");

            switch (type) {

                case "switch":

                    parsedBridgePath[2] = parseInt(parsedBridgePath[2]);

                    value = this.bridesData[bridgeid];
                    for (let i in parsedBridgePath) {
                        if (i == 0) {
                            continue;
                        }

                        value = value[parsedBridgePath[i]];
                    }

                    if (object.state !== value) {
                        object.state = value;
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

                    value = value/255;

                    if (!this._checkLightOfBrightness(bridgeid, parsedBridgePath)) {
                        value = 0;
                    }

                    if (object.value !== value) {
                        object.value = value;
                    }
                    break;

                default:
            }
        }
    }

    /**
     * Connect signals from bridge instance.
     * The signals handles async data events.
     * 
     * @method _connectHueInstance
     * @param {String} bridgeid
     */
    _connectHueInstance(bridgeid) {

        this.hue.instances[bridgeid].connect(
            "change-occurred",
            () => {
                /* ask for async all data,
                 * which will invoke refreshMenu*/
                this.hue.instances[bridgeid].getAll();
            }
        );

        this.hue.instances[bridgeid].connect(
            "all-data",
            () => {
                if (this.hue.instances[bridgeid].isConnected()) {
                    this.bridesData[bridgeid] = this.hue.instances[bridgeid].getAsyncData();
                }

                if (this.bridgeInProblem[bridgeid] !== undefined &&
                    this.bridgeInProblem[bridgeid]) {
                        Main.notify(
                            _("Hue Lights - ") + this.hue.bridges[bridgeid]["name"],
                            _("Connection to Philips Hue bridge restored")
                        );
                }
                this.bridgeInProblem[bridgeid] = false;

                this.refreshMenu();
            }
        );

        this.hue.instances[bridgeid].connect(
            "lights-data",
            () => {
                this.checkNotifications(
                    bridgeid,
                    this.hue.instances[bridgeid].getAsyncData()
                );
            }
        );

        this.hue.instances[bridgeid].connect(
            "connection-problem",
            () => {
                if (this.bridgeInProblem[bridgeid] !== undefined &&
                    this.bridgeInProblem[bridgeid]) {
                    /* already noticed */
                    return;
                    }

                Main.notify(
                    _("Hue Lights - ") + this.hue.bridges[bridgeid]["name"],
                    _("Please check the connection to Philips Hue bridge ")
                );

                this.bridgeInProblem[bridgeid] = true;
            }
        );
    }

    /**
     * Rebuild the menu from scratch
     * 
     * @method rebuildMenu
     */
    rebuildMenu() {

        let bridgeItems = [];
        let oldItems = this.menu._getMenuItems();
        let icon;
        let iconEffect;

        this.refreshMenuObjects = {};

        this.hue.disableAsyncMode();
        this.bridesData = this.hue.checkBridges();
        this.hue.enableAsyncMode();

        for (let item in oldItems){
            oldItems[item].destroy();
        }

        for (let bridgeid in this.hue.instances) {

            if (!this.hue.instances[bridgeid].isConnected()){
                continue;
            }

            this.hue.instances[bridgeid].disconnectAll;

            this._connectHueInstance(bridgeid);

            bridgeItems = this._createMenuBridge(bridgeid);

            for (let item in bridgeItems) {
                this.menu.addMenuItem(bridgeItems[item]);
            }

            this.menu.addMenuItem(
                new PopupMenu.PopupSeparatorMenuItem()
            );
        }

        /**
         * Refresh menu item
         */
        let refreshMenuItem = new PopupMenu.PopupMenuItem(
            _("Refresh menu")
        );

        if (this._iconPack !== PhueIconPack.NONE) {
            icon = this._getIconByPath(Me.dir.get_path() + "/media/HueIcons/settingsSoftwareUpdate.svg");

            refreshMenuItem.insert_child_at_index(icon, 1);
        }

        refreshMenuItem.connect(
            'button-press-event',
            () => { this.rebuildMenu(); }
        );
        this.menu.addMenuItem(refreshMenuItem);

        /**
         * Settings menu item
         */
        let prefsMenuItem = new PopupMenu.PopupMenuItem(
            _("Settings")
        );

        if (this._iconPack !== PhueIconPack.NONE) {
            icon = this._getIconByPath(Me.dir.get_path() + "/media/HueIcons/tabbarSettings.svg");

            prefsMenuItem.insert_child_at_index(icon, 1);
        }

        prefsMenuItem.connect(
            'button-press-event',
            () => {Util.spawn(["gnome-shell-extension-prefs", Me.uuid]);}
        );
        this.menu.addMenuItem(prefsMenuItem);

        this.refreshMenu();
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

            this.oldNotifylight[i] = cmd;
        }
    }

    /**
     * Start light notification on a bridge
     * 
     * @method startNotify
     * @param {String} requested bridge
     */
    startNotify(reqBirdgeid) {

        return new Promise(resolve => {

            for (let i in this._notifyLights) {

                let bridgeid = i.split("::")[0];
                let lightid = parseInt(i.split("::")[1]);

                if (reqBirdgeid !== bridgeid) {
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

            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                this.endNotify(reqBirdgeid);
                return GLib.SOURCE_REMOVE;
            });
            resolve();
        })
    }


    /**
     * End light notification on a bridge
     * 
     * @method endNotify
     * @param {String} requested bridge
     */
    endNotify(reqBirdgeid) {

        let lightOn = false;

        if (this.oldNotifylight === undefined) {
            return;
        }

        for (let i in this._notifyLights) {

            let bridgeid = i.split("::")[0];
            let lightid = parseInt(i.split("::")[1]);

            if (reqBirdgeid !== bridgeid) {
                continue;
            }

            if (this.oldNotifylight[i] === undefined ||
                this.oldNotifylight[i]["on"] === undefined) {
                continue;
            }

            /* see the note below */
            lightOn = this.oldNotifylight[i]["on"];
            delete this.oldNotifylight[i]["on"];

            this.hue.instances[bridgeid].setLights(
                lightid,
                this.oldNotifylight[i],
                PhueRequestype.NO_RESPONSE_NEED
            );

            if (lightOn) {
                continue;
            }

            /* if light should be turned off after notification,
             * it needs to be done separately. Otherwise,
             * the light status is not preserved correctly
             */
            this.hue.instances[bridgeid].setLights(
                lightid,
                {"on": false, "transitiontime": 0},
                PhueRequestype.NO_RESPONSE_NEED
            );
        }
    }

    /**
     * Check if notification should run on bridge
     * 
     * @method checkNotifications
     * @param {String} bridge
     * @param {Object} lights data
     */
    async checkNotifications(birdgeid, dataLights) {

        if (this._waitingNotification) {

            this.notifyBackupLight(birdgeid, dataLights);
            await this.startNotify(birdgeid);

            this._waitingNotification = false;
        }
    }

    /**
     * A notification occurred in the system.
     * Ask to get lights from all bridges.
     * It will invoke checkNotifications() for all bridges
     * 
     * @method runNotify
     */
    runNotify() {

        this._waitingNotification = true;

        for (let i in this.hue.instances) {
            if (!this.hue.instances[i].isConnected()) {
                continue;
            }

            this.hue.instances[i].getLights();
        }
    }
});
