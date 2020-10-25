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
const Slider = imports.ui.slider;
const PopupMenu = imports.ui.popupMenu;
const Gdk = imports.gi.Gdk;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const Gettext = imports.gettext;
const _ = Gettext.gettext;

const pallete = [
    ["#000000", "#000000", "#000000", "#003366", "#336699", "#3366CC", "#003399", "#000099", "#0000CC", "#000066", "#000000", "#000000", "#000000"],
    ["#000000", "#000000", "#006666", "#006699", "#0099CC", "#0066CC", "#0033CC", "#0000FF", "#3333FF", "#333399", "#000000", "#000000", "#000000"], /* odd */
    ["#000000", "#000000", "#669999", "#009999", "#33CCCC", "#00CCFF", "#0099FF", "#0066FF", "#3366FF", "#3333CC", "#666699", "#000000", "#000000"],
    ["#000000", "#339966", "#00CC99", "#00FFCC", "#00FFFF", "#33CCFF", "#3399FF", "#6699FF", "#6666FF", "#6600FF", "#6600CC", "#000000", "#000000"], /* odd */
    ["#000000", "#339933", "#00CC66", "#00FF99", "#66FFCC", "#66FFFF", "#66CCFF", "#99CCFF", "#9999FF", "#9966FF", "#9933FF", "#9900FF", "#000000"],
    ["#006600", "#00CC00", "#00FF00", "#66FF99", "#99FFCC", "#CCFFFF", "#CCCCFF", "#CC99FF", "#CC66FF", "#CC33FF", "#CC00FF", "#9900CC", "#000000"], /* odd */
    ["#003300", "#009933", "#33CC33", "#66FF66", "#99FF99", "#CCFFCC", "#FFFFFF", "#FFCCFF", "#FF99FF", "#FF66FF", "#FF00FF", "#CC00CC", "#660066"],
    ["#336600", "#009900", "#66FF33", "#99FF66", "#CCFF99", "#FFFFCC", "#FFCCCC", "#FF99CC", "#FF66CC", "#FF33CC", "#CC0099", "#993399", "#000000"], /* odd */
    ["#000000", "#333300", "#669900", "#99FF33", "#CCFF66", "#FFFF99", "#FFCC99", "#FF9999", "#FF6699", "#FF3399", "#CC3399", "#990099", "#000000"],
    ["#000000", "#666633", "#99CC00", "#CCFF33", "#FFFF66", "#FFCC66", "#FF9966", "#FF6666", "#FF0066", "#CC6699", "#993366", "#000000", "#000000"], /* odd */
    ["#000000", "#000000", "#999966", "#CCCC00", "#FFFF00", "#FFCC00", "#FF9933", "#FF6600", "#FF5050", "#CC0066", "#660033", "#000000", "#000000"],
    ["#000000", "#000000", "#996633", "#CC9900", "#FF9900", "#CC6600", "#FF3300", "#FF0000", "#CC0000", "#990033", "#000000", "#000000", "#000000"], /* odd */
    ["#000000", "#000000", "#000000", "#663300", "#996600", "#CC3300", "#993300", "#990000", "#800000", "#993333", "#000000", "#000000", "#000000"]
    ]

const whiteShades = [
    [2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600, 3800, 4000, 4200],
    [4400, 4600, 4800, 5000, 5200, 5400, 5600, 5800, 6000, 6200, 6400, 6500]
    ]

/**
 * ColorPicker class. Modal dialog for selecting colour.
 * 
 * @class ColorPicker
 * @constructor
 * @return {Object} modal dialog instance
 */
