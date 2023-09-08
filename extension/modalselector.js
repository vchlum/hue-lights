'use strict';

/**
 * JavaScript class for showing options in modal dialog.
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

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Params from 'resource:///org/gnome/shell/misc/params.js';
import * as Utils from './utils.js';
import {Extension, gettext} from 'resource:///org/gnome/shell/extensions/extension.js';

const __ = gettext;

/**
 * ModalSelector class. Modal dialog for selecting an option.
 * 
 * @class ModalSelector
 * @constructor
 * @return {Object} modal dialog instance
 */
 export const ModalSelector =  GObject.registerClass({
    GTypeName: "ModalSelector",
    Signals: {
        'selected': {},
        'canceled': {}
    }
}, class ModalSelector extends ModalDialog.ModalDialog {
    /**
     * ColorPicker class initialization
     * 
     * @method _init
     * @private
     */
     _init(settings, params) {
        params = Params.parse(params, {
            label: "",
            options: {},
        });

        super._init();

        this._ = Utils.checkGettextEnglish(__, settings);

        let label;
        let button;
        let signal;
        this._signals = {};
        this.result = null;

        this._dialogLayout = typeof this.dialogLayout === "undefined"
            ? this._dialogLayout
            : this.dialogLayout;

        this.setButtons([{
            label: this._("Cancel"),
            action: () => {
                this.emit("canceled");
                this.disconnectSignals();
                this.destroy();
            },
            key: Clutter.Escape
        }]);

        if (params.label.length > 0) {
            label = new St.Label();
            label.text = params.label;
            label.set_x_expand(true);
            this.contentLayout.add(label);
        }

        for (let i in params.options) {

            label = new St.Label();
            label.text = params.options[i];
            label.set_x_expand(true);

            button = new St.Button({reactive: true, can_focus: true});
            button.set_x_align(Clutter.ActorAlign.CENTER);
            button.set_x_expand(true);
            button.child = label;

            signal = button.connect(
                "button-press-event",
                () => {

                    this.result = i;
                    this.emit("selected");
                    this.disconnectSignals();
                    this.destroy();
                }
            );
            this._signals[signal] = button;

            this.contentLayout.add(button);
        }
    }

    /**
     * Relocate modal dialog
     *
     * @method newPosition
     */
        newPosition() {

        let width_percents = 100;
        let height_percents = 100;
        let primary = Main.layoutManager.primaryMonitor;

        let translator_width = Math.round(
            (primary.width / 100) * width_percents
        );
        let translator_height = Math.round(
            (primary.height / 100) * height_percents
        );

        let help_width = Math.round(translator_width * 1);
        let help_height = Math.round(translator_height * 1);
        this._dialogLayout.set_width(help_width);
        this._dialogLayout.set_height(help_height);
    }

    /**
     * Disconect signals
     * 
     * @method disconnectSignals
     * @param {Boolean} disconnect all
     */
     disconnectSignals() {
        for (let id in this._signals) {
            try {
                this._signals[id]["object"].disconnect(id);
                delete(this._signals[id]);
            } catch {
                continue;
            }
        }
    }
});