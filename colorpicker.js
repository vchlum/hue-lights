'use strict';

/**
 * JavaScript class for showing window with colors and picking the color
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

const St = imports.gi.St;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const ModalDialog = imports.ui.modalDialog;
const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var ColorPicker =  GObject.registerClass({
    GTypeName: "ColorPicker",
    Signals: {'opened': {}, 'closed': {}, 'color-picked': {}}
    },

    /**
     * ColorPicker class. Modal dialog for selecting colour.
     * 
     * @class ColorPicker
     * @constructor
     * @return {Object} modal dialog instance
     */
    class ColorPicker extends ModalDialog.ModalDialog {

        /**
         * ColorPicker class initialization
         *  
         * @method _init
         * @private
         */
        _init(params = {}) {
            super._init({
                styleClass: 'confirm-dialog'
            });

            this._dialogLayout = typeof this.dialogLayout === "undefined"
                ? this._dialogLayout
                : this.dialogLayout;

            this.pickedcolor = 0;
            this.r = 0;
            this.g = 0;
            this.b = 0;
    
            this.setButtons([{ label: "OK", action: Lang.bind(this, this._onClose), key: Clutter.Escape}]);
    
            let mainbox = new St.BoxLayout({ vertical: false});
            this.contentLayout.add(mainbox);

   
            let colorButton;
            let colorHexStr;
            let box;
            let rnd;

            for (let i = 0; i < 16; i = i + 1) {
                box = new St.BoxLayout({vertical: true});

                for (let j = 0; j < 16; j = j + 1 ) {

                    rnd = Math.floor(Math.random() * Math.floor(65536))
                    colorHexStr = this.rgbToHexStr(this.colorToRGB(rnd));    
                    colorButton = new St.Button({
                        style: `background-color: ${colorHexStr}; border-radius: 3px;`
                    });
        
                    colorButton.connect("button-press-event", this._colorPickedEvent.bind(this, rnd));
                    colorButton.set_size(20, 20);
                    
                    box.add(colorButton);
                }
    
                mainbox.add(box);
            }
        }

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
    
            let help_width = Math.round(translator_width * 0.9);
            let help_height = Math.round(translator_height * 0.9);
            this._dialogLayout.set_width(help_width);
            this._dialogLayout.set_height(help_height);
            this._dialogLayout.set_x(0);
            this._dialogLayout.set_y(0);
        }

        /**
         * Handler for picking colour emits 'color-picked'
         *  
         * @method _colorPickedEvent
         * @private
         * @param {Number} selected color
         */
        _colorPickedEvent(color) {

            this.pickedcolor = color;
            let rgb = this.colorToRGB(color);

            this.r = rgb[0];
            this.g = rgb[1];
            this.b = rgb[2];

            this.emit("color-picked");
        }

        /**
         * OK button hides the dialog.
         *  
         * @method _onClose
         * @private
         * @param {object}
         * @param {object}
         */
        _onClose(button, event) {

            this.hide();
        }

        /**
         * Converts colour value to RGB
         *  
         * @method colorToRGB
         * @param {Number} color number
         * @return {Object} RGB array
         */
        colorToRGB(hexValue) {

            let r = (hexValue & 0xF800) >> 11;
            let g = (hexValue & 0x07E0) >> 5;
            let b = hexValue & 0x001F;
    
            r = (r * 255) / 31;
            g = (g * 255) / 63;
            b = (b * 255) / 31;
    
            return [r, g, b];
        }

        /**
         * Converts RGB to hex string
         *  
         * @method rgbToHexStr
         * @param {Object} array on numbers: [r, g, b]
         * @return {String} RGB string
         */
        rgbToHexStr(rgb) {

            let r = rgb[0];
            let g = rgb[1];
            let b = rgb[2];
    
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }
    }
);
