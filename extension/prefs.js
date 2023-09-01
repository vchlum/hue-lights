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
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Hue from './phue.js';
import * as HueSB from './phuesyncbox.js';

export default class HueLightsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const resource = Gio.Resource.load(GLib.build_filenamev([this.path, 'preferences.gresource']));
        Gio.resources_register(resource);

        window.set_default_size(860, 520);

        const tmpPage = new Adw.PreferencesPage();
        window.add(tmpPage);

        import('./prefspage.js').then((prefspage) => {
            window.remove(tmpPage);
            let hue = new Hue.Phue(true);
            let hueSB = new HueSB.PhueSyncBox(this.dir, {async: true});
            let prefs = new prefspage.PreferencesPage(
                hue,
                hueSB,
                this.metadata,
                this.dir,
                this.getSettings(),
                this.path
            );
            window.add(prefs);
        }).catch(err => {
            console.error(err.message);
            console.error(err.stack);
        });
    }
}
