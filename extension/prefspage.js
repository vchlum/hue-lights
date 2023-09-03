'use strict';

/**
 * prefs hue-lights
 * JavaScript Gnome extension for Philips Hue lights and bridges.
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

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Utils from './utils.js';

var forceEnglish = false;

/**
 * AddBridgeDialog object. Provides dialog window
 * expecting bridge IP address as input.
 * 
 * @class AddBridgeDialog
 * @constructor
 * @param {Object} parent
 * @return {Object} gtk dialog
 */
const AddBridgeDialog = GObject.registerClass({
    GTypeName: 'AddBridgeDialog',
    Template: 'resource:///org/gnome/Shell/Extensions/hue-lights/ui/prefsbridgeadd.ui',
    Signals: {
        "ip-address-ok": {},
    },
    InternalChildren: [      
        'ipAddress',
    ],
}, class AddBridgeDialog extends Gtk.Dialog {

    _init(parentWindow) {
        super._init();

        this.set_transient_for(parentWindow);
    }

    /**
     * OK button clicket handler
     * 
     * @method _onOkClicked
     * @private
     * @param {Object} clicked button
     */
    _onOkClicked(button) {
        this.ip = this._ipAddress.text;
        this.emit("ip-address-ok");
        this.destroy();
    }
});

/**
 * NotFoundBridgeDialog object. Provides dialog window
 * noticing the bridge button is not pressed.
 * 
 * @class NotFoundBridgeDialog
 * @constructor
 * @param {Object} parent
 * @return {Object} gtk dialog
 */
const NotFoundBridgeDialog = GObject.registerClass({
    GTypeName: 'NotFoundBridgeDialog',
    Template: 'resource:///org/gnome/Shell/Extensions/hue-lights/ui/prefsbridgenotfound.ui',
}, class NotFoundBridgeDialog extends Gtk.Dialog {

    _init(parentWindow) {
        super._init();

        this.set_transient_for(parentWindow);
    }

    /**
     * OK button clicket handler
     * 
     * @method _onOkClicked
     * @private
     * @param {Object} clicked button
     */
    _onOkClicked(button) {
        this.destroy();
    }
});

/**
 * AddSyncboxDialog object. Provides dialog window
 * expecting syncbox IP address as input.
 * 
 * @class AddSyncboxDialog
 * @constructor
 * @param {Object} parent
 * @return {Object} gtk dialog
 */
const AddSyncboxDialog = GObject.registerClass({
    GTypeName: 'AddSyncboxDialog',
    Template: 'resource:///org/gnome/Shell/Extensions/hue-lights/ui/prefssyncboxadd.ui',
    Signals: {
        "ip-address-ok": {},
    },
    InternalChildren: [      
        'ipAddress',
    ],
}, class AddSyncboxDialog extends Gtk.Dialog {

    _init(parentWindow) {
        super._init();

        this.set_transient_for(parentWindow);
    }

    /**
     * OK button clicket handler
     * 
     * @method _onOkClicked
     * @private
     * @param {Object} clicked button
     */
    _onOkClicked(button) {
        this.ip = this._ipAddress.text;
        this.emit("ip-address-ok");
        this.destroy();
    }
});

/**
 * RegisterSyncboxDialog object. Provides dialog window
 * showed while waiting for pressing the syncbox button.
 * 
 * @class RegisterSyncboxDialog
 * @constructor
 * @param {Object} parent
 * @return {Object} gtk dialog
 */
const RegisterSyncboxDialog = GObject.registerClass({
    GTypeName: 'RegisterSyncboxDialog',
    Template: 'resource:///org/gnome/Shell/Extensions/hue-lights/ui/prefssyncboxregister.ui',
}, class RegisterSyncboxDialog extends Gtk.Dialog {

    _init(parentWindow) {
        super._init();

        this.set_transient_for(parentWindow);
    }

    /**
     * Cancel button clicket handler
     * closing this dialog.
     * 
     * @method _onOkClicked
     * @private
     * @param {Object} clicked button
     */
    _onCancelClicked(button) {
        this.destroy();
    }
});

/**
 * NetworkBoxRow object. Provides gtk ListBoxRow.
 * This is one of the row of associated connections.
 * 
 * @class NetworkBoxRow
 * @constructor
 * @param {Object} label
 * @return {Object} gtk ListBoxRow
 */
const NetworkBoxRow = GObject.registerClass({
    GTypeName: 'NetworkBoxRow',
    Template: 'resource:///org/gnome/Shell/Extensions/hue-lights/ui/prefsnetworkrow.ui',
    InternalChildren: [      
        'networkLabel',
        'networkSwitch',
    ],
    Signals: {
        "connection-switched": {},
    },
}, class NetworkBoxRow extends Gtk.ListBoxRow {

    _init(label) {
        super._init();
        this.label = label;
        this._networkLabel.label = this.label;
        this.active = false;
    }

    /**
     * Associated connection switch handler.
     * Called when switch is changed.
     * 
     * @method _networkNotifyActive
     * @private
     * @param {Object} switch
     */
    _networkNotifyActive(networkSwitch) {
        this.active = networkSwitch.active;
        this.emit("connection-switched");
    }

    /**
     * Turn the switch on/off.
     * 
     * @method setValue
     * @param {Boolean} value
     */
    setValue(value) {
        this._networkSwitch.active = value;
    }
});

/**
 * NotificationLightBoxRow object. Provides gtk ListBoxRow.
 * This is one of the row of notification lights.
 * 
 * @class NotificationLightBoxRow
 * @constructor
 * @param {Object} id of the notification light
 * @param {Object} label
 * @return {Object} gtk ListBoxRow
 */
