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
const Gdk = imports.gi.Gdk;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

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

/* https://andi-siess.de/rgb-to-color-temperature/ */
const kelvin_table = {
    1000: [255, 56, 0],
    1100: [255, 71, 0],
    1200: [255, 83, 0],
    1300: [255, 93, 0],
    1400: [255, 101, 0],
    1500: [255, 109, 0],
    1600: [255, 115, 0],
    1700: [255, 121, 0],
    1800: [255, 126, 0],
    1900: [255, 131, 0],
    2000: [255, 138, 18],
    2100: [255, 142, 33],
    2200: [255, 147, 44],
    2300: [255, 152, 54],
    2400: [255, 157, 63],
    2500: [255, 161, 72],
    2600: [255, 165, 79],
    2700: [255, 169, 87],
    2800: [255, 173, 94],
    2900: [255, 177, 101],
    3000: [255, 180, 107],
    3100: [255, 184, 114],
    3200: [255, 187, 120],
    3300: [255, 190, 126],
    3400: [255, 193, 132],
    3500: [255, 196, 137],
    3600: [255, 199, 143],
    3700: [255, 201, 148],
    3800: [255, 204, 153],
    3900: [255, 206, 159],
    4000: [255, 209, 163],
    4100: [255, 211, 168],
    4200: [255, 213, 173],
    4300: [255, 215, 177],
    4400: [255, 217, 182],
    4500: [255, 219, 186],
    4600: [255, 221, 190],
    4700: [255, 223, 194],
    4800: [255, 225, 198],
    4900: [255, 227, 202],
    5000: [255, 228, 206],
    5100: [255, 230, 210],
    5200: [255, 232, 213],
    5300: [255, 233, 217],
    5400: [255, 235, 220],
    5500: [255, 236, 224],
    5600: [255, 238, 227],
    5700: [255, 239, 230],
    5800: [255, 240, 233],
    5900: [255, 242, 236],
    6000: [255, 243, 239],
    6100: [255, 244, 242],
    6200: [255, 245, 245],
    6300: [255, 246, 247],
    6400: [255, 248, 251],
    6500: [255, 249, 253],
    6600: [254, 249, 255],
    6700: [252, 247, 255],
    6800: [249, 246, 255],
    6900: [247, 245, 255],
    7000: [245, 243, 255],
    7100: [243, 242, 255],
    7200: [240, 241, 255],
    7300: [239, 240, 255],
    7400: [237, 239, 255],
    7500: [235, 238, 255],
    7600: [233, 237, 255],
    7700: [231, 236, 255],
    7800: [230, 235, 255],
    7900: [228, 234, 255],
    8000: [227, 233, 255],
    8100: [225, 232, 255],
    8200: [224, 231, 255],
    8300: [222, 230, 255],
    8400: [221, 230, 255],
    8500: [220, 229, 255],
    8600: [218, 229, 255],
    8700: [217, 227, 255],
    8800: [216, 227, 255],
    8900: [215, 226, 255],
    9000: [214, 225, 255],
    9100: [212, 225, 255],
    9200: [211, 224, 255],
    9300: [210, 223, 255],
    9400: [209, 223, 255],
    9500: [208, 222, 255],
    9600: [207, 221, 255],
    9700: [207, 221, 255],
    9800: [206, 220, 255],
    9900: [205, 220, 255],
    10000: [207, 218, 255],
    10100: [207, 218, 255],
    10200: [206, 217, 255],
    10300: [205, 217, 255],
    10400: [204, 216, 255],
    10500: [204, 216, 255],
    10600: [203, 215, 255],
    10700: [202, 215, 255],
    10800: [202, 214, 255],
    10900: [201, 214, 255],
    11000: [200, 213, 255],
    11100: [200, 213, 255],
    11200: [199, 212, 255],
    11300: [198, 212, 255],
    11400: [198, 212, 255],
    11500: [197, 211, 255],
    11600: [197, 211, 255],
    11700: [197, 210, 255],
    11800: [196, 210, 255],
    11900: [195, 210, 255],
    12000: [195, 209, 255]}

const white_shades = [
    [1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3500],
    [3800, 4400, 4800, 5200, 5600, 6000, 7000, 9000, 10500, 12000]
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
    Signals: {'opened': {}, 'closed': {}, 'color-picked': {}, 'brightness-picked': {}, 'finish': {} }
}, class ColorPicker extends ModalDialog.ModalDialog {

    /**
     * ColorPicker class initialization
     *  
     * @method _init
     * @private
     */
    _init(params = {}) {
        super._init();

        this.slider = null;

        this._dialogLayout = typeof this.dialogLayout === "undefined"
            ? this._dialogLayout
            : this.dialogLayout;

        this.brightness = null;
        this.colorTemperature = 0;
        this.pickedcolor = 0;
        this.r = 0;
        this.g = 0;
        this.b = 0;

        this.setButtons([{ label: _("Finish"), action: Lang.bind(this, this._colorPickedFinish), key: Clutter.Escape}]);

        let mainbox = new St.BoxLayout({vertical: true});

        this.contentLayout.add(mainbox);

        let box;
        let RGB = [0,0,0];

        for (let i = 0; i < 13; i++) {

            box = new St.BoxLayout({vertical: false});

            for (let j = 0; j < 13; j++) {
                if ( pallete[i][j] === "#000000") {
                    continue;
                }

                RGB = [parseInt("0x" + pallete[i][j].slice(1, 3), 16), parseInt("0x" + pallete[i][j].slice(3, 5), 16), parseInt("0x" + pallete[i][j].slice(5, 7), 16)];

                box.add(this._createRgbButton(RGB, 0), { expand: false,
                    x_fill: false,
                    x_align: St.Align.MIDDLE,
                    y_fill: false,
                    y_align: St.Align.MIDDLE });
            }

            mainbox.add(box, {x_fill: false, x_align: St.Align.MIDDLE});
        }

        for (let i = 0; i < 2; i++) {

            box = new St.BoxLayout({vertical: false});

            for (let j = 0; j < 10; j++) {

                RGB = kelvin_table[white_shades[i][j]];

                box.add(this._createRgbButton(RGB, white_shades[i][j]), { expand: false,
                    x_fill: false,
                    x_align: St.Align.MIDDLE,
                    y_fill: false,
                    y_align: St.Align.MIDDLE });
            }

            mainbox.add(box, {x_fill: false, x_align: St.Align.MIDDLE});
        }

        this.slider = new Slider.Slider(0);
        this.slider.connect("drag-end", this._brightnessEvent.bind(this));
        mainbox.add(this.slider);
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

        colorButton.connect("button-press-event", this._colorPickedEvent.bind(this, RGB, colorTemperature));
        colorButton.set_size(20, 20);

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

        let help_width = Math.round(translator_width * 0.9);
        let help_height = Math.round(translator_height * 0.9);
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
