'use strict';

/**
 * extension hue-lights
 * JavaScript Gnome extension for Philips Hue lights and bridges.
 *
 * @author Václav Chlumský
 * @copyright Copyright 2022, Václav Chlumský.
 */

 /**
 * @license
 * The MIT License (MIT)
 *
 * Copyright (c) 2022 Václav Chlumský
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
const HueMenu = Me.imports.extensionmenu;
const HueSyncBox = Me.imports.syncboxmenu;
const Utils = Me.imports.utils;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;

var hueLightsMenu; /* main widget */
var hueSyncBoxMenu; /* widget for sync boxes */

let origCreateBanner;

/**
 * Function to substitute original createBanner.
 *
 * @method createBannerHue
 */
function createBannerHue() {

    if (hueLightsMenu !== null) {

        hueLightsMenu.runNotify(this.title, this.bannerBodyText);
    }

    return this.source.createBanner(this);
}

/**
 * This function is called once the extension is loaded, not enabled.
 *
 * @method init
 */
function init() {

    ExtensionUtils.initTranslations();
}

/**
 * This function could be called after the extension is enabled.
 *
 * @method enable
 */
function enable() {

    hueLightsMenu = new HueMenu.PhueMenu();

    Main.panel.addToStatusArea('hue-lights', hueLightsMenu);

    hueSyncBoxMenu = new HueSyncBox.PhueSyncBoxMenu();

    Main.panel.addToStatusArea('hue-sync-box', hueSyncBoxMenu);

    origCreateBanner = MessageTray.Notification.prototype.createBanner;
    MessageTray.Notification.prototype.createBanner = createBannerHue;
}

/**
 * This function could be called after the extension is uninstalled,
 * disabled GNOME Tweaks, when you log out or when the screen locks.
 *
 * @method disable
 */
function disable() {

    MessageTray.Notification.prototype.createBanner = origCreateBanner;

    hueSyncBoxMenu.disarmTimers();
    hueSyncBoxMenu.disconnectSignals(true);
    hueSyncBoxMenu.destroy();
    hueSyncBoxMenu = null

    hueLightsMenu.disarmTimers();
    hueLightsMenu.disableKeyShortcuts();
    hueLightsMenu.disableStreams();
    hueLightsMenu.disconnectSignals(true);
    hueLightsMenu.destroy();
    hueLightsMenu = null
}