const NotificationLightBoxRow = GObject.registerClass({
    GTypeName: 'NotificationLightBoxRow',
    Template: 'resource:///org/gnome/Shell/Extensions/hue-lights/ui/prefsnotificationlightsrow.ui',
    InternalChildren: [
        'lightLabel',
        'brightnessAdjustment',
        'lightColorButton',
        'lightSwitch',
    ],
    Signals: {
        "turned-on": {},
        "turned-off": {},
    },
}, class NotificationLightBoxRow extends Gtk.ListBoxRow {

    _init(notifyLightId, label) {
        super._init();
        this.notifyLightId = notifyLightId;
        this.label = label;
        this._lightLabel.label = this.label;
        this.active = false;
        this._initationInProgress = true;
        this.valueToExport = {};
    }

    /**
     * Handler of brightness slider of
     * notification light.
     * Called when slider is moved.
     * Also turns on the notification.
     * 
     * @method _brightnessScaleValueChanged
     * @private
     * @param {Object} slider
     */
    _brightnessScaleValueChanged(scale) {
        if (this._initationInProgress) {
            return;
        }

        this._lightSwitch.active = true;
        this.setExportReady();
        this.emit("turned-on");
    }

    /**
     * Handler of collor button. Called once the
     * color is changed. Also turns on the notification.
     * 
     * @method _brightnessButtonColorSet
     * @private
     * @param {Object} button
     */
    _brightnessButtonColorSet(button) {
        if (this._initationInProgress) {
            return;
        }

        this._lightSwitch.active = true;
        this.setExportReady();
        this.emit("turned-on");
    }

    /**
     * Notify light switch handler.
     * Called when switch is changed.
     * If turned off, the record is deleted
     * from notification lights.
     * 
     * @method _lightNotifyActive
     * @private
     * @param {Object} switch
     */
    _lightNotifyActive(lightSwitch) {
        if (this._initationInProgress) {
            return;
        }

        if (lightSwitch.active) {
            this.setExportReady();
            this.emit("turned-on");
        } else {
            this.emit("turned-off");
        }
    }

    /**
     * Makes data of this row like color and brightness
     * ready to use by anyone who want to read it.
     * 
     * @method setExportReady
     */
    setExportReady() {
        let color = this._lightColorButton.rgba;
        this.valueToExport["r"] = Math.round(color.red * 255);
        this.valueToExport["g"] = Math.round(color.green * 255);
        this.valueToExport["b"] = Math.round(color.blue * 255);

        this.valueToExport["bri"] = Math.round(this._brightnessAdjustment.value);
    }

    /**
     * Sets the widgets based on current values.
     * 
     * @method setValues
     * @private
     * @param {Object} values
     */
    setValues(notifyValues) {
        if (Object.keys(notifyValues).length > 0) {
            this._lightSwitch.active = true;
        } else {
            this._lightSwitch.active = false;
        }

        this.valueToExport = notifyValues;

        if (notifyValues["bri"] !== undefined) {
            this._brightnessAdjustment.value = notifyValues["bri"];
        } else {
            this._brightnessAdjustment.value = 255;
        }

        let color = new Gdk.RGBA();
        color.red = 1.0;
        color.green = 1.0;
        color.blue = 1.0;
        color.alpha = 1.0;

        if (notifyValues["r"] !== undefined &&
            notifyValues["g"] !== undefined &&
            notifyValues["b"] !== undefined) {

            color.red = notifyValues["r"] / 255;
            color.green = notifyValues["g"] / 255;
            color.blue = notifyValues["b"] / 255;
        }


        this._lightColorButton.rgba = color;

        this._initationInProgress = false;
    }
});

/**
 * BridgeTab object. Bridge tab of settings notebook.
 * One tab per bridge. Event discovered and not connected bridges
 * get their tab.
 * 
 * @class BridgeTab
 * @constructor
 * @param {Object} id of the bridge
 * @param {Object} essential bridge data stored by settings.
 * @return {Object} gtk ScrolledWindow
 */
