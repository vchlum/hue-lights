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
        this._settings = ExtensionUtils.getSettings(Utils.HUELIGHTS_SETTINGS_SCHEMA);
        this._settings.connect("changed", Lang.bind(this, function() {
            if (this.readSettings()) {
                this.rebuildMenu();
            }
            this.setPositionInPanel();
            this.hue.setConnectionTimeout(this._connectionTimeout);
        }));

        this.hue = new Hue.Phue();

        this.readSettings();
        this.hue.setConnectionTimeout(this._connectionTimeout);
        this._indicatorPositionBackUp = -1;
        this.setPositionInPanel();

        this.colorPicker = null;

        let icon = new St.Icon({
            gicon : Gio.icon_new_for_string(Me.dir.get_path() + '/media/devicesBridgesV2white.svg'),
            style_class : 'system-status-icon',
            });
        this.add_child(icon);

        this.rebuildMenu();

        this.menu.connect("open-state-changed", () => {
            if (this.menu.isOpen) {
                for (let i in this.hue.instances) {
                        this.hue.instances[i].enableAsyncRequest();
                        this.hue.instances[i].getAll();
                }
            }
        });
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

                    if (this.hue.instances[bridgeid].checkError()) {
                        Main.notify(
                            _("Hue Lights - please check the connection"),
                            _("Failed to switch the group")
                        );
                    }
                }

                if (parsedBridgePath[1] == "lights") {
                    this.hue.instances[bridgeid].setLights(
                        parsedBridgePath[2],
                        {"on": value}
                    );
                    
                    if (this.hue.instances[bridgeid].checkError()) {
                        Main.notify(
                            _("Hue Lights - please check the connection"),
                            _("Failed to switch the light")
                        );
                    }
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

                    if (this.hue.instances[bridgeid].checkError()) {
                        Main.notify(
                            _("Hue Lights - please check the connection"),
                            _("Failed to set the brightness of the group")
                        );
                    }
                }

                if (parsedBridgePath[1] == "lights") {

                    this.hue.instances[bridgeid].setLights(
                        parsedBridgePath[2],
                        cmd
                    );

                    if (this.hue.instances[bridgeid].checkError()) {
                        Main.notify(
                            _("Hue Lights - please check the connection"),
                            _("Failed to set the brightness of the light")
                        );
                    }
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

                if (value == 0) {
                    cmd = {"on": false};
                } else {
                    cmd = {"on": true};
                }

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
                    
                    if (this.hue.instances[bridgeid].checkError()) {
                        Main.notify(
                            _("Hue Lights - please check the connection"),
                            _("Failed to set the color of the group")
                        );
                    }
                }

                if (parsedBridgePath[1] == "lights") {

                    this.hue.instances[bridgeid].setLights(
                        parsedBridgePath[2],
                        cmd
                    );

                    if (this.hue.instances[bridgeid].checkError()) {
                        Main.notify(
                            _("Hue Lights - please check the connection"),
                            _("Failed to set the color of the light")
                        );
                    }
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

                if (this.hue.instances[bridgeid].checkError()) {
                    Main.notify(
                        _("Hue Lights - please check the connection"),
                        _("Failed to set the scene")
                    );
                }

                break;

            default:
        }

        /* don't call this.refreshMenu() now... it will by called async */
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
        let slider;
        let bridgePath = "";
        let switchBox;
        let switchButton

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

            slider = new Slider.Slider(0);
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

            light.add(slider);
        }

        /**
         * Add switch for turn the light on/off
         */
        if (groupid !== null) {
            bridgePath = `${this._rndID()}::groups::${groupid}::state::all_on`;
        } else {
            bridgePath = `${this._rndID()}::lights::${lightid}::state::on`;
        }

        switchBox = new PopupMenu.Switch(false);
        switchButton = new St.Button(
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

        light.add(switchButton);

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

        data = this.hue.instances[bridgeid].getAll();

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

        for (bridgeid in this.hue.instances) {
            if (!this.hue.instances[bridgeid].isConnected()) {
                continue;
            }

            let tmpdata = this.hue.instances[bridgeid].getAll();
            if (this.hue.instances[bridgeid].checkError()) {
                Main.notify(
                    _("Hue Lights - please check the connection"),
                    _("Failed to connect to the bridge")
                );
                return;
            }

            this.bridesData[bridgeid] = tmpdata;
        }

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

                    if (object.value !== value) {
                        object.value = value;
                    }
                    break;

                default:
            }
        }
    }

    /**
     * Rebuild the menu from scratch
     * 
     * @method rebuildMenu
     */
    rebuildMenu() {

        let bridgeItems = [];
        let oldItems = this.menu._getMenuItems();

        this.refreshMenuObjects = {};

        this.bridesData = this.hue.checkBridges();

        for (let item in oldItems){
            oldItems[item].destroy();
        }

        for (let bridgeid in this.hue.instances) {

            if (!this.hue.instances[bridgeid].isConnected()){
                continue;
            }

            this.hue.instances[bridgeid].disconnectAll;
            this.hue.instances[bridgeid].connect(
                'data-ready',
                () => {
                    this.refreshMenu();
                }
            );

            bridgeItems = this._createMenuBridge(bridgeid);

            for (let item in bridgeItems) {
                this.menu.addMenuItem(bridgeItems[item]);
            }

            this.menu.addMenuItem(
                new PopupMenu.PopupSeparatorMenuItem()
            );
        }

        let refreshMenuItem = new PopupMenu.PopupMenuItem(
            _("Refresh menu")
        );
        refreshMenuItem.connect(
            'button-press-event',
            () => { this.rebuildMenu(); }
        );
        this.menu.addMenuItem(refreshMenuItem);

        let prefsMenuItem = new PopupMenu.PopupMenuItem(
            _("Settings")
        );
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
     * Backup light settings before running notification
     * 
     * @method notifyGetLight
     * @param {Number} bridgeid 
     * @param {NUmber} lightid 
     * @return {Object} command for light recovery
     */
    notifyBackupLight(bridgeid, lightid) {

        let cmd = {"transitiontime": 1};

        if (!this.hue.instances[bridgeid].isConnected()) {
            return undefined;
        }

        let light = this.hue.instances[bridgeid].getLights();

        if (!this.hue.instances[bridgeid].isConnected()) {
            return undefined;
        }

        light = light[lightid]["state"];

        cmd["on"] = light["on"];

        cmd["bri"] = light["bri"];

        if (light["colormode"] == "ct") {
            cmd["ct"] = light["ct"];
        }

        if (light["colormode"] == "xy") {
            cmd["xy"] = light["xy"];
        }

        return cmd;
    }

    /**
     * Restore lights after running notification
     * 
     * @method notifySetLight
     * @param {Number} bridgeid 
     * @param {Number} lightid 
     * @param {Object} cmd for light recovery
     */
    notifyRestoreLight(bridgeid, lightid, cmd) {

        if (!this.hue.instances[bridgeid].isConnected()) {
            return;
        }
 
        this.hue.instances[bridgeid].setLights(
            lightid,
            cmd
        );
    }


    /**
     * Start light notification
     * 
     * @method startNotify
     */
    startNotify() {

        return new Promise(resolve => {
            this.oldNotifylight = {};

            for (let i in this._notifyLights) {

                let bridgeid = i.split("::")[0];
                let lightid = parseInt(i.split("::")[1]);

                if (!this.hue.instances[bridgeid].isConnected()) {
                    continue;
                }

                this.oldNotifylight[i] = this.notifyBackupLight(bridgeid, lightid);

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
                    {"on": true, "bri":bri, "xy":xy, "transitiontime": 1 }
                );

            }

            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                this.endNotify();
                return GLib.SOURCE_REMOVE;
            });
            resolve();
        })
    }


    /**
     * End light notification
     * 
     * @method endNotify
     */
    endNotify() {

        if (this.oldNotifylight === undefined) {
            return;
        }

        for (let i in this._notifyLights) {

            let bridgeid = i.split("::")[0];
            let lightid = parseInt(i.split("::")[1]);

            if (this.oldNotifylight[i] !== undefined) {
                this.notifyRestoreLight(bridgeid, lightid, this.oldNotifylight[i]);
            }
        }

        this.oldNotifylight = undefined;
    }


    async runNotify() {
        await this.startNotify();
    }
});
