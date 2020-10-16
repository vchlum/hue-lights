'use strict';

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
        this._widget = new Gtk.ScrolledWindow({ hscrollbar_policy: Gtk.PolicyType.NEVER });
    }

    _widgetOnConnect(data) {
        let bridge;
        let ip;

        bridge = data["id"];
        ip = data["ipwidget"].get_text();
        this._hue.bridges[bridge]["ip"] = ip;
        Utils.saveBridges(this._hue.bridges);
        this._hue.checkBridges();
        this.getWidget();
    }

    _widgetOnRemove(data) {
        let bridge;

        bridge = data["id"];
        log(`removing hue bridge ${bridge}`);
        delete this._hue.bridges[bridge];
        log(JSON.stringify(this._hue.bridges));
        Utils.saveBridges(this._hue.bridges);
        this.getWidget();
    }

    _widgetOnDiscovery() {
        this._hue.checkBridges();
        this.getWidget();
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
        this.getWidget();
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

    getWidget() {
        let children = this._widget.get_children();
        for (let child in children) {
            children[child].destroy();
        }

        this._widget.add(this._buildGrid());
        this._widget.show_all();

        return this._widget;
    }

    _buildGrid() {
        let grid = new Gtk.Grid();
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

    hue.checkBridges();

    let settings = new Settings(hue);

    return settings.getWidget();
}