const BridgeTab = GObject.registerClass({
    GTypeName: 'BridgeTab',
    Template: 'resource:///org/gnome/Shell/Extensions/hue-lights/ui/prefsbridgetab.ui',
    InternalChildren: [
        'ipAddress',
        'statusLabel',
        'connectButton',
        'defaultCheckButton',
        'autostartComboBox',
        'defaultEntertainmentComboBox',
        'intensityAdjustment',
        'brightnessAdjustment',
        'noticationLightsListBox',
        'associatedNetworksListBox',
        'notifyLightRegExComboBox',
        'reTitle',
        'reBody',
    ],
    Signals: {
        "ip-address-connect": {},
        "notification-light-turned-on": {},
        "notification-light-turned-off": {},
        "connection-switched-row": {},
        "default-toggled": {},
        "autostart-changed": {},
        "default-entertainment-changed": {},
        "default-intensity-entertainment-changed": {},
        "default-brightness-entertainment-changed": {},
        "notify-regexp-add": {},
        "remove-bridge": {},
    },
}, class BridgeTab extends Gtk.ScrolledWindow {

    _init(bridgeId, data) {
        super._init();
        this._bridge = data;
        this.bridgeId = bridgeId;
        this._knownAssociatedNetworks = [];
        this._addedNotificationLights = [];
        this._regExComboBoxItems = [];
        this._initationInProgress = true;
        
        if (this._bridge["ip"] !== undefined) {
            this._ipAddress.set_text(this._bridge["ip"]);
        }

        this.updateDefault(data);

        for (let mode in Utils.entertainmentModeText) {
            this._defaultEntertainmentComboBox.append(
                mode.toString(),
                _(Utils.entertainmentModeText[mode])
            );
        }
    }

    /**
     * Updates the overall bridge state.
     * 
     * @method updateBridge
     * @param {Object} bridge instance
     * @param {Object} bridge settings data
     * @param {Object} bridge data retrieved from bridge
     */
    updateBridge(instance, data, asyncData) {
        if (instance.isConnected()) {
            this._statusLabel.label = _("Connected");
            this._connectButton.label = _("Remove");
        } else {
            this._statusLabel.label = _("Unreachable");
            this._connectButton.label = _("Connect");
        }
    }

    /**
     * Updates the state of entertainment areas settings
     * of this bridge.
     * 
     * @method updateEntertainmentAreas
     * @param {Object} data retrieved from bridge
     * @param {Object} entertainment settings data
     */
    updateEntertainmentAreas(data, entertainment) {
        this._autostartComboBox.remove_all();

        this._autostartComboBox.append("-1", _("none"));

        for (let groupid in data) {
            if (data[groupid]["type"] !== "Entertainment") {
                continue;
            }

            this._autostartComboBox.append(
                groupid,
                data[groupid]["name"]
            );
        }

        if (entertainment[this.bridgeId] !== undefined &&
            entertainment[this.bridgeId]["autostart"] !== undefined) {

            this._autostartComboBox.set_active_id(
                entertainment[this.bridgeId]["autostart"].toString()
            );
        }  else {
            this._autostartComboBox.set_active_id("-1");
        }

        if (entertainment[this.bridgeId] !== undefined &&
            entertainment[this.bridgeId]["mode"] !== undefined) {

            this._defaultEntertainmentComboBox.set_active_id(
                entertainment[this.bridgeId]["mode"].toString()
            );
        } else {
            this._defaultEntertainmentComboBox.set_active_id(Utils.entertainmentMode.SYNC.toString());
        }

        if (entertainment[this.bridgeId] !== undefined &&
            entertainment[this.bridgeId]["intensity"] !== undefined) {
            this._intensityAdjustment.value = 255 - entertainment[this.bridgeId]["intensity"] + 40;
        } else {
            this._intensityAdjustment.value = 150
        }

        if (entertainment[this.bridgeId] !== undefined &&
            entertainment[this.bridgeId]["bri"] !== undefined) {
            this._brightnessAdjustment.value = entertainment[this.bridgeId ]["bri"];
        } else {
            this._brightnessAdjustment.value = 255;
        }

    }

    /**
     * Detect available networks and updates the state
     * of associated connections settings.
     * 
     * @method updateAssociatedConnection
     * @param {Object} settings data
     */
    updateAssociatedConnection(data) {
        let connections = Utils.getConnections();

        /* add unknown but saved connections */
        for (let d in data) {
            if (data[d]["connections"] === undefined) {
                continue;
            }

            for (let c in data[d]["connections"]) {
                if (!connections.includes(data[d]["connections"][c])) {
                    connections.push(data[d]["connections"][c]);
                }
            }
        }

        for (let c in connections) {
            let isActive = false;

            if (data[this.bridgeId] !== undefined &&
                data[this.bridgeId]["connections"] !== undefined) {

                if (data[this.bridgeId]["connections"].includes(connections[c])) {
                    isActive = true;
                }
            }

            let row = new NetworkBoxRow(connections[c]);
            let signal = row.connect(
                "connection-switched",
                () => {
                    this.connectionSwitchedRow = row;
                    this.emit("connection-switched-row");
                }
            );
            row.setValue(isActive);
            this._associatedNetworksListBox.append(row);
        }
    }

    /**
     * Updates the notification lights.
     * Creates one row per know light.
     * 
     * @method updateNotifyLights
     * @param {Object} bridge data
     * @param {Object} data retrieved from bridge
     * @param {Object} notification lights data stored in settings
     */
    updateNotifyLights(data, asyncData, notifyLights) {
        if (asyncData["groups"] === undefined) {
            return;
        }

        for (let groupId in asyncData["groups"]) {
            if (asyncData["groups"][groupId]["type"] !== "Room") {
                continue;
            }
            
            for (let l in asyncData["groups"][groupId]["lights"]) {
                let lightId = parseInt(asyncData["groups"][groupId]["lights"][l]);

                let notifyLightId = `${this.bridgeId}::${lightId}`;

                if (this._regExComboBoxItems.includes(notifyLightId)) {
                    continue;
                }

                this._regExComboBoxItems.push(notifyLightId);

                let lightName = asyncData["lights"][lightId]["name"];
                let groupName = asyncData["groups"][groupId]["name"];

                this._notifyLightRegExComboBox.append(notifyLightId, `${groupName} - ${lightName}`);
                this._notifyLightRegExComboBox.set_active_id(notifyLightId);
            }

            for (let l in asyncData["groups"][groupId]["lights"]) {
                let lightId = parseInt(asyncData["groups"][groupId]["lights"][l]);

                let notifyLightId = `${this.bridgeId}::${lightId}`;

                let lightName = asyncData["lights"][lightId]["name"];
                let groupName = asyncData["groups"][groupId]["name"];

                if (this._addedNotificationLights.includes(notifyLightId)) {
                    continue;
                }

                this._addedNotificationLights.push(notifyLightId);

                let row = new NotificationLightBoxRow(notifyLightId, `${groupName} - ${lightName}`);
                let signal = row.connect(
                    "turned-on",
                    () => {
                        this.notifyLightRow = row;
                        this.emit("notification-light-turned-on");
                    }
                );

                signal = row.connect(
                    "turned-off",
                    () => {
                        this.notifyLightRow = row;
                        this.emit("notification-light-turned-off");
                    }
                );

                let notifyvalues = {};
                if (notifyLights !== undefined && notifyLights[notifyLightId] !== undefined) {
                    notifyvalues = notifyLights[notifyLightId];
                }
                row.setValues(notifyvalues)

                this._noticationLightsListBox.append(row);
            }
        }

        this.updateNotifyLightsRegEx(notifyLights);
    }

    /**
     * Updates the notification lights.
     * Creates one extra row per regex.
     * 
     * @method updateNotifyLightsRegEx
     * @param {Object} notification lights data stored in settings
     */
    updateNotifyLightsRegEx(notifyLights) {
        for (let notifyLightId in notifyLights) {
            if (this._addedNotificationLights.includes(notifyLightId)) {
                continue;
            }

            if (notifyLightId.split("::")[0] !== this.bridgeId) {
                continue;
            }

            let label = _("unknown name");
            let isRegex = false;
            for (let key in notifyLights[notifyLightId]) {
                if (notifyLights[notifyLightId][key] === Utils.NOTIFY_LIGHTS_LABEL) {
                    label = key;
                }

                if (notifyLights[notifyLightId][key] === Utils.NOTIFY_LIGHTS_REGEX_TITLE) {
                    isRegex = true;
                }

                if (notifyLights[notifyLightId][key] === Utils.NOTIFY_LIGHTS_REGEX_BODY) {
                    isRegex = true;
                }
            }

            if (!isRegex) {
                continue;
            }

            this._addedNotificationLights.push(notifyLightId);

            let row = new NotificationLightBoxRow(notifyLightId, label);
            let signal = row.connect(
                "turned-on",
                () => {
                    this.notifyLightRow = row;
                    this.emit("notification-light-turned-on");
                }
            );

            signal = row.connect(
                "turned-off",
                () => {
                    this.notifyLightRow = row;
                    this.emit("notification-light-turned-off");
                }
            );

            let notifyvalues = {};
            if (notifyLights !== undefined && notifyLights[notifyLightId] !== undefined) {
                notifyvalues = notifyLights[notifyLightId];
            }
            row.setValues(notifyvalues)

            this._noticationLightsListBox.append(row);
        }
    }

    /**
     * Updates the wheter the pridge is prefered and
     * should be showed as default.
     * 
     * @method updateDefault
     * @param {Object} data stored in settings
     */
    updateDefault(data) {
        if (data["default"] !== undefined && data["default"] === this.bridgeId) {
            this.isDefault = true;
        } else {
            this.isDefault = false;
        }

        this._defaultCheckButton.active = this.isDefault;
    }

    /**
     * Button handler either connect unavailable bridge
     * or (if connected) the button can be used for deleting the bridge.
     * 
     * @method _onConnectOrRemoveBridgeClicked
     * @private
     * @param {Object} button
     */
    _onConnectOrRemoveBridgeClicked(button) {
        switch (button.label) {
            case _("Connect"):
                this.ip = this._ipAddress.text;
                this.emit("ip-address-connect");
                break;
            case _("Remove"):
                this.emit("remove-bridge");
                break;

        }
    }

    /**
     * Handler. Sets the bridge as prefered - others
     * are set as not prefered.
     * 
     * @method _defaultToggled
     * @private
     * @param {Object} checkbox
     */
    _defaultToggled(checkButton) {
        if (this._initationInProgress) {
            return;
        }

        this.isDefault = checkButton.active;
        this.emit("default-toggled");
    }

    /**
     * Combobox handler selects the default entertainment area
     * started on login.
     * 
     * @method _autostartComboBoxChanged
     * @private
     * @param {Object} combobox
     */
    _autostartComboBoxChanged(comboBox) {
        if (this._initationInProgress) {
            return;
        }

        if (comboBox.get_active_id() === null) {
            return;
        }

        this.autostart = parseInt(comboBox.get_active_id());
        this.emit("autostart-changed");
    }

    /**
     * Combobox handler selects the default entertainment mode
     * started on login.
     * 
     * @method _defaultEntertainmentComboBoxChanged
     * @private
     * @param {Object} combobox
     */
    _defaultEntertainmentComboBoxChanged(comboBox) {
        if (this._initationInProgress) {
            return;
        }

        if (comboBox.get_active_id() === null) {
            return;
        }

        this.defaultEntertainment = parseInt(comboBox.get_active_id());
        this.emit("default-entertainment-changed");
    }

    /**
     * Slider handler of default intensity for light synchronization.
     * 
     * @method _intensityScaleValueChanged
     * @private
     * @param {Object} slider
     */
    _intensityScaleValueChanged(scale) {
        if (this._initationInProgress) {
            return;
        }

        this.defaultIntensityEntertainment = Math.round(this._intensityAdjustment.value);
        this.emit("default-intensity-entertainment-changed");
    }

    /**
     * Slider handler of default brightness for light synchronization.
     * 
     * @method _brightnessScaleValueChanged
     * @private
     * @param {Object} slider
     */
    _brightnessScaleValueChanged(scale) {
        if (this._initationInProgress) {
            return;
        }

        this.defaultBrightnessEntertainment = Math.round(this._brightnessAdjustment.value);
        this.emit("default-brightness-entertainment-changed");
    }

    /**
     * Button handler adds new regex notification light record.
     * It uses hash from regexes as part of id.
     * 
     * @method _onAddNotifyRegExClicked
     * @private
     * @param {Object} button
     */
    _onAddNotifyRegExClicked(button) {
        let title = this._reTitle.text;
        let body = this._reBody.text;

        if (this._notifyLightRegExComboBox.get_active_id() === null) {
            return;
        }

        if (title === "" || body === "") {
            return;
        }
        
        let hashstring = Utils.hashMe(title + body);
        let key = `${this._notifyLightRegExComboBox.get_active_id()}::${hashstring}`;
        let label = `${this._notifyLightRegExComboBox.get_active_text()}\n\t(${title}/${body})`;

        let value = {'r': 255, 'g': 255, 'b': 255, 'bri': 255};

        title = `${Utils.NOTIFY_LIGHTS_REGEX_TITLE}::${title}`;
        body = `${Utils.NOTIFY_LIGHTS_REGEX_BODY}::${body}`;
        value[label] = Utils.NOTIFY_LIGHTS_LABEL;
        value[title] = Utils.NOTIFY_LIGHTS_REGEX_TITLE;
        value[body] = Utils.NOTIFY_LIGHTS_REGEX_BODY;
        this.notifyRegExToAdd = {};
        this.notifyRegExToAdd[key] = value;
        this.emit("notify-regexp-add");
    }

    /**
     * Button handler emites the need of removing the bridges.
     * Removed from settings too.
     * 
     * @method _onRemoveBridgeClicked
     * @private
     * @param {Object} button
     */
    _onRemoveBridgeClicked(button) {
        this.emit("remove-bridge");
    }

    /**
     * Called when initial settings is finished and the handlers
     * can start to operate. Otherwise the handlers of initilized widget
     * would be called in inproprite time.
     * 
     * @method setInitializationFinished
     */
    setInitializationFinished() {
        this._initationInProgress = false;
    }
});

