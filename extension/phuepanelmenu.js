'use strict';

/**
 * extension panel menu class
 * JavaScript Gnome extension for Philips Hue bridges - Menu creator.
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

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Utils from './utils.js';
import {Extension, gettext} from 'resource:///org/gnome/shell/extensions/extension.js';

const ShellVersion = parseFloat(Config.PACKAGE_VERSION);

const __ = gettext;

const PhueMenuPosition = {
    CENTER: 0,
    RIGHT: 1,
    LEFT: 2
};

const IconSize = 20;

export const PhueIconPack = {
    NONE: 0,
    BRIGHT: 1,
    DARK: 2
};

/**
 * PhueSyncBoxMenu class. Provides widget with menu items.
 * 
 * @class PhueSyncBoxMenu
 * @constructor
 * @return {Object} menu widget instance
 */
export const PhuePanelMenu = GObject.registerClass({
    GTypeName: 'PhuePanelMenu',
    Properties: {
        "iconFile": GObject.ParamSpec.string("iconFile", "iconFile", "iconFile", GObject.ParamFlags.READWRITE, null),
    },
}, class PhuePanelMenu extends PanelMenu.Button {

    /**
     * PhuePanelMenu class initialization
     *  
     * @method _init
     * @private
     */
    _init(metadata, mainDir, settings, openPref, params) {

        super._init(0.0, metadata.name, false);

        this._ = Utils.checkGettextEnglish(__, settings);

        this._timers = [];
        this._signals = {};
        this._rebuildingMenu = false;
        this.refreshMenuObjects = {};
        this._indicatorPositionBackUp = -1;
        this._mainLabel = {};
        this.deviceShouldBeAvailable = {};
        this._mainDir = mainDir;
        this._openPref = openPref;
        this._scrollDelay = 500;

        let box = new St.BoxLayout({style_class: 'panel-status-menu-box'});

        let icon = new St.Icon({
            gicon : Gio.icon_new_for_string(params.iconFile),
            style_class : 'system-status-icon',
        });

        this.style = `-natural-hpadding: 6px; -minimum-hpadding: 6px;`;

        let iconEffect = this._getIconBriConEffect(PhueIconPack.BRIGHT);
        icon.add_effect(iconEffect);

        this._icon = icon;
        box.add_child(icon);
        this.add_child(box);
    }

    /**
     * Connects signals with change of displays
     * to rebuild menu and detect new displays or change display scale.
     * 
     * @method _setScreenChangeDetection
     * @private
     */
     _setScreenChangeDetection(screenChangeFunction = this.rebuildMenuStart) {

        let signal;

        signal = Main.layoutManager.connect(
            "monitors-changed",
            () => {
                screenChangeFunction();
            }
        );
        this._appendSignal(signal, Main.layoutManager, false);
    }

    set iconFile(value) {
        this._iconFile = value;
    }

    get iconFile() {
        return this._iconFile;
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

                if (ShellVersion >= 47) {
                    color = new Cogl.Color();
                    color.red = 237;
                    color.green = 237;
                    color.blue = 237;
                    color.alpha = 255;
                } else {
                    color = new Clutter.Color({
                        red: 237,
                        green: 237,
                        blue: 237,
                        alpha: 255
                    });
                }
                break;

            case PhueIconPack.DARK:

                if (ShellVersion >= 47) {
                    color = new Cogl.Color();
                    color.red = 40;
                    color.green = 40;
                    color.blue = 40;
                    color.alpha = 255;
                } else {
                    color = new Clutter.Color({
                        red: 40,
                        green: 40,
                        blue: 40,
                        alpha: 255
                    });
                }
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
     * Get gnome icon by name.
     * 
     * @method _getGnomeIcon
     * @private
     * @param {String} path to icon
     * @return {Object} icon or null if not found
     */
    _getGnomeIcon(iconName) {

        let icon = null;
        let themeContext = St.ThemeContext.get_for_stage(global.stage);

        try {

            icon = new St.Icon({
                gicon : Gio.ThemedIcon.new(iconName),
                style_class : 'system-status-icon',
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER
            });

            icon.set_size(IconSize * themeContext.scaleFactor * 0.8, IconSize * themeContext.scaleFactor * 0.8);

            let iconEffect = this._getIconColorEffect(this._iconPack);
            icon.add_effect(iconEffect);

            iconEffect = this._getIconBriConEffect(this._iconPack);
            icon.add_effect(iconEffect);

        } catch(e) {
            Utils.logError(`Failed to get gnome icon: ${iconName}`);
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
        let themeContext = St.ThemeContext.get_for_stage(global.stage);

        try {

            icon = new St.Icon({
                gicon : Gio.icon_new_for_string(iconPath),
                style_class : 'system-status-icon',
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER
            });

            icon.set_size(IconSize * themeContext.scaleFactor, IconSize * themeContext.scaleFactor);

            let iconEffect = this._getIconBriConEffect(this._iconPack);
            icon.add_effect(iconEffect);

        } catch(e) {
            Utils.logError(`Failed to get icon: ${iconPath}`);
            return null;
        }

        return icon;
    }

    /**
     * Generate almost useless ID number
     * 
     * @method _rndID
     * @private
     * @return {Number} randomly generated number
     */
    _rndID() {

        /* items in this.refreshMenuObjects may occure more then ones,
         * this way it is possible - otherwise, the ID is useless
         */
        return Math.round((Math.random()*1000000));
    }

    /**
     * Check and change indicator position in menu.
     * 
     * @method setPositionInPanel
     */
    setPositionInPanel() {

        let children = null;

        if (! this.container.get_parent()) {
            /* not in the status area yet */
            return;
        }

        if (this._indicatorPositionBackUp === this._indicatorPosition) {
            return;
        }

        this.container.get_parent().remove_child(this.container);

        switch (this._indicatorPosition) {

            case PhueMenuPosition.LEFT:

                children = Main.panel._leftBox.get_children();
                Main.panel._leftBox.insert_child_at_index(
                    this.container,
                    children.length
                );
                break;

            case PhueMenuPosition.CENTER:

                children = Main.panel._centerBox.get_children();
                Main.panel._centerBox.insert_child_at_index(
                    this.container,
                    children.length
                    );
                break;

            case PhueMenuPosition.RIGHT:

                children = Main.panel._rightBox.get_children();
                Main.panel._rightBox.insert_child_at_index(
                    this.container,
                    0
                    );
                break;

            default:
                children = Main.panel._rightBox.get_children();
                Main.panel._rightBox.insert_child_at_index(
                    this.container,
                    0
                    );
        }

        this._indicatorPositionBackUp = this._indicatorPosition;
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
         * debug doesn't need rebuild
         */
        Utils.setDebug(this._settings.get_boolean(
            Utils.HUELIGHTS_SETTINGS_DEBUG
        ));

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

        /**
         * this._connectionTimeoutSB doesn't need rebuild
         */
         this._connectionTimeoutSB = this._settings.get_int(
            Utils.HUELIGHTS_SETTINGS_CONNECTION_TIMEOUT_SB
        );

        /**
         * this._associatedConnection needs rebuild
         */
        tmpVal = JSON.stringify(this._associatedConnection);

        this._associatedConnection = this._settings.get_value(
            Utils.HUELIGHTS_SETTINGS_ASSOCIATED_CONNECTION
        ).deep_unpack();

        if (tmpVal !== JSON.stringify(this._associatedConnection)) {
            menuNeedsRebuild = true;
        }

        return menuNeedsRebuild;
    }

    /**
     * Append signal to the dictionary with signals.
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
     * Creates timer for delayed function e.g.: slider scroll handle.
     * Runs only one in specified time.
     * 
     * @method _timeHandleSliderScrollEvent
     * @private
     * @param {Number} delay
     * @param {Object} delayed function
     */
    _runOnlyOnceInTime(delay, fnc) {
        if (this._runOnlyOnceInProgress) {
            return;
        }
        this._runOnlyOnceInProgress = true;

        /**
         * e.g. the slider value is being modified back by the device status while moving the slider,
         * so we can not do imminent change while scrolling. It would jump up and down.
         * This timer will ensure it runs only once in time to prevent the jumping.
         */
        let timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {

            fnc();

            this._runOnlyOnceInProgress = false;
            this._timers = Utils.removeFromArray(this._timers, timerId);
        });
        this._timers.push(timerId);
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
     * Creates refresh and settings items for the menu.
     * 
     * @method _createDefaultSettingsItems
     * @private
     * @param {Object} function called on refresh
     * @returns {Array} array of menu items
     */
    _createDefaultSettingsItems(rebuildFunction = this.rebuildMenuStart) {
        let items = [];
        let icon;
        let signal;

        /**
         * Refresh menu item
         */
         let refreshMenuItem = new PopupMenu.PopupMenuItem(
            this._("Refresh menu")
        );

        if (this._iconPack !== PhueIconPack.NONE) {
            icon = this._getGnomeIcon("emblem-synchronizing-symbolic");

            if (icon !== null){
                refreshMenuItem.insert_child_at_index(icon, 1);
            }
        }

        signal = refreshMenuItem.connect(
            'activate',
            () => {
                rebuildFunction();
            }
        );
        this._appendSignal(signal, refreshMenuItem, true, true);

        items.push(refreshMenuItem);

        /**
         * Settings menu item
         */
        let prefsMenuItem = new PopupMenu.PopupMenuItem(
            this._("Settings")
        );

        if (this._iconPack !== PhueIconPack.NONE) {
            icon = this._getIconByPath(this._mainDir.get_path() + "/media/HueIcons/tabbarSettings.svg");

            if (icon !== null) {
                prefsMenuItem.insert_child_at_index(icon, 1);
            }
        }

        signal = prefsMenuItem.connect(
            'activate',
            () => { this._openPref(); }
        );
        this._appendSignal(signal, prefsMenuItem, true, true);
        items.push(prefsMenuItem);

        return items;
    }

    /**
     * Invokes rebuilding the menu.
     * 
     * @method rebuildMenuStart
     */
    rebuildMenuStart() {
        this._rebuildingMenu = true;
        this._rebuildingMenuRes = {};
        this._mainLabel = {};

        this.disconnectSignals(false);

        let oldItems = this.menu._getMenuItems();
        for (let item in oldItems){
            oldItems[item].destroy();
        }
    }

    /**
     * Checks whether there are data from all bridges to build the menu.
     * If all data are here, run rebuild menu.
     * 
     * @method _checkRebuildReady
     * @private
     * @param {String} bridgeid of bridge that provided last data
     * @param {Boolean} is this first time building the menu
     * @param {Object} rebuild function.
     */
    _checkRebuildReady(id, rebuildFunction = this._rebuildMenu) {

        if (! this._rebuildingMenu) {
            return;
        }

        this._rebuildingMenuRes[id] = true;


        for (let id in this._rebuildingMenuRes) {
            if (this._rebuildingMenuRes[id] === false) {
                return;
            }
        }

        this._rebuildingMenu = false;
        this._rebuildingMenuRes = {};

        rebuildFunction();
    }

    /**
     * Prepares menu for rebuilding
     * 
     * @method _rebuildMenu
     * @private
     */
    _rebuildMenu() {

        this.refreshMenuObjects = {};

        this.disconnectSignals(false, true);

        let oldItems = this.menu._getMenuItems();
        for (let item in oldItems){
            oldItems[item].destroy();
        }
    }

    /**
     * Gets current connections that are active
     * 
     * @method checkActiveConnections
     * @returns {Object} array of active conections
     */
    checkActiveConnections() {

        let id = [];

        if (this._networkClient === undefined) {
            return id;
        }

        if (! this._networkClient.networking_enabled) {
            return id;
        }

        let activeConnections = this._networkClient.get_active_connections();

        for (let connection of activeConnections) {
            if (! Utils.allowedConnectionTypes.includes(connection.get_connection_type())) {
                continue;
            }

            id.push(connection.get_id());
        }

        return id;
    }

    /**
     * Checks and sets the visibility of panel menu.
     * 
     * @method checkAvailability
     * @param {Object} dictianary with devices (like bridges or sync boxes)
     * @param {Boolean} whether to show icon without devices
     * @returns {Object} array of active conections
     */
    checkAvailability(devices, showWithoutDevices) {

        let visibility = false;

        if (Object.keys(devices).length === 0) {
            if (showWithoutDevices) {
                visibility = true;
            } else {
                visibility = false;
            }

            this.visible = visibility;

            return;
        }

        let connections = this.checkActiveConnections();

        /* if no connection is available but some device is known already, hide everyting */
        if (connections.length === 0 &&
            Object.keys(this._associatedConnection).length > 0) {

            this.visible = false;
            for (let id in devices) {
                this.deviceShouldBeAvailable[id] = false;
            }

            return;
        }

        for (let id in devices) {

            this.deviceShouldBeAvailable[id] = false;

            /* if no associated connection, always true */
            if (Object.keys(this._associatedConnection).length === 0) {
                this.deviceShouldBeAvailable[id] = true;
                continue;
            }

            /* if device is not associated with any network, show */
            if (this._associatedConnection[id] === undefined ||
                this._associatedConnection[id]["connections"].length === 0) {

                this.deviceShouldBeAvailable[id] = true;
            }

            /* if  I use known connection, show */
            if (this._associatedConnection[id] !== undefined) {
                for (let known of this._associatedConnection[id]["connections"]) {
                    if (connections.includes(known)) {
                        this.deviceShouldBeAvailable[id] = true;
                    }
                }
            }
        }

        /* if any device should be connected, show icon */
        for (let id in this.deviceShouldBeAvailable) {
            if (this.deviceShouldBeAvailable[id]) {
                visibility = true;
            }
        }

        this.visible = visibility;
    }
});
