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

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const GObject = imports.gi.GObject;
const PhuePanelMenu = Me.imports.phuepanelmenu;
const HueSyncBox = Me.imports.phuesyncbox;
const Utils = Me.imports.utils;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const Main = imports.ui.main;
const Slider = imports.ui.slider;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext.domain('hue-lights');
var forceEnglish = ExtensionUtils.getSettings(
    Utils.HUELIGHTS_SETTINGS_SCHEMA
).get_boolean(Utils.HUELIGHTS_SETTINGS_FORCE_ENGLISH);
const _ = forceEnglish ? (a) => { return a; } : Gettext.gettext;

var syncModes = {
    "game": _("Game"),
    "video": _("Video"),
    "music": _("Music"),
}

var syncIntensity = {
    "subtle": _("Subtle"),
    "moderate": _("Moderate"),
    "high": _("High"),
    "intense": _("Intense")
}

/**
 * PhueSyncBoxMenu class. Provides widget with menu items.
 * 
 * @class PhueSyncBoxMenu
 * @constructor
 * @return {Object} menu widget instance
 */
var PhueSyncBoxMenu = GObject.registerClass({
    GTypeName: 'PhueSyncBoxMenu'
}, class PhueSyncBoxMenu extends PhuePanelMenu.PhuePanelMenu {

    /**S
     * PhueMenu class initialization
     *  
     * @method _init
     * @private
     */
    _init() {

        super._init({iconFile: Me.dir.get_path() + '/media/syncbox.svg'});

        let signal;
        this.syncBoxInProblem = {};
        this.syncBoxesData = {};
        this._client = undefined;

        this._settings = ExtensionUtils.getSettings(Utils.HUELIGHTS_SETTINGS_SCHEMA);
        signal = this._settings.connect("changed", () => {
            if (this.readSettings()) {
                this.rebuildMenuStart();
            }
        });
        this._appendSignal(signal, this._settings, false);

        this.syncBox = new HueSyncBox.PhueSyncBox({async: true});

        this.readSettings();

        signal = this.menu.connect("open-state-changed", () => {
            if (this.menu.isOpen) {
                for (let i in this.syncBox.instances) {
                        /* this will invoke this.refreshMenu via "device-state" */
                        this.syncBox.instances[i].getDeviceState();
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
                    Main.layoutManager.disconnect(this._startingUpSignal);
                    this._startingUpSignal = undefined;

                    this._client = Main.panel.statusArea.aggregateMenu._network._client;
                    this._client.connect('notify::active-connections', () => {
                        this.rebuildMenuStart();
                    });

                    this.rebuildMenuStart();
                }
            );
        } else {
            this._client = Main.panel.statusArea.aggregateMenu._network._client;
            this._client.connect('notify::active-connections', () => {
                this.rebuildMenuStart();
            });

            this.rebuildMenuStart();
        }
    }

    /**
     * Reads settings into class variables.
     * 
     * @method readSettings
     */
    readSettings() {

        let tmpVal;
        let menuNeedsRebuild = super.readSettings();

        /**
         * this.syncBox.syncboxes needs rebuild
         */
        tmpVal = JSON.stringify(this.syncBox.syncboxes);

        this.syncBox.syncboxes = this._settings.get_value(
            Utils.HUELIGHTS_SETTINGS_SYNCBOXES
        ).deep_unpack();

        if (tmpVal !== JSON.stringify(this.syncBox.syncboxes)) {
            menuNeedsRebuild = true;
        }

        this.syncBox.setConnectionTimeout(this._connectionTimeoutSB);

        /* setPositionInPanel will set visible to true, lets make backup */
        let tmpVisible = this.visible;
        this.setPositionInPanel();
        this.visible = tmpVisible;

        return menuNeedsRebuild;
    }

    /**
     * Handles events generated by menu items.
     * 
     * @method _menuEventHandler
     * @private
     * @param {Object} dictionary with instruction what to do
     */
    _menuEventHandler(data) {

        let id = data["id"];
        let type = data["type"];
        let object = data["object"];
        let syncBoxPath = data["syncBoxPath"];
        let parsedSyncBoxPath = [];
        let value;
        let reqData = {};

        Utils.logDebug(`Menu sync box event handler type: ${type}, ${id}, ${syncBoxPath}`);

        parsedSyncBoxPath = syncBoxPath.split("::");

        switch (type) {
            case "main-switch":
                value = object.state;

                if (value) {
                    reqData = {"mode": "passthrough"};
                } else {
                    reqData = {"mode": "powersave"};
                }

                this.syncBox.instances[id].setExecution(reqData);
                break;

            case "set-input":
                value = data["input"];

                if (this.syncBoxesData[id]["hdmi"][value]["status"] === "unplugged") {
                    Main.notify(
                        "Hue Lights - " + this.syncBoxesData[id]["hdmi"][value]["name"],
                        _("Device unplugged.")
                    );
                } else {
                    this.syncBox.instances[id].setHDMISource(value);
                }
                break;

            case "syncActive-switch":
                value = object.state;
                reqData = {"syncActive": value};
                this.syncBox.instances[id].setExecution(reqData);
                break;

            case "set-mode":
                value = data["mode"];
                reqData = {"mode": value};
                this.syncBox.instances[id].setExecution(reqData);
                break;

            case "brightness":
                value = Math.round(object.value * 200);
                reqData = {"brightness": value};
                this.syncBox.instances[id].setExecution(reqData);
                break;

            case "intensity":
                value = data["intensity"];
                reqData = {"intensity": value};
                this.syncBox.instances[id].setExecution(reqData);
                break;

            case "set-area":
                value = data["area"];
                reqData = {"hueTarget": value};
                this.syncBox.instances[id].setExecution(reqData);
                break;

            default:
                break;
        }
    }

    /**
     * Creates main sync box switch
     * 
     * @method _createMainSwitch
     * @private
     * @param {String} id of the sync box
     * @param {Object} data from the syncbox
     */
    _createMainSwitch(id, data) {

        let syncBoxPath = `${this._rndID()}::execution::mode`;

        let switchBox = new PopupMenu.Switch(false);
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
                    "syncBoxPath": syncBoxPath,
                    "id": id,
                    "object": switchBox,
                    "type": "main-switch"
                }
            )
        );

        this.refreshMenuObjects[syncBoxPath] = {
            "id": id,
            "object": switchBox,
            "type": "main-switch",
            "tmpTier": 0
        }

        if (data["execution"] !== undefined &&
            data["execution"]["mode"] !== "powersave") {
            switchBox.state = false;
        } else {
            switchBox.state = true;
        }

        return switchButton;
    }

    /**
     * Creates main sync box menu
     * 
     * @method _createSubMenuSyncBox
     * @private
     * @param {String} id of the sync box
     * @param {Object} data from the syncbox
     */
    _createSubMenuSyncBox(id, data) {

        let submenu = new PopupMenu.PopupSubMenuMenuItem(
            data["device"]["name"]
        );

        this._mainLabel[id] = submenu.label;

        let icon = null;
        if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
            icon = this._getIconByPath(Me.dir.get_path() + `/media/syncbox.svg`);
        }
        if (icon !== null) {
            submenu.insert_child_at_index(icon, 1);
        }


        submenu.insert_child_at_index(
            this._createMainSwitch(id, data),
            submenu.get_children().length - 1
        );

        let settingsItems =this._createDefaultSettingsItems(
            this.rebuildMenuStart.bind(this)
        );
        for (let settingsItem of settingsItems) {
            submenu.menu.addMenuItem(settingsItem);
        }

        return submenu;
    }

    /**
     * Creates HDMI sync box menu for input selection
     * 
     * @method _createMenuHDMI
     * @private
     * @param {String} id of the sync box
     * @param {Object} data from the syncbox
     */
    _createMenuHDMI(id, data) {

        let hdmi = new PopupMenu.PopupSubMenuMenuItem(
            _("Select an HDMI input:")
        );

        /* disable closing menu on item activated */
        hdmi.menu.itemActivated = (animate) => {};

        let syncBoxPath = `${this._rndID()}::execution::hdmiSource`;
        this.refreshMenuObjects[syncBoxPath] = {
            "id": id,
            "object": hdmi.label,
            "type": "hdmi-label",
            "tmpTier": 0
        }

        let icon = null;
        if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
            icon = this._getIconByPath(Me.dir.get_path() + '/media/hdmi.svg');
        }
        if (icon !== null) {
            hdmi.insert_child_at_index(icon,1);
        }

        for (let input in data["hdmi"]) {
            if (! input.startsWith("input")) {
                continue;
            }
            let item = new PopupMenu.PopupMenuItem(
                data["hdmi"][input]["name"]
            )

            item.x_align = Clutter.ActorAlign.FILL;
            item.x_expand = true;
            item.label.set_x_expand(true);

            icon = null;
            if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
                icon = this._getIconByPath(Me.dir.get_path() + '/media/hdmi.svg');
            }
            if (icon !== null) {
                item.insert_child_at_index(icon,1);
            }

            syncBoxPath = `${this._rndID()}::execution::hdmi::${input}`;

            item.connect(
                "button-press-event",
                this._menuEventHandler.bind(
                    this,
                    {
                        "syncBoxPath": syncBoxPath,
                        "id": id,
                        "object": item,
                        "type": "set-input",
                        "input": input
                    }
                )
            );

            hdmi.menu.addMenuItem(item);
        }

        return hdmi;
    }

    /**
     * Creates switch for enabling/disabling the stream
     * 
     * @method _createSyncActiveSwitch
     * @private
     * @param {String} id of the sync box
     * @param {Object} data from the syncbox
     */
    _createSyncActiveSwitch(id, data) {

        let syncBoxPath = `${this._rndID()}::execution::syncActive`;

        let switchBox = new PopupMenu.Switch(false);
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
                    "syncBoxPath": syncBoxPath,
                    "id": id,
                    "object": switchBox,
                    "type": "syncActive-switch"
                }
            )
        );

        this.refreshMenuObjects[syncBoxPath] = {
            "id": id,
            "object": switchBox,
            "type": "syncActive-switch",
            "tmpTier": 0
        }

        if (data["execution"] !== undefined) {
            switchBox.state = data["execution"]["syncActive"];
        }

        return switchButton;
    }

    /**
     * Creates menu for selecting sync mode.
     * 
     * @method _createMenuSyncMode
     * @private
     * @param {String} id of the sync box
     * @param {Object} data from the syncbox
     */
    _createMenuSyncMode(id, data) {

        let icon;
        let mode = new PopupMenu.PopupSubMenuMenuItem(
            _("Select a sync mode:")
        );

        /* disable closing menu on item activated */
        mode.menu.itemActivated = (animate) => {};

        let syncBoxPath = `${this._rndID()}::lastSyncMode`;
        this.refreshMenuObjects[syncBoxPath] = {
            "id": id,
            "object": mode,
            "type": "selected-mode",
            "icon": null,
            "tmpTier": 0
        }

        mode.insert_child_at_index(
            this._createSyncActiveSwitch(id, data),
            mode.get_children().length - 1
        );

        for (let m in syncModes) {

            let item = new PopupMenu.PopupMenuItem(
                _(syncModes[m])
            )

            item.x_align = Clutter.ActorAlign.FILL;
            item.x_expand = true;
            item.label.set_x_expand(true);

            icon = null;
            switch(m) {
                case "game":
                    if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
                        icon = this._getIconByPath(
                            Me.dir.get_path() + `/media/HueIcons/roomsMancave.svg`
                        );
                    }
                    break;

                case "video":
                    if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
                        icon = this._getIconByPath(
                            Me.dir.get_path() + `/media/HueIcons/otherWatchingMovie.svg`
                        );
                    }
                    break;

                case "music":
                    if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
                        icon = this._getIconByPath(
                            Me.dir.get_path() + `/media/HueIcons/otherMusic.svg`
                        );
                    }
                    break;

                default:
                    break;
            }

            if (icon !== null) {
                item.insert_child_at_index(icon, 1);
            }

            syncBoxPath = `${this._rndID()}::execution::mode`;

            item.connect(
                "button-press-event",
                this._menuEventHandler.bind(
                    this,
                    {
                        "syncBoxPath": syncBoxPath,
                        "id": id,
                        "object": item,
                        "type": "set-mode",
                        "mode": m
                    }
                )
            );

            mode.menu.addMenuItem(item);
        }

        return mode;
    }

    /**
     * Creates menu item with brightness slider.
     * 
     * @method _createBrightness
     * @private
     * @param {String} id of the sync box
     * @param {Object} data from the syncbox
     */
    _createBrightness(id, data) {

        let icon = null;
        let syncBoxPath = `${this._rndID()}`;

        let item = new PopupMenu.PopupMenuItem(
            _("Brightness") + ":"
        );

        item.set_x_align(Clutter.ActorAlign.FILL);
        item.label.set_x_expand(true);

        if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
            icon = this._getGnomeIcon("display-brightness-symbolic");
        }
        if (icon !== null){
            item.insert_child_at_index(icon, 1);
        }

        let slider = new Slider.Slider(0);

        slider.set_width(200);
        slider.set_x_align(Clutter.ActorAlign.END);
        slider.set_x_expand(false);
        slider.value = data["execution"]["brightness"];

        item.add(slider);

        slider.connect(
            "drag-end",
            this._menuEventHandler.bind(
                this,
                {
                    "syncBoxPath": syncBoxPath,
                    "id": id,
                    "object":slider,
                    "type": "brightness"
                }
            )
        );

        this.refreshMenuObjects[syncBoxPath] = {
            "id": id,
            "object": slider,
            "type": "brightness",
            "tmpTier": 0
        }

        return item;
    }

    /**
     * Creates menu for selecting sync intensity.
     * 
     * @method _createIntensity
     * @private
     * @param {String} id of the sync box
     */
    _createIntensity(id) {

        let icon;
        let intensity = new PopupMenu.PopupSubMenuMenuItem(
            _("Intensity") + ":"
        );

        /* disable closing menu on item activated */
        intensity.menu.itemActivated = (animate) => {};

        let syncBoxPath = `${this._rndID()}::intensity`;
        this.refreshMenuObjects[syncBoxPath] = {
            "id": id,
            "object": intensity,
            "type": "selected-intensity",
            "icon": null,
            "tmpTier": 0
        }

        for (let i in syncIntensity) {

            let item = new PopupMenu.PopupMenuItem(
                _(syncIntensity[i])
            )

            item.x_align = Clutter.ActorAlign.FILL;
            item.x_expand = true;
            item.label.set_x_expand(true);

            icon = null;
            if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
                icon = this._getIconByPath(Me.dir.get_path() + `/media/intensity-${i}.svg`);
            }

            if (icon !== null) {
                item.insert_child_at_index(icon, 1);
            }

            syncBoxPath = `${this._rndID()}::intensity`;

            item.connect(
                "button-press-event",
                this._menuEventHandler.bind(
                    this,
                    {
                        "syncBoxPath": syncBoxPath,
                        "id": id,
                        "object": item,
                        "type": "intensity",
                        "intensity": i
                    }
                )
            );

            intensity.menu.addMenuItem(item);
        }

        return intensity;
    }

    /**
     * Creates menu item for selecting entertainment group.
     * 
     * @method _createMenuEntertainment
     * @private
     * @param {String} id of the sync box
     * @param {Object} data from the syncbox
     */
    _createMenuEntertainment(id, data) {

        let entertainment = new PopupMenu.PopupSubMenuMenuItem(
            _("Select an entertainment area:")
        );

        /* disable closing menu on item activated */
        entertainment.menu.itemActivated = (animate) => {};

        let syncBoxPath = `${this._rndID()}::execution::hueTarget`;
        this.refreshMenuObjects[syncBoxPath] = {
            "id": id,
            "object": entertainment.label,
            "type": "entertainment-label",
            "tmpTier": 0
        }

        let icon = null;
        if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
            icon = this._getIconByPath(Me.dir.get_path() + '/media/HueIcons/roomsMancave.svg');
        }
        if (icon !== null) {
            entertainment.insert_child_at_index(icon,1);
        }

        for (let area in data["hue"]["groups"]) {

            let item = new PopupMenu.PopupMenuItem(
                data["hue"]["groups"][area]["name"]
            )

            item.x_align = Clutter.ActorAlign.FILL;
            item.x_expand = true;
            item.label.set_x_expand(true);

            syncBoxPath = `${this._rndID()}::hue::groups::${area}::name`;

            item.connect(
                "button-press-event",
                this._menuEventHandler.bind(
                    this,
                    {
                        "syncBoxPath": syncBoxPath,
                        "id": id,
                        "object": item,
                        "type": "set-area",
                        "area": area
                    }
                )
            );

            entertainment.menu.addMenuItem(item);
        }

        return entertainment;
    }

    /**
     * Creates items for the main panel menu.
     * 
     * @method _createMenuSyncBox
     * @private
     * @param {String} id of the sync box
     */
    _createMenuSyncBox(id) {

        let item;
        let items = [];

        let data = this.syncBoxesData[id];

        item = this._createSubMenuSyncBox(id, data);
        items.push(item);

        item = this._createMenuSyncMode(id, data);
        items.push(item);

        item = this._createIntensity(id);
        items.push(item);

        item = this._createBrightness(id, data);
        items.push(item);

        item = this._createMenuHDMI(id, data);
        items.push(item);

        item = this._createMenuEntertainment(id, data);
        items.push(item);

        return items;
    }

    /**
     * Connect signals from syncbox instance.
     * The signals handles async data events.
     * 
     * @method _connectSyncBoxInstance
     * @private
     * @param {String} syncbox id
     */
    _connectSyncBoxInstance(id) {

        let signal;

        signal = this.syncBox.instances[id].connect(
            "change-occurred",
            () => {
                /* ask for async all data,
                 * which will invoke refreshMenu*/
                this.syncBox.instances[id].getDeviceState();
            }
        );
        this._appendSignal(signal, this.syncBox.instances[id], true);

        signal = this.syncBox.instances[id].connect(
            "device-state",
            () => {
                if (this.syncBox.instances[id].isConnected()) {
                    this.syncBoxesData[id] = this.syncBox.instances[id].getAsyncData();
                }

                this._checkRebuildReady(id, this._rebuildMenu.bind(this));

                if (this.syncBoxInProblem[id] !== undefined &&
                    this.syncBoxInProblem[id]) {

                    this.rebuildMenuStart();
                    this._refreshSyncBoxMainLabel(id);
                }
                this.syncBoxInProblem[id] = false;

                if (this._rebuildingMenu === false) {
                    this.refreshMenu();
                }
            }
        );
        this._appendSignal(signal, this.syncBox.instances[id], true);

        signal = this.syncBox.instances[id].connect(
            "connection-problem",
            () => {
                this.syncBoxesData[id] = {};

                this._checkRebuildReady(id, this._rebuildMenu.bind(this));

                if (this.syncBoxInProblem[id] !== undefined &&
                    this.syncBoxInProblem[id]) {
                    /* already noticed */
                    return;
                }

                this.syncBoxInProblem[id] = true;

                this._refreshSyncBoxMainLabel(id);
            }
        );
        this._appendSignal(signal, this.syncBox.instances[id], true);
    }

    /**
     * Refresh sync box name in menu.
     * 
     * @method _refreshSyncBoxMainLabel
     * @private
     * @param {String} syncbox id
     */
    _refreshSyncBoxMainLabel(id) {

        let value;

        if (this._mainLabel[id] === undefined) {
            return;
        }

        value = this.syncBox.syncboxes[id]["name"];
        if (! this.syncBox.instances[id].isConnected()) {
            value = value + " - " + _("disconnected");
        }

        this._mainLabel[id].text = value;
    }

    /**
     * If change happened, the controls in menu are refreshed.
     * 
     * @method refreshMenu
     */
    refreshMenu() {

        let id;
        let icon;
        let object = null;
        let value;
        let type = "";
        let parsedSyncBoxPath = [];

        Utils.logDebug("Refreshing sync box menu.");

        for (let syncBoxPath in this.refreshMenuObjects) {

            id = this.refreshMenuObjects[syncBoxPath]["id"];
            object = this.refreshMenuObjects[syncBoxPath]["object"];
            type = this.refreshMenuObjects[syncBoxPath]["type"];

            if (Object.keys(this.syncBoxesData[id]).length === 0) {

                continue;
            }

            parsedSyncBoxPath = syncBoxPath.split("::");

            switch (type) {

                case "main-switch":
                    value = this.syncBoxesData[id];
                    for (let i in parsedSyncBoxPath) {
                        if (i == 0) {
                            continue;
                        }

                        if (value === undefined){
                            break;
                        }

                        value = value[parsedSyncBoxPath[i]];
                    }

                    if (value.length > 0 && value === "powersave") {
                        object.state = false;
                    } else {
                        object.state = true;
                    }

                    break;

                case "hdmi-label":
                    value = this.syncBoxesData[id]["execution"]["hdmiSource"];
                    object.text = this.syncBoxesData[id]["hdmi"][value]["name"];
                    break;

                case "syncActive-switch":
                    value = this.syncBoxesData[id]["execution"]["syncActive"];
                    object.state = value;
                    break;

                case "selected-mode":
                    value = this.syncBoxesData[id]["execution"]["hdmiSource"];
                    value = this.syncBoxesData[id]["hdmi"][value]["lastSyncMode"];

                    if (_(syncModes[value]) !== undefined) {
                        object.label.text = _(syncModes[value])
                    }

                    if (this.refreshMenuObjects[syncBoxPath]["icon"] !== null) {
                        object.remove_child(this.refreshMenuObjects[syncBoxPath]["icon"]);
                    }

                    this.refreshMenuObjects[syncBoxPath]["icon"] = null;

                    icon = null;
                    switch(value) {
                        case "game":
                            if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
                                icon = this._getIconByPath(Me.dir.get_path() + `/media/HueIcons/roomsMancave.svg`);
                            }
                            break;

                        case "video":
                            if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
                                icon = this._getIconByPath(Me.dir.get_path() + `/media/HueIcons/otherWatchingMovie.svg`);
                            }
                            break;

                        case "music":
                            if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
                                icon = this._getIconByPath(Me.dir.get_path() + `/media/HueIcons/otherMusic.svg`);
                            }
                            break;

                        default:
                            break;
                    }

                    if (icon !== null) {
                        object.insert_child_at_index(icon, 1);
                        this.refreshMenuObjects[syncBoxPath]["icon"] = icon;
                    }

                    break;

                case "brightness":
                    object.value = this.syncBoxesData[id]["execution"]["brightness"] / 200;
                    break;

                case "selected-intensity":
                    value = this.syncBoxesData[id]["execution"]["hdmiSource"];
                    value = this.syncBoxesData[id]["hdmi"][value]["lastSyncMode"];
                    value =  this.syncBoxesData[id]["execution"][value]["intensity"]
                    if (_(syncIntensity[value]) !== undefined) {
                        object.label.text = _("Intensity") + ": " + _(syncIntensity[value])
                    }

                    if (this.refreshMenuObjects[syncBoxPath]["icon"] !== null) {
                        object.remove_child(this.refreshMenuObjects[syncBoxPath]["icon"]);
                    }

                    this.refreshMenuObjects[syncBoxPath]["icon"] = null;

                    if (this._iconPack !== PhuePanelMenu.PhueIconPack.NONE) {
                        icon = this._getIconByPath(Me.dir.get_path() + `/media/intensity-${value}.svg`);
                    }
                    if (icon !== null) {
                        object.insert_child_at_index(icon, 1);
                        this.refreshMenuObjects[syncBoxPath]["icon"] = icon;
                    }

                    break;

                case "entertainment-label":
                    value = this.syncBoxesData[id]["execution"]["hueTarget"];
                    value = this.syncBoxesData[id]["hue"]["groups"][value]["name"];
                    object.text = value;
                    break;

                default:
                    break;
            }
        }
    }

    /**
     * Invokes rebuilding the menu.
     * 
     * @method rebuildMenuStart
     */
    rebuildMenuStart() {

        super.rebuildMenuStart();

        Utils.logDebug("Rebuilding sync box menu started.");

        this.checkAvailability(this.syncBox.syncboxes, false);

        let settingsItems = this._createDefaultSettingsItems(
            this.rebuildMenuStart.bind(this)
        );
        for (let settingsItem of settingsItems) {
            this.menu.addMenuItem(settingsItem);
        }

        for (let id in this.syncBox.syncboxes) {
            this._rebuildingMenuRes[id] = false;
        }

        /**
         * In case of not getting any response from some bridge
         * within the time
         * this will build menu for bridges that responded so far
         */
        let timeout = (this._connectionTimeoutSB + 1) * 1000;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, () => {
            if (this._rebuildingMenu) {
                Utils.logDebug("Not all sync boxes responded. Rebuilding menu anyway.");

                this._rebuildingMenu = false;
                this._rebuildingMenuRes = {};

                this._rebuildMenu();
            }
        });

        this.syncBox.checkSyncBoxes(false);

        for (let id in this.syncBox.syncboxes) {
            this._connectSyncBoxInstance(id);
            this.syncBox.checkSyncBox(id);
        }
    }

    /**
     * Rebuild the menu from scratch
     * 
     * @method rebuildMenu
     */
     _rebuildMenu() {

        super._rebuildMenu();

        let instanceCounter = 0;

        this.checkAvailability(this.syncBox.syncboxes, false);

        if (Object.keys(this.syncBox.syncboxes).length === 0) {
            Utils.logDebug("No sync box present.");
            return;

        }

        Utils.logDebug("Rebuilding sync box menu.");

        for (let id in this.syncBoxesData) {
            if (!this.syncBox.instances[id].isConnected()){

                Utils.logDebug(`HDMI sync box ${id} is not connected.`);
                continue;
            }

            if (this.syncBoxesData[id] === undefined ||
                Object.keys(this.syncBoxesData[id]).length === 0) {

                Utils.logDebug(`HDMI sync box ${id} provides no data.`);
                continue;
            }

            if (this._associatedConnection[id] !== undefined &&
                this._associatedConnection[id]["connections"].length > 0 &&
                ! this.deviceShouldBeAvailable[id]) {

                Utils.logDebug(`Sync box ${id} is available but it prefers another network.`);
                continue;
            }

            if (instanceCounter > 0) {
                this.menu.addMenuItem(
                    new PopupMenu.PopupSeparatorMenuItem()
                );
            }

            let syncBoxItems = this._createMenuSyncBox(id);

            for (let item in syncBoxItems) {
                this.menu.addMenuItem(syncBoxItems[item]);
            }

            if (syncBoxItems.length > 0) {
                instanceCounter++;
            }
        }

        if (instanceCounter === 0) {
            let settingsItems = this._createDefaultSettingsItems(
                this.rebuildMenuStart.bind(this)
            );
            for (let settingsItem of settingsItems) {
                this.menu.addMenuItem(settingsItem);
            }
        } else {
            /* if any device is available, show the icon */
            this.visible = true;
        }

        this.refreshMenu();
    }
});