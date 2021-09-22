'use strict';

/**
 * JavaScript class for showing window with colors and picking the color
 *
 * @author Václav Chlumský
 * @copyright Copyright 2021, Václav Chlumský.
 */

 /**
 * @license
 * The MIT License (MIT)
 *
 * Copyright (c) 2021 Václav Chlumský
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
const Params = imports.misc.params;
const PhueScreenshot = Me.imports.phuescreenshot;

const Gettext = imports.gettext.domain('hue-lights');
const _ = Gettext.gettext;

/**
 * ColorSelectorButton button.
 * 
 * @class ColorSelectorButton
 * @constructor
 * @return {Object} object
 */
var ColorSelectorButton = GObject.registerClass(
class ColorSelectorButton extends St.Bin {

    /**
     * ColorSelectorButton class initialization
     * 
     * @method _init
     * @private
     */
    _init(fileName, params) {
        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        params = Params.parse(params, {
            styleClass: '',
            reactive: true,
            buttonWidth: 256,
            buttonHeight: 256,
        });

        super._init({
            style_class: params.styleClass,
            reactive: params.reactive,
            width: params.buttonWidth * themeContext.scaleFactor,
            height: params.buttonHeight * themeContext.scaleFactor,
        });

        this.child = null;
        this.style = `background-image: url("${fileName}");`;

        this.screenshot = new PhueScreenshot.PhueScreenshot();
    }

    /**
     * Provides color under mouse pointer
     * 
     * @method getColor
     * @return {Object} RGB color
     */
    async getColor() {
        let [x, y] = global.get_pointer();
        let color = await this.screenshot.getColorPixel(x, y);

        return color;
    }
});

/**
 * ColorPickerBox class. Creates BoxLayout with color wheel.
 * 
 * @class ColorPicker
 * @constructor
 * @return {Object} object
 */
var ColorPickerBox =  GObject.registerClass({
    GTypeName: "ColorPickerBox",
    Signals: {
        'color-picked': {},
        'brightness-picked': {},
    }
}, class ColorPickerBox extends GObject.Object {

    /**
     * ColorPickerBox class initialization
     * 
     * @method _init
     * @private
     */
    _init(params) {
        params = Params.parse(params, {
            useColorWheel: true,
            useWhiteBox: true,
            showBrightness: false,
        });

        super._init();

        this._signals = {};
        this.slider = null;
        this.colorTemperature = 0;
        this.r = 0;
        this.g = 0;
        this.b = 0;
        this._useColorWheel = params.useColorWheel;
        this._useWhiteBox = params.useWhiteBox;
        this._showBrightness = params.showBrightness;
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
     * @method createColorBox
     * @return {Object} main box as BoxLayout
     */
     createColorBox() {

        let signal;

        let mainbox = new St.BoxLayout({vertical: true});
        this._centerObject(mainbox);

        if (this._useColorWheel) {
            let colorWheel =  new ColorSelectorButton(Me.dir.get_path() + '/media/color-wheel.svg');
            signal = colorWheel.connect(
                "button-press-event",
                async () => {
                    let color = await colorWheel.getColor();
                    this.r = color.red;
                    this.g = color.green;
                    this.b = color.blue;
                    this.colorTemperature = 0;
                    this.emit("color-picked");
                }
            );
            this._signals[signal] = { "object": colorWheel };
            this._centerObject(colorWheel);
            mainbox.add(colorWheel);

            if (this._useWhiteBox) {
                mainbox.add(new PopupMenu.PopupSeparatorMenuItem());
            }
        }

        if (this._useWhiteBox) {
            let whiteBox =  new ColorSelectorButton(
                Me.dir.get_path() + '/media/temperature-bar.svg',
                {
                    buttonWidth: 256,
                    buttonHeight: 32
                }
            );
            signal = whiteBox.connect(
                "button-press-event",
                async () => {

                    let color = await whiteBox.getColor();

                    this.r = color.red;
                    this.g = color.green;
                    this.b = color.blue;
                    let kelvin = 0;

                    kelvin = Utils.RGBToKelvin(this.r, this.g, this.b);

                    this.colorTemperature = kelvin;
                    this.emit("color-picked");
                }
            );
            this._signals[signal] = { "object": whiteBox };
            this._centerObject(whiteBox);
            mainbox.add(whiteBox);
        }

        if (this._showBrightness) {
            mainbox.add(new PopupMenu.PopupSeparatorMenuItem());

            /**
             * Brightness slider
             */
            this.slider = new Slider.Slider(0);
            signal = this.slider.connect("drag-end", this._brightnessEvent.bind(this));
            this._signals[signal] = { "object": this.slider };
            mainbox.add(this.slider);
        }

        return mainbox;
    }

    /**
     * Handler for picking brightness emrgbToHexStrits 'brightness-picked'
     *  
     * @method _brightnessEvent
     * @private
     */
    _brightnessEvent() {

        this.brightness = this.slider;

        this.emit("brightness-picked");
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
})

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
    _init(params) {
        params = Params.parse(params, {
            useColorWheel: true,
            useWhiteBox: true,
        });

        super._init();

        this._signals = {};
        let signal;

        this._dialogLayout = typeof this.dialogLayout === "undefined"
            ? this._dialogLayout
            : this.dialogLayout;

        this.colorTemperature = 0;
        this.r = 0;
        this.g = 0;
        this.b = 0;

        this.setButtons([{
            label: _("Finish"),
            action: () => {
                this._colorPickedFinish();
            },
            key: Clutter.Escape
        }]);

        this.colorPickerBox = new ColorPickerBox({
            useColorWheel: params.useColorWheel,
            useWhiteBox: params.useWhiteBox,
            showBrightness: true
        });

        signal = this.colorPickerBox.connect(
            "color-picked",
            () => {
                this.colorTemperature = this.colorPickerBox.colorTemperature;
                this.r = this.colorPickerBox.r;
                this.g = this.colorPickerBox.g;
                this.b = this.colorPickerBox.b;

                this.emit("color-picked");
            }
        );
        this._signals[signal] = { "object": this.colorPickerBox };

        signal = this.colorPickerBox.connect(
            "brightness-picked",
            () => {
                this.brightness = this.colorPickerBox.slider;

                this.emit("brightness-picked");
            }
        );
        this._signals[signal] = { "object": this.colorPickerBox };

        this.contentLayout.add(this.colorPickerBox.createColorBox());
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
     * OK button hides the dialog.
     * 
     * @method _onClose
     * @private
     * @param {object}
     * @param {object}
     */
    _colorPickedFinish() {

        this.colorPickerBox.disconnectSignals();
        this.emit("finish");
        this.disconnectSignals();
        this.destroy();
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
