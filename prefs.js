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
const Gdk = imports.gi.Gdk;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Hue = Me.imports.phue;
const Lang = imports.lang;

const Gettext = imports.gettext;
const _ = Gettext.gettext;

var hue;

/**
 * HuePrefs class for creating preference window
 *
 * @class HuePrefs
 * @constructor
 * @param {object} instance of Phue class with bridges
 * @return {Object} instance
 */
var Prefs = class HuePrefs {

    constructor(hue) {

        this._refreshPrefs = false;
        this._hue = hue;
        this._prefsWidget = new Gtk.ScrolledWindow(
            {
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                hexpand: true,
                vexpand: true,
                vexpand_set:true,
                hexpand_set: true,
                halign:Gtk.Align.FILL,
                valign:Gtk.Align.FILL
            }
        );

        this._settings = ExtensionUtils.getSettings(Utils.HUELIGHTS_SETTINGS_SCHEMA);
        this._settings.connect("changed", Lang.bind(this, () => {
            if (this._refreshPrefs) {
                this.getPrefsWidget();
                this._refreshPrefs = false;
            }
        }));

        this.readSettings();

        this._prefsWidget.connect('realize', () => {
            let window = this._prefsWidget.get_toplevel();
            let [default_width, default_height] = window.get_default_size();
            window.resize(default_width, default_height);
        });

        this._hue.checkBridges();

        this.writeSettings();
    }

    /**
     * Reads settings into class variables.
     *
     * @method readSettings
     */
    readSettings() {

        this._hue.bridges = this._settings.get_value(Utils.HUELIGHTS_SETTINGS_BRIDGES).deep_unpack();
        this._indicatorPosition = this._settings.get_enum(Utils.HUELIGHTS_SETTINGS_INDICATOR);
        this._zonesFirst = this._settings.get_boolean(Utils.HUELIGHTS_SETTINGS_ZONESFIRST);
        this._showScenes = this._settings.get_boolean(Utils.HUELIGHTS_SETTINGS_SHOWSCENES);
        this._connectionTimeout = this._settings.get_int(Utils.HUELIGHTS_SETTINGS_CONNECTION_TIMEOUT);
        this._notifyLights = this._settings.get_value(Utils.HUELIGHTS_SETTINGS_NOTIFY_LIGHTS).deep_unpack();
        this._iconPack = this._settings.get_enum(Utils.HUELIGHTS_SETTINGS_ICONPACK);
    }

    /**
     * Write settings from class variables.
     *
     * @method writeSettings
     */
    writeSettings() {

        this._settings.set_value(
            Utils.HUELIGHTS_SETTINGS_BRIDGES,
            new GLib.Variant(
                Utils.HUELIGHTS_SETTINGS_BRIDGES_TYPE,
                this._hue.bridges
            )
        );
    }

    /**
     * Wite setting for lights used for notification
     *
     * @method writeNotifyLightsSettings
     */
    writeNotifyLightsSettings() {

    this._settings.set_value(
            Utils.HUELIGHTS_SETTINGS_NOTIFY_LIGHTS,
            new GLib.Variant(
                Utils.HUELIGHTS_SETTINGS_NOTIFY_LIGHTS_TYPE,
                this._notifyLights
            )
        );
    }
    /**
     * Get the main witget for prefs.
     *
     * @method getPrefsWidget
     * @return {Object} the widget itself
     */
    getPrefsWidget() {

        let children = this._prefsWidget.get_children();
        for (let child in children) {
            children[child].destroy();
        }

        this._prefsWidget.add(this._buildWidget());
        this._prefsWidget.show_all();

        return this._prefsWidget;
    }

    /**
     * Create the main notebook with its content.
     *
     * @method _buildWidget
     * @private
     * @return {Object} the notebook widget
     */
    _buildWidget() {

        let notebook = new Gtk.Notebook();

        let pageBridges = this._buildBridgesWidget();
        pageBridges.border_width = 10;
        notebook.append_page(
            pageBridges,
            new Gtk.Label({label: _("Philips Hue Bridges")})
        );

        let pageGeneral = this._buildGeneralWidget();
        pageGeneral.border_width = 10;
        notebook.append_page(
            pageGeneral,
            new Gtk.Label({label: _("General settings")})
        );

        let pageAdvanced = this._buildAdvancedWidget();
        pageAdvanced.border_width = 10;
        notebook.append_page(
            pageAdvanced,
            new Gtk.Label({label: _("Advanced settings")})
        );

        let pageAbout = this._buildAboutWidget()
        pageAbout.border_width = 10;
        notebook.append_page(
            pageAbout,
            Gtk.Image.new_from_icon_name("help-about", Gtk.IconSize.MENU)
        );

        return notebook;
    }

    /**
     * Create the widget with listed bridges.
     *
     * @method _buildBridgesWidget
     * @private
     * @return {Object} the widget with bridges
     */
    _buildBridgesWidget() {

        let top = 1;
        let tmpWidged = null;
        let nameWidget = null;
        let ipWidget = null;
        let statusWidget = null;
        let connectWidget = null;
        let removeWidget = null;
        let discoveryWidget = null;
        let addWidget = null;

        let bridgesWidget = new Gtk.Grid(
            {
                hexpand: true,
                vexpand: true,
                halign:Gtk.Align.CENTER,
                valign:Gtk.Align.CENTER
            }
        );

        for (let bridge in this._hue.bridges) {
            let name = _("unknown name");

            if (this._hue.bridges[bridge]["name"] !== undefined) {
                name = this._hue.bridges[bridge]["name"];
            }

            nameWidget = new Gtk.Label({label: name});
            bridgesWidget.attach(nameWidget, 1, top, 1, 1);

            ipWidget = new Gtk.Entry();
            ipWidget.set_text(this._hue.bridges[bridge]["ip"]);
            bridgesWidget.attach_next_to(
                ipWidget,
                nameWidget,
                Gtk.PositionType.RIGHT,
                1,
                1
            );

            if (this._hue.instances[bridge].isConnected()) {
                statusWidget = new Gtk.Label({label: _("Connected")});
                bridgesWidget.attach_next_to(
                    statusWidget,
                    ipWidget,
                    Gtk.PositionType.RIGHT,
                    1,
                    1
                );
                tmpWidged = statusWidget;
            } else if (this._hue.bridges[bridge]["username"] !== undefined) {
                statusWidget = new Gtk.Label({label: _("Unreachable")});
                bridgesWidget.attach_next_to(
                    statusWidget,
                    ipWidget,
                    Gtk.PositionType.RIGHT,
                    1,
                    1
                );
                tmpWidged = statusWidget;
            } else {
                connectWidget = new Gtk.Button({label: _("Press bridge button and Connect")});
                connectWidget.connect(
                    "clicked",
                    this._widgetEventHandler.bind(
                        this,
                        {"event": "connect-bridge", "bridgeid":bridge, "object":ipWidget}
                    )
                );
                bridgesWidget.attach_next_to(
                    connectWidget,
                    ipWidget,
                    Gtk.PositionType.RIGHT,
                    1,
                    1
                );
                tmpWidged = connectWidget;
            }
            removeWidget = new Gtk.Button({label: _("Remove")});
            removeWidget.connect(
                "clicked",
                this._widgetEventHandler.bind(
                    this,
                    {"event": "remove-bridge", "bridgeid": bridge}
                )
            );
            bridgesWidget.attach_next_to(
                removeWidget,
                tmpWidged,
                Gtk.PositionType.RIGHT,
                1,
                1
            );

            top++;
        }

        addWidget = new Gtk.Button(
            {label: _("Add Philips Hue bridge IP")}
        );
        addWidget.connect(
            "clicked",
            this._widgetEventHandler.bind(
                this,
                {"event": "add-ip", "object": ipWidget}
            )
        );
        bridgesWidget.attach(addWidget, 1, top, 4, 1);

        top++;

        discoveryWidget = new Gtk.Button(
            {label: _("Discover Philips Hue bridges")}
        );
        discoveryWidget.connect(
            "clicked",
            this._widgetEventHandler.bind(
                this,
                {"event": "discovery-bridges"}
            )
        );
        bridgesWidget.attach(discoveryWidget, 1, top, 4, 1);

        top++;

        return bridgesWidget;
    }

    /**
     * Create the widget with general settings.
     *
     * @method _buildGeneralWidget
     * @private
     * @return {Object} the widget with settings
     */
    _buildGeneralWidget() {

        let top = 1;
        let labelWidget = null;

        let generalWidget = new Gtk.Grid(
            {
                hexpand: true,
                vexpand: true,
                halign:Gtk.Align.CENTER,
                valign:Gtk.Align.CENTER
            }
        );

        /**
         * Position in panel
         */
        labelWidget = new Gtk.Label(
            {label: _("Indicator position in panel:")}
        );
        generalWidget.attach(labelWidget, 1, top, 1, 1);

        let positinInPanelWidget = new Gtk.ComboBoxText();
        positinInPanelWidget.append_text(_("center"));
        positinInPanelWidget.append_text(_("right"));
        positinInPanelWidget.append_text(_("left"));
        positinInPanelWidget.set_active(this._indicatorPosition);
        positinInPanelWidget.connect(
            "changed",
            this._widgetEventHandler.bind(
                this,
                {"event": "position-in-panel", "object": positinInPanelWidget}
            )
        )
        generalWidget.attach_next_to(
            positinInPanelWidget,
            labelWidget,
            Gtk.PositionType.RIGHT,
            1,
            1
        );

        top++;

        /**
         * Icon pack
         */
        labelWidget = new Gtk.Label(
            {label: _("Icon pack:")}
        );
        generalWidget.attach(labelWidget, 1, top, 1, 1);

        let iconPackWidget = new Gtk.ComboBoxText();
        iconPackWidget.append_text(_("none"));
        iconPackWidget.append_text(_("bright"));
        iconPackWidget.append_text(_("dark"));
        iconPackWidget.set_active(this._iconPack);
        iconPackWidget.connect(
            "changed",
            this._widgetEventHandler.bind(
                this,
                {"event": "icon-pack", "object": iconPackWidget}
            )
        )
        generalWidget.attach_next_to(
            iconPackWidget,
            labelWidget,
            Gtk.PositionType.RIGHT,
            1,
            1
        );

        top++;

        /**
         * Show zones first
         */
        labelWidget = new Gtk.Label(
            {label: _("Show zones first:")}
        );
        generalWidget.attach(labelWidget, 1, top, 1, 1);

        let zonesFirstWidget = new Gtk.Switch(
            {
                active: this._zonesFirst,
                hexpand: false,
                vexpand: false,
                halign:Gtk.Align.CENTER,
                valign:Gtk.Align.CENTER
            }
        );
        zonesFirstWidget.connect(
            "notify::active",
            this._widgetEventHandler.bind(
                this,
                {"event": "zones-first", "object": zonesFirstWidget}
            )
        )
        generalWidget.attach_next_to(
            zonesFirstWidget,
            labelWidget,
            Gtk.PositionType.RIGHT,
            1,
            1
        );

        top++;

        /**
         * Show zones in group menu
         */
        labelWidget = new Gtk.Label(
            {label: _("Show scenes in group menu:")}
        );
        generalWidget.attach(labelWidget, 1, top, 1, 1);

        let showScenesWidget = new Gtk.Switch(
            {
                active: this._showScenes,
                hexpand: false,
                vexpand: false,
                halign:Gtk.Align.CENTER,
                valign:Gtk.Align.CENTER
            }
        );
        showScenesWidget.connect(
            "notify::active",
            this._widgetEventHandler.bind(
                this,
                {"event": "show-scenes", "object": showScenesWidget}
            )
        )
        generalWidget.attach_next_to(
            showScenesWidget,
            labelWidget,
            Gtk.PositionType.RIGHT,
            1,
            1
        );

        top++;
        generalWidget.attach(new Gtk.HSeparator(), 1, top, 2, 1);
        top++;

        /**
         * Blink light notification
         */
        let notifyLightId = undefined;

        labelWidget = new Gtk.Label(
            {label: _("Notification lights:")}
        );
        generalWidget.attach(labelWidget, 1, top, 1, 1);

        /* list all lights in menu wich checkboxes*/
        let lightNotifyMenuBUtton = new Gtk.MenuButton({label: _("Select lights")});
        let lightNotifyMenu = new Gtk.Menu();
        lightNotifyMenuBUtton.set_popup(lightNotifyMenu);

        for (let bridgeid in this._hue.instances) {

            if (this._hue.data[bridgeid] === undefined ||
                this._hue.data[bridgeid]["groups"] === undefined) {
                continue;
            }

            for (let groupid in this._hue.data[bridgeid]["groups"]) {

                if (this._hue.data[bridgeid]["groups"][groupid]["type"] !== "Room") {
                    continue;
                }

                for (let l in this._hue.data[bridgeid]["groups"][groupid]["lights"]) {
                    let lightid = parseInt(this._hue.data[bridgeid]["groups"][groupid]["lights"][l]);

                    notifyLightId = `${bridgeid}::${lightid}`;

                    let lightName = this._hue.data[bridgeid]["lights"][lightid]["name"];
                    let groupName = this._hue.data[bridgeid]["groups"][groupid]["name"];

                    let lightNotifyMenuItem = new Gtk.CheckMenuItem({label:`${groupName} - ${lightName}`});
                    for (let i in this._notifyLights) {
                        if (notifyLightId == i) {
                            lightNotifyMenuItem.active = true;
                        }
                    }
                    lightNotifyMenuItem.connect(
                        "toggled",
                        this._widgetEventHandler.bind(
                            this,
                            {
                                "event": "notify-light-toggled",
                                "notify-lightid": notifyLightId,
                                "object": lightNotifyMenuItem
                            }
                        )
                    )
                    lightNotifyMenu.append(lightNotifyMenuItem);
                }

            }

        }

        lightNotifyMenu.show_all();

        generalWidget.attach_next_to(
            lightNotifyMenuBUtton,
            labelWidget,
            Gtk.PositionType.RIGHT,
            1,
            1
        );

        top++;

        /* find some valid notifyLightId - if possible */
        for (let i in this._notifyLights) {
            notifyLightId = i;
            break;
        }

        /**
         * Brightness for notification light
         */
        let briVal = 254;
        if (notifyLightId !== undefined &&
            this._notifyLights[notifyLightId] !== undefined &&
            this._notifyLights[notifyLightId]["bri"] !== undefined) {

            briVal = this._notifyLights[notifyLightId]["bri"];
        }

        let adj = new Gtk.Adjustment({value : 1.0, lower: 0, upper: 254, step_increment : 1, page_increment : 20, page_size : 0});
        let brightnessNotifyWidget = new Gtk.ScaleButton({
            label: _("Brightness"),
            adjustment : adj
        });
        brightnessNotifyWidget.value = briVal;
        brightnessNotifyWidget.connect(
            "value-changed",
            this._widgetEventHandler.bind(
                this,
                {
                    "event": "notify-light-brightness",
                    "object": brightnessNotifyWidget
                }
            )
        )
        generalWidget.attach(brightnessNotifyWidget, 1, top, 1, 1);

        /**
         * Color for notification light
         */
        let colorButtonNotifyWidget = new Gtk.ColorButton();
        let notifyLightColor = new Gdk.RGBA();

        notifyLightColor.red = 1.0;
        notifyLightColor.green = 1.0;
        notifyLightColor.blue = 1.0;
        if (notifyLightId !== undefined &&
            this._notifyLights[notifyLightId] !== undefined &&
            this._notifyLights[notifyLightId]["r"] !== undefined) {

            notifyLightColor.red = this._notifyLights[notifyLightId]["r"] / 255;
            notifyLightColor.green = this._notifyLights[notifyLightId]["g"] / 255;
            notifyLightColor.blue = this._notifyLights[notifyLightId]["b"] / 255;
        }
        notifyLightColor.alpha = 1.0;
        colorButtonNotifyWidget.set_rgba(notifyLightColor);
        colorButtonNotifyWidget.connect(
            "color-set",
            this._widgetEventHandler.bind(
                this,
                {
                    "event": "notify-light-color",
                    "object": colorButtonNotifyWidget
                }
            )
        )

        generalWidget.attach_next_to(
            colorButtonNotifyWidget,
            brightnessNotifyWidget,
            Gtk.PositionType.RIGHT,
            1,
            1
        );

        top++;
        generalWidget.attach(new Gtk.HSeparator(), 1, top, 2, 1);
        top++;

        return generalWidget;
    }

    /**
     * Create the widget with advanced settings.
     *
     * @method _buildAdvancedWidget
     * @private
     * @return {Object} the widget with advancedsettings
     */
    _buildAdvancedWidget() {

        let top = 1;
        let labelWidget = null;

        let advancedWidget = new Gtk.Grid(
            {
                hexpand: true,
                vexpand: true,
                halign:Gtk.Align.CENTER,
                valign:Gtk.Align.CENTER
            }
        );

        labelWidget = new Gtk.Label(
            {label: _("Connection timeout (seconds):")}
        );
        advancedWidget.attach(labelWidget, 1, top, 1, 1);

        let connectionTimeoutWidget = new Gtk.ComboBoxText();
        connectionTimeoutWidget.append_text("1");
        connectionTimeoutWidget.append_text("2");
        connectionTimeoutWidget.append_text("3");
        connectionTimeoutWidget.append_text("4");
        connectionTimeoutWidget.append_text("5");
        connectionTimeoutWidget.set_active(this._connectionTimeout - 1);
        connectionTimeoutWidget.connect(
            "changed",
            this._widgetEventHandler.bind(
                this,
                {"event": "connection-timeout", "object": connectionTimeoutWidget}
            )
        )
        advancedWidget.attach_next_to(
            connectionTimeoutWidget,
            labelWidget,
            Gtk.PositionType.RIGHT,
            1,
            1
        );

        top++;

        return advancedWidget;
    }

    /**
     * Create the widget 'About'.
     *
     * @method _buildBridgesWidget
     * @private
     * @return {Object} the widget 'about'
     */
    _buildAboutWidget() {

        let aboutWidget = new Gtk.Box(
            {
                hexpand: true,
                vexpand: true,
                halign:Gtk.Align.CENTER,
                valign:Gtk.Align.CENTER
            }
        );
        aboutWidget.add(new Gtk.Label(
            {label: `${Me.metadata.name}, version: ${Me.metadata.version}, Copyright (c) 2020 Václav Chlumský`}
        ));
        return aboutWidget;
    }

    /**
     * Handles events from widget in prefs.
     *
     * @method _widgetEventHandler
     * @private
     * @param (object) dictionary with instruction what to do
     */
    _widgetEventHandler(data) {

        let bridgeid;
        let ip;
        let lightId;

        switch(data["event"]) {

            case "connect-bridge":

                bridgeid = data["bridgeid"];
                ip = data["object"].get_text();
                this._hue.bridges[bridgeid]["ip"] = ip;

                this._hue.checkBridges();

                this._refreshPrefs = true;
                this.writeSettings();
                break;

            case "remove-bridge":

                bridgeid = data["bridgeid"];
                log(`removing hue bridge ${bridgeid}`);

                delete this._hue.bridges[bridgeid];
                if (this._hue.instances[bridgeid] !== undefined) {
                    delete this._hue.instances[bridgeid];
                }

                this._refreshPrefs = true;
                this.writeSettings();
                break;

            case "new-ip":

                ip = data["object2"].get_text();
                data["object1"].destroy();
                if (this._hue.addBridgeManual(ip) === false) {
                    let dialogFailed = new Gtk.Dialog(
                        {
                            modal: true,
                            title: _("Bridge not found")
                        }
                    );
                    dialogFailed.get_content_area().add(new Gtk.Label(
                        {label: _("Press the button on the bridge and try again.")}
                    ));
                    dialogFailed.show_all();
                    break;
                }

                this._hue.checkBridges();
                this._refreshPrefs = true;
                this.writeSettings();
                break;

            case "add-ip":

                let dialog = new Gtk.Dialog(
                    {
                        modal: true,
                        title: _("Enter new IP address")
                    }
                );

                let entry = new Gtk.Entry();
                dialog.get_content_area().add(entry);

                let buttonOk = Gtk.Button.new_from_stock(Gtk.STOCK_OK);
                buttonOk.connect(
                    "clicked",
                    this._widgetEventHandler.bind(
                        this,
                        {"event":"new-ip", "object1": dialog, "object2": entry}
                    )
                );

                dialog.get_action_area().add(buttonOk);

                dialog.show_all();
                break;

            case "discovery-bridges":

                this._hue.checkBridges();
                this._refreshPrefs = true;
                this.writeSettings();
                break;

            case "position-in-panel":

                this._indicatorPosition = data["object"].get_active();
                this._settings.set_enum(
                    Utils.HUELIGHTS_SETTINGS_INDICATOR,
                    this._indicatorPosition
                );
                break;

            case "icon-pack":

                this._iconPack = data["object"].get_active();
                this._settings.set_enum(
                    Utils.HUELIGHTS_SETTINGS_ICONPACK,
                    this._iconPack
                );
                break;

            case "zones-first":

                this._zonesFirst = data["object"].get_active();
                this._settings.set_boolean(
                    Utils.HUELIGHTS_SETTINGS_ZONESFIRST,
                    this._zonesFirst
                );
                break;

            case "show-scenes":

                this._showScenes = data["object"].get_active();
                this._settings.set_boolean(
                    Utils.HUELIGHTS_SETTINGS_SHOWSCENES,
                    this._showScenes
                );
                break;

            case "connection-timeout":

                this._connectionTimeout = data["object"].get_active() + 1;
                this._settings.set_int(
                    Utils.HUELIGHTS_SETTINGS_CONNECTION_TIMEOUT,
                    this._connectionTimeout
                );
                break;


            case "notify-light-toggled":

                let lightId = data["notify-lightid"];

                if (data["object"].active) {
                    let notifyData = {};
                    if (this._notifyLights[lightId] !== undefined) {
                        notifyData = this._notifyLights[lightId];
                    }

                    /* if no data provided, check if some other light has some data */
                    if (Object.keys(notifyData).length === 0) {
                        for (let i in this._notifyLights) {
                            if (Object.keys(this._notifyLights[i]).length > 0) {
                                notifyData = this._notifyLights[i];
                                break;
                            }
                        }
                    }

                    this._notifyLights[lightId] = notifyData;

                } else {
                    if (this._notifyLights[lightId] !== undefined) {
                        delete this._notifyLights[lightId];
                    }
                }

                this.writeNotifyLightsSettings();
                break;

            case "notify-light-brightness":

                for (let i in this._notifyLights){

                    if (this._notifyLights[i] === undefined) {
                        this._notifyLights[i] = {};
                    }

                    this._notifyLights[i]["bri"] = Math.round(data["object"].value);
                }

                this.writeNotifyLightsSettings();
                break;

            case "notify-light-color":

                for (let i in this._notifyLights){

                    if (this._notifyLights[i] === undefined) {
                        this._notifyLights[i] = {};
                    }

                    let notifyLightColor = data["object"].get_rgba();
                    this._notifyLights[i]["r"] = Math.round(notifyLightColor.red * 255);
                    this._notifyLights[i]["g"] = Math.round(notifyLightColor.green * 255);
                    this._notifyLights[i]["b"] = Math.round(notifyLightColor.blue * 255);
                }

                this.writeNotifyLightsSettings();
                break;

            case undefined:
            default:
                log("unknown event");
          }
    }
}

/**
 * Like `extension.js` this is used for any one-time setup like translations.
 *
 * @method init
 */
function init() {

    Utils.initTranslations();

    hue = new Hue.Phue(false);

    log(`initializing ${Me.metadata.name} Preferences`);
}

/**
 * This function is called when the preferences window is first created to build
 * and return a Gtk widget.
 *
 * @method buildPrefsWidget
 * @return {Object} returns the prefsWidget
 */
function buildPrefsWidget() {

    let huePrefs = new Prefs(hue);

    return huePrefs.getPrefsWidget();
}
