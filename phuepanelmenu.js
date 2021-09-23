'use strict';

/**
 * extension panel menu class
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
const Utils = Me.imports.utils;
const GObject = imports.gi.GObject;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;

const Gettext = imports.gettext.domain('hue-lights');
var forceEnglish = ExtensionUtils.getSettings(Utils.HUELIGHTS_SETTINGS_SCHEMA).get_boolean(Utils.HUELIGHTS_SETTINGS_FORCE_ENGLISH);
const _ = forceEnglish ? (a) => { return a; } : Gettext.gettext;

const PhueMenuPosition = {
    CENTER: 0,
    RIGHT: 1,
    LEFT: 2
};

const IconSize = 20;

var PhueIconPack = {
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
var PhuePanelMenu = GObject.registerClass({
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
    _init(params) {

        super._init(0.0, Me.metadata.name, false);

        this._signals = {};
        this._rebuildingMenu = false;
        this.refreshMenuObjects = {};
        this._indicatorPositionBackUp = -1;
        this._mainLabel = {};

        let icon = new St.Icon({
            gicon : Gio.icon_new_for_string(params.iconFile),
            style_class : 'system-status-icon',
        });

        let iconEffect = this._getIconBriConEffect(PhueIconPack.BRIGHT);
        icon.add_effect(iconEffect);

        this.add_child(icon);
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

        /**
         * this._connectionTimeoutSB doesn't need rebuild
         */
         this._connectionTimeoutSB = this._settings.get_int(
            Utils.HUELIGHTS_SETTINGS_CONNECTION_TIMEOUT_SB
        );

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
            () => { ExtensionUtils.openPrefs(); }
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
     * Checks whether there are data form all bridges to build the menu.
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

});