var ColorPicker =  GObject.registerClass({
    GTypeName: "ColorPicker",
    Signals: {
        'opened': {},
        'closed': {},
        'color-picked': {},
        'brightness-picked': {},
        'finish': {}
    }
}, class ColorPicker extends ModalDialog.ModalDialog {

    /**
     * ColorPicker class initialization
     *  
     * @method _init
     * @private
     */
    _init(params = {}) {
        super._init();

        this._dialogLayout = typeof this.dialogLayout === "undefined"
            ? this._dialogLayout
            : this.dialogLayout;

        this.slider = null;
        this.switchWhite = null;
        this.colorTemperature = 0;
        this.pickedcolor = 0;
        this.r = 0;
        this.g = 0;
        this.b = 0;

        this.setButtons([{
            label: _("Finish"),
            action: Lang.bind(this, this._colorPickedFinish),
            key: Clutter.Escape
        }]);

        this.contentLayout.add(this._createMainBox());
        this.brightness = this.slider;
    }

    /**
     * Sets attributes of a object to center.
     * @method _centerObject
     * @private
     * @param {Object} object with attributes to set to center
     */
    _centerObject(object) {
        object.x_align = Clutter.ActorAlign.CENTER;
        object.x_expand = false;
        object.y_align = Clutter.ActorAlign.CENTER;
        object.y_expand = false;
    }

    /**
     * Create main box with content
     * 
     * @method _createMainBox
     * @private
     * @return {object} main box as BoxLayout
     */
    _createMainBox() {

        let box;
        let label;
        let switchButton;
        let RGB = [0,0,0];

        let mainbox = new St.BoxLayout({vertical: true});
        this._centerObject(mainbox);

        /**
         * Grid with colors 
         */
        for (let i = 0; i < 13; i++) {

            box = new St.BoxLayout({vertical: false});
            this._centerObject(box);

            for (let j = 0; j < 13; j++) {
                if ( pallete[i][j] === "#000000") {
                    continue;
                }

                RGB = [
                    parseInt("0x" + pallete[i][j].slice(1, 3), 16),
                    parseInt("0x" + pallete[i][j].slice(3, 5), 16),
                    parseInt("0x" + pallete[i][j].slice(5, 7), 16)
                ];

                box.add(this._createRgbButton(RGB, 0));
            }

            mainbox.add(box);
        }

        mainbox.add(new PopupMenu.PopupSeparatorMenuItem());

        /**
         * Grid with temperatures of white
         */
        for (let i = 0; i < 2; i++) {

            box = new St.BoxLayout({vertical: false});
            this._centerObject(box);

            for (let j = 0; j < 12; j++) {

                RGB = Utils.kelvinToRGB(whiteShades[i][j]);
                box.add(this._createRgbButton(RGB, whiteShades[i][j]),);
            }

            mainbox.add(box);
        }

        box = new St.BoxLayout({vertical: false});
        this._centerObject(box);

        label = new St.Label({"text": _("Temperature of white:") });
        this._centerObject(label);
        box.add(label);

        this.switchWhite = new PopupMenu.Switch(true);

        switchButton = new St.Button({reactive: true, can_focus: true});
        this._centerObject(switchButton);
        switchButton.child = this.switchWhite;
        switchButton.connect("button-press-event",  Lang.bind(this, function() {
            this.switchWhite.toggle();
        }));

        box.add(switchButton);
        mainbox.add(box);

        mainbox.add(new PopupMenu.PopupSeparatorMenuItem());

        /**
         * Brightness slider
         */
        this.slider = new Slider.Slider(0);
        this.slider.connect("drag-end", this._brightnessEvent.bind(this));
        mainbox.add(this.slider);

        return mainbox;
    }
    /**
     * Create collored button
     *  
     * @method _createRgbButton
     * @private
     * @return {Object} New colored button
     */
    _createRgbButton(RGB, colorTemperature) {
        let colorButton;
        let colorHexStr;

        colorHexStr = this.rgbToHexStr(RGB);
        colorButton = new St.Button({
            style: `background-color: ${colorHexStr}; border-radius: 3px;`
        });

        colorButton.connect(
            "button-press-event",
            this._colorPickedEvent.bind(this, RGB, colorTemperature)
        );
        colorButton.set_size(20, 20);
        this._centerObject(colorButton);
        return colorButton;
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
     * Handler for picking colour emits 'color-picked'
     *  
     * @method _colorPickedEvent
     * @private
     * @param {Number} selected color
     * @param {Boolean} true if temperature of white
     */
    _colorPickedEvent(rgb, colorTemperature) {

        this.colorTemperature = colorTemperature;
        this.pickedcolor = rgb;
        /*let rgb = this.colorToRGB(color);*/

        this.r = rgb[0];
        this.g = rgb[1];
        this.b = rgb[2];

        this.emit("color-picked");
    }

    /**
     * Handler for picking brightness emits 'brightness-picked'
     *  
     * @method _brightnessEvent
     * @private
     */
    _brightnessEvent() {

        this.brightness = this.slider;

        this.emit("brightness-picked");
    }

    /**
     * OK button hides the dialog.
     *  
     * @method _onClose
     * @private
     * @param {object}
     * @param {object}
     */
    _colorPickedFinish() {

        this.emit("finish");
        this.destroy();
    }

    /**
     * Converts colour value to RGB
     * https://www.demmel.com/ilcd/help/16BitColorValues.htm
     * 
     * @method colorToRGB
     * @param {Number} color number
     * @return {Object} RGB array
     */
    color16btToRGB(hexValue) {

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
});
