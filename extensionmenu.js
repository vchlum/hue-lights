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

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Hue = Me.imports.phue;
const Utils = Me.imports.utils;
const Util = imports.misc.util;
const Gettext = imports.gettext;
const _ = Gettext.gettext;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Slider = imports.ui.slider;
const CheckBox = imports.ui.checkBox;
const Atk = imports.gi.Atk;

const PhueMenuPosition = {
    CENTER: 0,
    RIGHT: 1,
    LEFT: 2
};

var PhueMenu = GObject.registerClass({
     GTypeName: 'PhueMenu'
    },
    class PhueMenu extends PanelMenu.Button {
        _init() {
            super._init(0.0, Me.metadata.name, false);

            this._settings = ExtensionUtils.getSettings(Utils.HUELIGHTS_SETTINGS_SCHEMA);
            this._settings.connect("changed", Lang.bind(this, function() {
                Main.notify('settings changed', 'Now!');
                this.readSettings();
                this.setPositionInPanel();
                this.hue.checkBridges();
                this.refreshMenu();
            }));

            this.hue = new Hue.Phue();

            this.readSettings();
            this._indicatorPositionBackUp = -1;
            this.setPositionInPanel();

            this.hue.checkBridges();

            for (let bridgeid in this.hue.instances) {
                //log(JSON.stringify(this.hue.instances[bridgeid].setLights([12, 21], {"on":true, "sat":254, "bri":254,"hue":10000})));
            }

            Main.notify('Example Notification', 'Hello World !');

            let icon = new St.Icon({
                gicon : Gio.icon_new_for_string(Me.dir.get_path() + '/media/devicesBridgesV2white.svg'),
                style_class : 'system-status-icon',
              });
            this.add_child(icon);

            this.refreshMenu();
    }

    readSettings() {
        this.hue.bridges = this._settings.get_value(Utils.HUELIGHTS_SETTINGS_BRIDGES).deep_unpack();
        this._indicatorPosition = this._settings.get_enum(Utils.HUELIGHTS_SETTINGS_INDICATOR);
        this._zonesFirst = this._settings.get_boolean(Utils.HUELIGHTS_SETTINGS_ZONESFIRST);
    }

    _createLight(data, lightid) {
        let light;
        let slider;
        let checkbox;

        if (typeof(lightid) == "object") {
            light = new PopupMenu.PopupMenuItem(_("All"));
        } else {
            light = new PopupMenu.PopupMenuItem(_(data["lights"][lightid]["name"]));
        }

        light.set_x_align(St.Align.START);
        light.label.set_x_expand(true);

        slider = new Slider.Slider(0);
        slider.set_width(200);
        slider.set_x_align(St.Align.END);
        slider.set_x_expand(false);
        slider.value = 100/254;
        slider.connect('drag-end', this._onSliderChanged.bind(this, slider));
        light.add(slider);

        checkbox = new CheckBox.CheckBox()
        checkbox.set_x_align(St.Align.END);
        checkbox.set_x_expand(false);
        light.add(checkbox);

        return light;
    }

    _createMenuLights(data, lights) {
        let lightsItems = [];
        let light;

        if (lights.length === 0) {
            return [];
        }

        light = this._createLight(data, lights);
        lightsItems.push(light);

        for (let lightid in lights) {
            light = this._createLight(data, parseInt(lights[lightid]));
            lightsItems.push(light);
        }

        return lightsItems;
    }

    _createMenuGroups(data, groupType) {
        let groupItem;
        let menuItems = [];

        if (data["groups"] === undefined) {
            return [];
        }

        for (let groupid in data["groups"]) {
            if (data["groups"][groupid]["type"] !== groupType) {
                continue;
            }

            groupItem = new PopupMenu.PopupSubMenuMenuItem(data["groups"][groupid]["name"]);
            menuItems.push(groupItem);

            let lightItems = this._createMenuLights(data, data["groups"][groupid]["lights"]);
            for (let lightItem in lightItems) {
                groupItem.menu.addMenuItem(lightItems[lightItem]);
            }
        }

        return menuItems;
    }

    _createMenuBridge(bridgeid) {
        let items = [];
        let data = {};

        data = this.hue.instances[bridgeid].getAll();

        if (data["config"] === undefined) {
            return [];
        }

        items.push(new PopupMenu.PopupMenuItem(data["config"]["name"], { hover: false, reactive: false, can_focus: false }));

        if (this._zonesFirst) {
            items = items.concat(this._createMenuGroups(data, "Zone"));
            items = items.concat(this._createMenuGroups(data, "Room"));
        } else {
            items = items.concat(this._createMenuGroups(data, "Room"));
            items = items.concat(this._createMenuGroups(data, "Zone"));
        }

        return items;
    }

    refreshMenu() {
        let bridgeItems = [];
        let oldItems = this.menu._getMenuItems();

        for (let item in oldItems){
            oldItems[item].destroy();
        }

        for (let bridgeid in this.hue.instances) {

            bridgeItems = this._createMenuBridge(bridgeid);

            for (let item in bridgeItems) {
                this.menu.addMenuItem(bridgeItems[item]);
            }

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        let prefsMenuItem = new PopupMenu.PopupMenuItem(_("Settings"));
        prefsMenuItem.connect('button-press-event', () => { Util.spawn(["gnome-shell-extension-prefs", Me.uuid]); });
        this.menu.addMenuItem(prefsMenuItem);
    }

    _onSliderChanged(slider) {
        log("hue " + (slider.value * 254));

    }

    setPositionInPanel(position) {
        let children = null;

        if (this._indicatorPositionBackUp === this._indicatorPosition) {
            return;
        }

        this.get_parent().remove_actor(this);

        switch (this._indicatorPosition) {
            case PhueMenuPosition.LEFT:
                children = Main.panel._leftBox.get_children();
                Main.panel._leftBox.insert_child_at_index(this, children.length);
                break;
            case PhueMenuPosition.CENTER:
                children = Main.panel._centerBox.get_children();
                Main.panel._centerBox.insert_child_at_index(this, children.length);
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
});