/**
 * SyncboxTab object. Syncbox tab of settings notebook.
 * One tab per syncbox.
 * 
 * @class SyncboxTab
 * @constructor
 * @param {Object} id of the syncbox
 * @param {Object} essential syncbox data stored by settings.
 * @return {Object} gtk ScrolledWindow
 */
const SyncboxTab = GObject.registerClass({
    GTypeName: 'SyncboxTab',
    Template: 'resource:///org/gnome/Shell/Extensions/hue-lights/ui/prefssyncboxtab.ui',
    InternalChildren: [
        'ipAddress',
        'statusLabel',
        'connectButton',
        'associatedNetworksListBox',
    ],
    Signals: {
        "ip-address-connect": {},
        "remove-syncbox": {},
        "connection-switched-row": {},
        "default-toggled": {},
    },
}, class SyncboxTab extends Gtk.ScrolledWindow {

    _init(syncboxId, data) {
        super._init();
        this._syncbox = data;
        this.syncboxId = syncboxId;
        this._knownAssociatedNetworks = [];
        
        if (this._syncbox["ip"] !== undefined) {
            this._ipAddress.set_text(this._syncbox["ip"]);
        }
    }

    /**
     * Updates the overall syncbox state.
     * 
     * @method updateSyncbox
     * @param {Object} syncbox instance
     * @param {Object} syncbox settings data
     * @param {Object} syncbox data retrieved from syncbox
     */
    updateSyncbox(instance, data, asyncData) {
        if (instance.isConnected()) {
            this._statusLabel.label = _("Connected");
            this._connectButton.label = _("Remove");
        } else {
            this._statusLabel.label = _("Unreachable");
            this._connectButton.label = _("Connect");
        }
    }

    /**
     * Detect available networks and updates the state
     * of associated connections settings.
     * 
     * @method updateAssociatedConnection
     * @param {Object} settings data
     */
    updateAssociatedConnection(data) {
        let connections = Utils.getConnections();

        /* add unknown but saved connections */
        for (let d in data) {
            if (data[d]["connections"] === undefined) {
                continue;
            }

            for (let c in data[d]["connections"]) {
                if (!connections.includes(data[d]["connections"][c])) {
                    connections.push(data[d]["connections"][c]);
                }
            }
        }

        for (let c in connections) {
            let isActive = false;

            if (data[this.syncboxId] !== undefined &&
                data[this.syncboxId]["connections"] !== undefined) {

                if (data[this.syncboxId]["connections"].includes(connections[c])) {
                    isActive = true;
                }
            }

            let row = new NetworkBoxRow(connections[c]);
            let signal = row.connect(
                "connection-switched",
                () => {
                    this.connectionSwitchedRow = row;
                    this.emit("connection-switched-row");
                }
            );
            row.setValue(isActive);
            this._associatedNetworksListBox.append(row);
        }
    }

    /**
     * Button handler either connect unavailable syncbox
     * or (if connected) the button can be used for deleting the syncbox.
     * 
     * @method _onConnectOrRemoveSyncboxClicked
     * @private
     * @param {Object} button
     */
    _onConnectOrRemoveSyncboxClicked(button) {
        switch (button.label) {
            case _("Connect"):
                this.ip = this._ipAddress.text;
                this.emit("ip-address-connect");
                break;
            case _("Remove"):
                this.emit("remove-syncbox");
                break;

        }
    };

    /**
     * Button handler emites the need of removing the syncbox.
     * Removed from settings too.
     * 
     * @method _onRemoveSyncboxClicked
     * @private
     * @param {Object} button
     */
    _onRemoveSyncboxClicked(button) {
        this.emit("remove-syncbox");
    };
});

