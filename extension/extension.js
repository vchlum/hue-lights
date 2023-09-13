'use strict';

/**
 * extension hue-lights
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

 import * as Main from 'resource:///org/gnome/shell/ui/main.js';
 import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
 import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
 import * as HueMenu from './extensionmenu.js';
 import * as HueSyncBox from './syncboxmenu.js';

 let runNotify = null;

export default class HueLightsExtension extends Extension {
    /**
     * Function for replacing of the original createBanner.
     *
     * @method createBannerHue
     */
    createBannerHue() {

        if (runNotify !== null) {
            runNotify(this.title, this.bannerBodyText);
        }

        return this.source.createBanner(this);
    }

    enable() {
        this._hueLightsMenu = new HueMenu.PhueMenu(
            this.metadata,
            this.dir,
            this.getSettings(),
            this.openPreferences.bind(this)
        );
        Main.panel.addToStatusArea('hue-lights', this._hueLightsMenu);

        this._hueSyncBoxMenu = new HueSyncBox.PhueSyncBoxMenu(
            this.metadata,
            this.dir,
            this.getSettings(),
            this.openPreferences.bind(this)
        );
        Main.panel.addToStatusArea('hue-sync-box', this._hueSyncBoxMenu);

        runNotify = this._hueLightsMenu.runNotify.bind(this._hueLightsMenu);
        this._origCreateBanner = MessageTray.Notification.prototype.createBanner;
        MessageTray.Notification.prototype.createBanner = this.createBannerHue;
    }

    disable() {
        MessageTray.Notification.prototype.createBanner = this._origCreateBanner;

        this._hueSyncBoxMenu.disarmTimers();
        this._hueSyncBoxMenu.disconnectSignals(true);
        this._hueSyncBoxMenu.destroy();
        this._hueSyncBoxMenu = null

        this._hueLightsMenu.disarmTimers();
        this._hueLightsMenu.disableKeyShortcuts();
        this._hueLightsMenu.disableStreams();
        this._hueLightsMenu.disconnectSignals(true);
        this._hueLightsMenu.destroy();
        this._hueLightsMenu = null
    }
}
