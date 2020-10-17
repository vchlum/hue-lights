'use strict';

/**
 * prefs hue-lights
 * JavaScript Gnome extension for Philips Hue lights and bridges.
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

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Hue = Me.imports.phue;
const Gettext = imports.gettext;
const _ = Gettext.gettext;

var hue;

function init() {
    Utils.initTranslations();

    hue = new Hue.Phue();

    log(`initializing ${Me.metadata.name} Preferences`);
}

var Settings = class HueSettings {

    constructor(hue) {
        this._hue = hue;
        this._prefsWidget = new Gtk.ScrolledWindow({hscrollbar_policy: Gtk.PolicyType.NEVER, hexpand: true, vexpand: true, vexpand_set:true, hexpand_set: true, halign:Gtk.Align.FILL, valign:Gtk.Align.FILL});

        this._prefsWidget.connect('realize', () => {
            let window = this._prefsWidget.get_toplevel();
            let [default_width, default_height] = window.get_default_size();
            window.resize(default_width, default_height/1.5);
        });

    }

    _widgetOnConnect(data) {
        let bridge;
        let ip;

        bridge = data["id"];
        ip = data["ipwidget"].get_text();
        this._hue.bridges[bridge]["ip"] = ip;
        Utils.writeBridges(this._hue.bridges);
        this._hue.checkBridges();

        Utils.writeBridges(this._hue.bridges);

        this.getPrefsWidget();
    }

    _widgetOnRemove(data) {
        let bridge;

        bridge = data["id"];
        log(`removing hue bridge ${bridge}`);
        delete this._hue.bridges[bridge];
        log(JSON.stringify(this._hue.bridges));
        Utils.writeBridges(this._hue.bridges);

        this.getPrefsWidget();
    }

    _widgetOnDiscovery() {
        this._hue.checkBridges();

        Utils.writeBridges(this._hue.bridges);

        this.getPrefsWidget();
    }

    _ipAdd(dialog, ipEntry) {
        let ip = ipEntry.get_text();
        dialog.destroy();
        if (this._hue.addBridgeManual(ip) === false) {
            let dialogFailed = new Gtk.Dialog ({ modal: true, title: _("Bridge not found") });
            dialogFailed.get_content_area().add(new Gtk.Label({label: _("Press the button on the bridge and try again.")}));
            dialogFailed.show_all();
        }

        this._hue.checkBridges();

        Utils.writeBridges(this._hue.bridges);

        this.getPrefsWidget();
    }

    _widgetAdd() {
        let dialog = new Gtk.Dialog ({ modal: true, title: _("Enter new IP address") });

        let entry = new Gtk.Entry();
        dialog.get_content_area().add(entry);

        let buttonOk = Gtk.Button.new_from_stock(Gtk.STOCK_OK);
        buttonOk.connect("clicked", this._ipAdd.bind(this, dialog, entry));

        dialog.get_action_area().add(buttonOk);

        dialog.show_all();
    }

    getPrefsWidget() {
        let children = this._prefsWidget.get_children();
        for (let child in children) {
            children[child].destroy();
        }

        this._prefsWidget.add(this._buildGrid());
        this._prefsWidget.show_all();

        return this._prefsWidget;
    }

    _buildGrid() {
        let grid = new Gtk.Grid({hexpand: true, vexpand: true, halign:Gtk.Align.CENTER, valign:Gtk.Align.CENTER});

        let top = 1;

        let tmpWidged = null;
        let nameWidget = null;
        let ipWidget = null;
        let statusWidget = null;
        let connectWidget = null;
        let removeWidget = null;
        let discoveryWidget = null;
        let addWidget = null;

        for (let bridge in hue.bridges) {
            let name = _("unknown name");

            if (this._hue.bridges[bridge]["name"] !== undefined) {
                name = this._hue.bridges[bridge]["name"];
            }

            nameWidget = new Gtk.Label({label: name});
            grid.attach(nameWidget, 1, top, 1, 1);

            ipWidget = new Gtk.Entry();
            ipWidget.set_text(this._hue.bridges[bridge]["ip"]);
            grid.attach_next_to(ipWidget, nameWidget, Gtk.PositionType.RIGHT, 1, 1);

            if (hue.instances[bridge].isConnected()) {
                statusWidget = new Gtk.Label({label: _("Connected")});
                grid.attach_next_to(statusWidget, ipWidget, Gtk.PositionType.RIGHT, 1, 1);
                tmpWidged = statusWidget;
            } else {
                connectWidget = new Gtk.Button({label: _("Connect")});
                connectWidget.connect("clicked", this._widgetOnConnect.bind(this, {"id":bridge, "ipwidget":ipWidget}));
                grid.attach_next_to(connectWidget, ipWidget, Gtk.PositionType.RIGHT, 1, 1);
                tmpWidged = connectWidget;
            }
            removeWidget = new Gtk.Button({label: _("Remove")});
            removeWidget.connect("clicked", this._widgetOnRemove.bind(this, {"id":bridge}));
            grid.attach_next_to(removeWidget, tmpWidged, Gtk.PositionType.RIGHT, 1, 1);

            top++;
        }

        addWidget = new Gtk.Button({label: _("Add bridge IP")});
        addWidget.connect("clicked", this._widgetAdd.bind(this, {"ipwidget":ipWidget}));
        grid.attach(addWidget, 1, top, 4, 1);

        top++;

        discoveryWidget = new Gtk.Button({label: _("Discover bridges")});
        discoveryWidget.connect("clicked", this._widgetOnDiscovery.bind(this));
        grid.attach(discoveryWidget, 1, top, 4, 1);

        top++;

        return grid
    }
}


function buildPrefsWidget() {

    hue.bridges = Utils.readBridges();

    hue.checkBridges();

    Utils.writeBridges(hue.bridges);

    let hueSettings = new Settings(hue);

    return hueSettings.getPrefsWidget();
}