/**
 * PrefsWidget object. Main preferences widget.
 * 
 * @class PrefsWidget
 * @constructor
 * @param {Object} object of bridges
 * @param {Object} object of syncboxes
 * @return {Object} gtk Box
 */
export const PreferencesPage = GObject.registerClass({
    GTypeName: 'PrefsWidget',
    Template: 'resource:///org/gnome/Shell/Extensions/hue-lights/ui/prefs.ui',
    InternalChildren: [
        'bridgesNotebook',
        'syncboxesNotebook',
        'positionInPanelComboBox',
        'iconPackComboBox',
        'zonesFirstSwitch',
        'showScenesSwitch',
        'forceEnglishSwitch',
        'connectionTimeoutBridgeComboBox',
        'connectionTimeoutSyncboxComboBox',
        'debugSwitch',
        'aboutVersion',
    ],
}, class PreferencesPage extends Adw.PreferencesPage {

    _init(hue, hueSB, metadata, mainDir, settings, path) {
        super._init();
        this._hue = hue;
        this._hueSB = hueSB;

        this._metadata = metadata;
        this._mainDir = mainDir;
        this._settings = settings;
        this._path = path;

        this._defaultToggledInProgress = false;
        this._registerSyncboxDialog = null;

        this._bridgesTabs = {};
        this._syncboxesTabs = {};

        this._settings.connect("changed", () => {
            /* TODO
            if (this._refreshPrefs) {
                this.getPrefsWidget();
                this._refreshPrefs = false;
            }
            */
        });

        this.readSettings();

        this._connectSyncboxRegistration();

        this._hue.checkBridges();
        this._hueSB.checkSyncBoxes();

        this._hue.discoverBridges.connect(
            "discoverFinished",
            () => {
                this._hue.checkBridges(this._hue.discoverBridges.discoveredBridges);
                this.writeBridgesSettings();
                this._updateBridgesTabs();
            }
        );

        this._updateBridgesTabs();
        this._updateSyncboxTabs();
        this._updateGeneral();
        this._updateAdvanced();

        this._aboutVersion.label = `${this._metadata.name}, ` + _("version") + `: ${this._metadata.version}, Copyright (c) 2023 Václav Chlumský`;
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
        this._forceEnglish = this._settings.get_boolean(Utils.HUELIGHTS_SETTINGS_FORCE_ENGLISH);
        this._connectionTimeout = this._settings.get_int(Utils.HUELIGHTS_SETTINGS_CONNECTION_TIMEOUT);
        Utils.setDebug(this._settings.get_boolean(Utils.HUELIGHTS_SETTINGS_DEBUG));
        this._notifyLights = this._settings.get_value(Utils.HUELIGHTS_SETTINGS_NOTIFY_LIGHTS).deep_unpack();
        this._iconPack = this._settings.get_enum(Utils.HUELIGHTS_SETTINGS_ICONPACK);
        this._entertainment = this._settings.get_value(Utils.HUELIGHTS_SETTINGS_ENTERTAINMENT).deep_unpack();
        this._hueSB.syncboxes = this._settings.get_value(Utils.HUELIGHTS_SETTINGS_SYNCBOXES).deep_unpack();
        this._connectionTimeoutSB = this._settings.get_int(Utils.HUELIGHTS_SETTINGS_CONNECTION_TIMEOUT_SB);
        this._associatedConnection = this._settings.get_value(Utils.HUELIGHTS_SETTINGS_ASSOCIATED_CONNECTION).deep_unpack();
    }

    /**
     * Wite setting for bridges
     *
     * @method writeBridgesSettings
     */
    writeBridgesSettings() {
        this._settings.set_value(
            Utils.HUELIGHTS_SETTINGS_BRIDGES,
            new GLib.Variant(
                Utils.HUELIGHTS_SETTINGS_BRIDGES_TYPE,
                this._hue.bridges
            )
        );
    }

    /**
     * Wite setting for syncboxes
     *
     * @method writeSyncboxSettings
     */
    writeSyncboxSettings() {
        this._settings.set_value(
            Utils.HUELIGHTS_SETTINGS_SYNCBOXES,
            new GLib.Variant(
                Utils.HUELIGHTS_SETTINGS_SYNCBOXES_TYPE,
                this._hueSB.syncboxes
            )
        );
    }

    /**
     * Wite setting for entertainment area
     *
     * @method writeEntertainmentSettings
     */
    writeEntertainmentSettings() {
        this._settings.set_value(
            Utils.HUELIGHTS_SETTINGS_ENTERTAINMENT,
            new GLib.Variant(
                Utils.HUELIGHTS_SETTINGS_ENTERTAINMENT_TYPE,
                this._entertainment
            )
        );
    }

    /**
     * Wite setting for associated connections
     *
     * @method writeAssociatedConnections
     */
    writeAssociatedConnections() {
        this._settings.set_value(
            Utils.HUELIGHTS_SETTINGS_ASSOCIATED_CONNECTION,
            new GLib.Variant(
                Utils.HUELIGHTS_SETTINGS_ASSOCIATED_CONNECTION_TYPE,
                this._associatedConnection
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
     * Button handler initates discovering bridges in the network.
     * 
     * @method _onDiscoverBridgeClicked
     * @private
     * @param {Object} button
     */
    _onDiscoverBridgeClicked(button) {
        this._hue.discoverBridges.discover();
    }

    /**
     * Button handler for adding a new bridge manually.
     * Opens dialog with ip adress input.
     * 
     * @method _onAddBridgeClicked
     * @private
     * @param {Object} button
     */
    _onAddBridgeClicked(button) {
        let addBridgeDialog = new AddBridgeDialog(this.get_ancestor(Gtk.Window));

        let signal = addBridgeDialog.connect(
            "ip-address-ok",
            () => {
                this._hue.disableAsyncMode();
                let bridgeAdded = this._hue.addBridgeManual(addBridgeDialog.ip);
                this._hue.enableAsyncMode();

                if (bridgeAdded === false) {
                    new NotFoundBridgeDialog(this.get_ancestor(Gtk.Window)).show()
                } else {
                    this._hue.checkBridges(false);
                    this.writeBridgesSettings();
                    this._updateBridgesTabs();
                }
            }
        );

        addBridgeDialog.show();
    }

    /**
     * Button handler for adding a new syncbox manually.
     * Opens dialog with ip adress input.
     * 
     * @method _onAddSyncboxClicked
     * @private
     * @param {Object} button
     */
    _onAddSyncboxClicked(button) {
        let addSyncboxDialog = new AddSyncboxDialog(this.get_ancestor(Gtk.Window));

        let signal = addSyncboxDialog.connect(
            "ip-address-ok",
            () => {
                addSyncboxDialog.destroy()

                this._registerSyncboxDialog = new RegisterSyncboxDialog(this.get_ancestor(Gtk.Window));
                this._registerSyncboxDialog.show();

                this._hueSB.disableAsyncMode();
                this._hueSB.addSyncBoxManual(addSyncboxDialog.ip);
            }
        );

        addSyncboxDialog.show();
    }

    /**
     * Sets initial signal connection of bridge. Like receiving data from bridge.
     * 
     * @method _connectBridgeInstance
     * @private
     * @param {Object} bridgeid
     */
    _connectBridgeInstance(bridgeId) {
        let signal = this._hue.instances[bridgeId].connect(
            "all-data",
            () => {
                let data = {};
                if (this._hue.instances[bridgeId].isConnected()) {
                    data = this._hue.instances[bridgeId].getAsyncData();
                }

                this._updateBridge(bridgeId, data);
            }
        );
    }

    /**
     * Sets signal connection of syncbox for connecting a new syncbox.
     * 
     * @method _connectSyncboxRegistration
     * @private
     * @param {Object} syncboxid
     */
    _connectSyncboxRegistration() {
        let signal = this._hueSB.connect(
            "registration-complete",
            () => {
                this._hueSB.enableAsyncMode();

                if (this._registerSyncboxDialog !== null) {
                    this._registerSyncboxDialog.destroy();
                    this._registerSyncboxDialog = null;
                }

                this._hueSB.checkSyncBoxes();
                this._updateSyncboxTabs();
                this.writeSyncboxSettings();
            }
        );

        signal = this._hueSB.connect(
            "registration-failed",
            () => {
                this._hueSB.enableAsyncMode();

                if (this._registerSyncboxDialog !== null) {
                    this._registerSyncboxDialog.destroy();
                    this._registerSyncboxDialog = null;
                }
            }
        );
    }

    /**
     * Sets initial signal connection of syncbox. Like receiving data from syncbox.
     * 
     * @method _connectSyncboxInstance
     * @private
     * @param {Object} syncboxid
     */
    _connectSyncboxInstance(syncboxId) {
        let signal = this._hueSB.instances[syncboxId].connect(
            "device-state",
            () => {
                let data = {};
                if (this._hueSB.instances[syncboxId].isConnected()) {
                    data = this._hueSB.instances[syncboxId].getAsyncData();
                }

                this._updateSyncbox(syncboxId, data);
            }
        );
    }

    /**
     * Removes any bridge set as preferred.
     * 
     * @method deleteDefaultBridge
     */
    deleteDefaultBridge() {
        for (let bridge in this._hue.bridges) {
            if (this._hue.bridges[bridge]["default"] !== undefined) {
                delete(this._hue.bridges[bridge]["default"]);
            }
        }
    }

    /**
     * Sets the correct bridge as preferred. If any.
     * 
     * @method updateDefaultBridgeTabs
     */
    updateDefaultBridgeTabs() {
        for (let bridgeId in this._bridgesTabs) {
            this._bridgesTabs[bridgeId].updateDefault(
                this._hue.bridges[bridgeId]
            );
        }
    }

    /**
     * Creates a new tab for bridge without a tab and makes the tab ready for use.
     * 
     * @method _updateBridgesTabs
     * @private
     */
    _updateBridgesTabs() {
        for (let bridgeId in this._hue.bridges) {

            let name = _("unknown name");

            if (this._hue.bridges[bridgeId]["name"] !== undefined) {
                name = this._hue.bridges[bridgeId]["name"];
            }

            if (this._bridgesTabs[bridgeId] !== undefined) {
                /* recreate bridge */
                this._bridgesNotebook.detach_tab(
                    this._bridgesTabs[bridgeId]
                );
                delete(this._bridgesTabs[bridgeId]);
            }

            let bridgeTab = new BridgeTab(bridgeId, this._hue.bridges[bridgeId]);

            let signal = bridgeTab.connect(
                "ip-address-connect",
                () => {
                    if (bridgeTab.ip == undefined) {
                        return;
                    }

                    this._hue.disableAsyncMode();
                    if (this._hue.addBridgeManual(bridgeTab.ip) === false) {
                        new NotFoundBridgeDialog(this.get_ancestor(Gtk.Window)).show()
                    }
                    this._hue.enableAsyncMode();

                    this._hue.checkBridges(false);
                    this.writeBridgesSettings();
                    this._updateBridgesTabs();
                }
            );

            signal = bridgeTab.connect(
                "connection-switched-row",
                () => {
                    let connection = bridgeTab.connectionSwitchedRow.label;

                    if (this._associatedConnection[bridgeTab.bridgeId] === undefined) {
                        this._associatedConnection[bridgeTab.bridgeId] = {};
                        this._associatedConnection[bridgeTab.bridgeId]["connections"] = [];
                        this._associatedConnection[bridgeTab.bridgeId]["type"] = ["bridge"];
                    }

                    if (bridgeTab.connectionSwitchedRow.active) {
                        if (! this._associatedConnection[bridgeTab.bridgeId]["connections"].includes(connection)) {
                            this._associatedConnection[bridgeTab.bridgeId]["connections"].push(connection);
                        }
                    } else {
                        if (this._associatedConnection[bridgeTab.bridgeId]["connections"].includes(connection)) {
                            let index = this._associatedConnection[bridgeTab.bridgeId]["connections"].indexOf(connection);
                            index = this._associatedConnection[bridgeTab.bridgeId]["connections"].splice(index, 1);
                        }
                    }

                    this.writeAssociatedConnections();
                }
            );

            signal = bridgeTab.connect(
                "notification-light-turned-on",
                () => {
                    let notifyLightId = bridgeTab.notifyLightRow.notifyLightId;
                    this._notifyLights[notifyLightId] = bridgeTab.notifyLightRow.valueToExport;

                    this.writeNotifyLightsSettings();
                }
            );

            signal = bridgeTab.connect(
                "notification-light-turned-off",
                () => {

                    let notifyLightId = bridgeTab.notifyLightRow.notifyLightId;
                    if (this._notifyLights[notifyLightId] !== undefined) {
                        delete(this._notifyLights[notifyLightId]);
                    }

                    this.writeNotifyLightsSettings();
                }
            );

            signal = bridgeTab.connect(
                "default-toggled",
                () => {
                    if (this._defaultToggledInProgress === false) {
                        this._defaultToggledInProgress = true;

                        this.deleteDefaultBridge();

                        if (bridgeTab.isDefault) {
                            this._hue.bridges[bridgeTab.bridgeId]["default"] = bridgeTab.bridgeId;
                        }

                        this.updateDefaultBridgeTabs();
                        this._defaultToggledInProgress = false;

                        this.writeBridgesSettings();
                    }
                }
            );

            signal = bridgeTab.connect(
                "autostart-changed",
                () => {
                    if (this._entertainment[bridgeTab.bridgeId] === undefined) {
                        this._entertainment[bridgeTab.bridgeId] = {}
                    }

                    this._entertainment[bridgeTab.bridgeId]["autostart"] = bridgeTab.autostart;
                    this.writeEntertainmentSettings();
                }
            );

            signal = bridgeTab.connect(
                "default-entertainment-changed",
                () => {
                    if (this._entertainment[bridgeTab.bridgeId] === undefined) {
                        this._entertainment[bridgeTab.bridgeId] = {}
                    }

                    this._entertainment[bridgeTab.bridgeId]["mode"] = bridgeTab.defaultEntertainment;
                    this.writeEntertainmentSettings();
                }
            );

            signal = bridgeTab.connect(
                "default-intensity-entertainment-changed",
                () => {
                    if (this._entertainment[bridgeTab.bridgeId] === undefined) {
                        this._entertainment[bridgeTab.bridgeId] = {}
                    }

                    this._entertainment[bridgeTab.bridgeId]["intensity"] = 255 - bridgeTab.defaultIntensityEntertainment + 40;
                    this.writeEntertainmentSettings();
                }
            );

            signal = bridgeTab.connect(
                "default-brightness-entertainment-changed",
                () => {
                    if (this._entertainment[bridgeTab.bridgeId] === undefined) {
                        this._entertainment[bridgeTab.bridgeId] = {}
                    }

                    this._entertainment[bridgeTab.bridgeId]["bri"] = bridgeTab.defaultBrightnessEntertainment;
                    this.writeEntertainmentSettings();
                }
            );

            signal = bridgeTab.connect(
                "notify-regexp-add",
                () => {
                    for (let notifyLightId in bridgeTab.notifyRegExToAdd) {
                        if (Object.keys(this._notifyLights).includes(notifyLightId)) {
                            continue;
                        }

                        this._notifyLights[notifyLightId] = bridgeTab.notifyRegExToAdd[notifyLightId];
                    }

                    this.writeNotifyLightsSettings();
                    bridgeTab.updateNotifyLightsRegEx(this._notifyLights);
                }
            );
            bridgeTab.updateNotifyLightsRegEx(this._notifyLights);

            signal = bridgeTab.connect(
                "remove-bridge",
                () => {
                    let bridgeIdToDelete = bridgeTab.bridgeId;
                    this._bridgesNotebook.detach_tab(
                        this._bridgesTabs[bridgeIdToDelete]
                    );
                    delete(this._bridgesTabs[bridgeIdToDelete]);
                    delete(this._hue.bridges[bridgeIdToDelete]);
                    delete(this._hue.instances[bridgeIdToDelete]);
                    this.writeBridgesSettings();
                }
            );

            bridgeTab.updateAssociatedConnection(
                this._associatedConnection
            );

            this._bridgesTabs[bridgeId] = bridgeTab;

            this._bridgesNotebook.append_page(
                bridgeTab,
                new Gtk.Label({ label: name})
            );

            this._connectBridgeInstance(bridgeId);
            this._hue.checkBridge(bridgeId);
        }
    }

    /**
     * Over all bridge state update based on data from bridge and settings.
     * 
     * @method _updateBridge
     * @private
     * @param {Object} bridgeid
     * @param {Object} asynchrnously obtained data from bridge
     */
    _updateBridge(bridgeId, data) {
        this._bridgesTabs[bridgeId].updateBridge(
            this._hue.instances[bridgeId],
            this._hue.bridges[bridgeId],
            data
        );
        this._bridgesTabs[bridgeId].updateEntertainmentAreas(
            data["groups"],
            this._entertainment
        );

        this._bridgesTabs[bridgeId].updateNotifyLights(
            this._hue.bridges[bridgeId],
            data,
            this._notifyLights
        );

        this._bridgesTabs[bridgeId].setInitializationFinished();
    }

    /**
     * Creates a new tab for syncbox without a tab and makes the tab ready for use.
     * 
     * @method _updateSyncboxTabs
     * @private
     */
    _updateSyncboxTabs() {
        for (let syncboxId in this._hueSB.syncboxes) {

            let name = _("unknown name");

            if (this._hueSB.syncboxes[syncboxId]["name"] !== undefined) {
                name = this._hueSB.syncboxes[syncboxId]["name"];
            }

            if (this._syncboxesTabs[syncboxId] !== undefined) {
                continue
            }

            let syncboxTab = new SyncboxTab(syncboxId, this._hueSB.syncboxes[syncboxId]);

            let signal = syncboxTab.connect(
                "connection-switched-row",
                () => {
                    let connection = syncboxTab.connectionSwitchedRow.label;

                    if (this._associatedConnection[syncboxTab.syncboxId] === undefined) {
                        this._associatedConnection[syncboxTab.syncboxId] = {};
                        this._associatedConnection[syncboxTab.syncboxId]["connections"] = [];
                        this._associatedConnection[syncboxTab.syncboxId]["type"] = ["syncbox"];
                    }

                    if (syncboxTab.connectionSwitchedRow.active) {
                        if (! this._associatedConnection[syncboxTab.syncboxId]["connections"].includes(connection)) {
                            this._associatedConnection[syncboxTab.syncboxId]["connections"].push(connection);
                        }
                    } else {
                        if (this._associatedConnection[syncboxTab.syncboxId]["connections"].includes(connection)) {
                            let index = this._associatedConnection[syncboxTab.syncboxId]["connections"].indexOf(connection);
                            index = this._associatedConnection[syncboxTab.syncboxId]["connections"].splice(index, 1);
                        }
                    }

                    this.writeAssociatedConnections();
                }
            );

            signal = syncboxTab.connect(
                "ip-address-connect",
                () => {
                    if (syncboxTab.ip == undefined) {
                        return;
                    }

                    this._registerSyncboxDialog = new RegisterSyncboxDialog(this.get_ancestor(Gtk.Window));
                    this._registerSyncboxDialog.show();
    
                    this._hueSB.disableAsyncMode();
                    this._hueSB.addSyncBoxManual(syncboxTab.ip);
                }
            );

            signal = syncboxTab.connect(
                "remove-syncbox",
                () => {
                    let syncboxIdToDelete = syncboxTab.syncboxId;
                    this._syncboxesNotebook.detach_tab(
                        this._syncboxesTabs[syncboxIdToDelete]
                    );
                    delete(this._syncboxesTabs[syncboxIdToDelete]);
                    delete(this._hueSB.syncboxes[syncboxIdToDelete]);
                    delete(this._hueSB.instances[syncboxIdToDelete]);
                    this.writeSyncboxSettings();
                }
            );

            syncboxTab.updateAssociatedConnection(
                this._associatedConnection
            );

            this._syncboxesTabs[syncboxId] = syncboxTab;

            this._syncboxesNotebook.append_page(
                syncboxTab,
                new Gtk.Label({ label: name})
            );

            this._connectSyncboxInstance(syncboxId);
            this._hueSB.checkSyncBox(syncboxId);
        }
    }

    /**
     * Over all syncbox state update based on data from syncbox and settings.
     * 
     * @method _updateSyncbox
     * @private
     * @param {Object} syncboxid
     * @param {Object} asynchrnously obtained data from syncbox
     */
    _updateSyncbox(syncboxId, data) {
        this._syncboxesTabs[syncboxId].updateSyncbox(
            this._hueSB.instances[syncboxId],
            this._hueSB.syncboxes[syncboxId],
            data
        );
    }

    /**
     * Update general settings based on stored settings.
     * 
     * @method _updateGeneral
     * @private
     */
    _updateGeneral() {
        this._positionInPanelComboBox.set_active(this._indicatorPosition);
        this._iconPackComboBox.set_active(this._iconPack);
        this._zonesFirstSwitch.set_active(this._zonesFirst);
        this._showScenesSwitch.set_active(this._showScenes);
        this._forceEnglishSwitch.set_active(this._forceEnglish);
    }

    /**
     * Combobox handler of changing position in panel.
     * The value is stored in settings.
     * 
     * @method _positionInPanelChanged
     * @private
     * @param {Object} combobox
     */
    _positionInPanelChanged(comboBox) {
        this._indicatorPosition = comboBox.get_active();
        this._settings.set_enum(
            Utils.HUELIGHTS_SETTINGS_INDICATOR,
            this._indicatorPosition
        );
    }

    /**
     * Combobox handler of changing bright/dark icons.
     * The value is stored in settings.
     * 
     * @method _iconPackChanged
     * @private
     * @param {Object} combobox
     */
    _iconPackChanged(comboBox) {
        this._iconPack = comboBox.get_active();
        this._settings.set_enum(
            Utils.HUELIGHTS_SETTINGS_ICONPACK,
            this._iconPack
        );
    }

    /**
     * Switch handler of displaying zones first.
     * The value is stored in settings.
     * 
     * @method _zonesFirstNotifyActive
     * @private
     * @param {Object} switch
     */
    _zonesFirstNotifyActive(zoneSwitch) {
        this._zonesFirst = zoneSwitch.get_active();
        this._settings.set_boolean(
            Utils.HUELIGHTS_SETTINGS_ZONESFIRST,
            this._zonesFirst
        );
    }

    /**
     * Switch handler of displaying scenes.
     * The value is stored in settings.
     * 
     * @method _showScenesNotifyActive
     * @private
     * @param {Object} switch
     */
    _showScenesNotifyActive(showScenesSwitch) {
        this._showScenes = showScenesSwitch.get_active();
        this._settings.set_boolean(
            Utils.HUELIGHTS_SETTINGS_SHOWSCENES,
            this._showScenes
        );
    }

    /**
     * Switch handler of forcing english language of the extension.
     * The value is stored in settings.
     * 
     * @method _forceEnglishNotifyActive
     * @private
     * @param {Object} switch
     */
    _forceEnglishNotifyActive(forceEnglishSwitch) {
        this._forceEnglish = forceEnglishSwitch.get_active();
        this._settings.set_boolean(
            Utils.HUELIGHTS_SETTINGS_FORCE_ENGLISH,
            this._forceEnglish
        );
    }

    /**
     * Update advanced settings based on stored settings.
     * 
     * @method _updateAdvanced
     * @private
     */
    _updateAdvanced() {
        this._connectionTimeoutBridgeComboBox.set_active(this._connectionTimeout - 1);
        this._connectionTimeoutSyncboxComboBox.set_active(this._connectionTimeoutSB - 1);
        this._debugSwitch.set_active(Utils.getDebug());
    }

    /**
     * Combobox handler of changing bridge timeout.
     * The value is stored in settings.
     * 
     * @method _connectionTimeoutBridgeChanged
     * @private
     * @param {Object} combobox
     */
    _connectionTimeoutBridgeChanged(comboBox) {
        this._connectionTimeout = comboBox.get_active() + 1;
        this._settings.set_int(
            Utils.HUELIGHTS_SETTINGS_CONNECTION_TIMEOUT,
            this._connectionTimeout
        );
    }

    /**
     * Combobox handler of changing syncbox timeout.
     * The value is stored in settings.
     * 
     * @method _connectionTimeoutSyncboxChanged
     * @private
     * @param {Object} combobox
     */
    _connectionTimeoutSyncboxChanged(comboBox) {
        this._connectionTimeoutSB = comboBox.get_active() + 1;
        this._settings.set_int(
            Utils.HUELIGHTS_SETTINGS_CONNECTION_TIMEOUT_SB,
            this._connectionTimeoutSB
        );
    }

    /**
     * Switch handler of enabling debug messages.
     * The value is stored in settings.
     * 
     * @method _debugNotifyActive
     * @private
     * @param {Object} switch
     */
    _debugNotifyActive(debugSwitch) {
        Utils.setDebug(debugSwitch.get_active());
        this._settings.set_boolean(
            Utils.HUELIGHTS_SETTINGS_DEBUG,
            Utils.getDebug()
        );
    }
});
