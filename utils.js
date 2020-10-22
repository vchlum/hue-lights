'use strict';

/**
 * utils hue-lights
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

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gettext = imports.gettext;
const _ = Gettext.gettext;

var HUELIGHTS_SETTINGS_SCHEMA = "org.gnome.shell.extensions.hue-lights";
var HUELIGHTS_SETTINGS_BRIDGES = "bridges";
var HUELIGHTS_SETTINGS_BRIDGES_TYPE = "a{sa{ss}}";
var HUELIGHTS_SETTINGS_INDICATOR = "indicator-position";
var HUELIGHTS_SETTINGS_ZONESFIRST = "zones-first";
var HUELIGHTS_SETTINGS_SHOWSCENES = "show-scenes";

/**
 * Translations initialization.
 * 
 * @method initTranslations
 */
function initTranslations() {

    Gettext.textdomain(Me.metadata.uuid);
    Gettext.bindtextdomain(Me.metadata.uuid, Me.dir.get_child("locale").get_path());
}

/**
 * https://stackoverflow.com/questions/22564187/rgb-to-philips-hue-hsb 
 * https://github.com/PhilipsHue/PhilipsHueSDK-iOS-OSX/commit/f41091cf671e13fe8c32fcced12604cd31cceaf3 
 * https://developers.meethue.com/develop/application-design-guidance/color-conversion-formulas-rgb-to-xy-and-back/#Color-rgb-to-xy
 */
function getRGBtoHueXY(cred, cgreen, cblue) {
    // For the hue bulb the corners of the triangle are:
    // -Red: 0.675, 0.322
    // -Green: 0.4091, 0.518
    // -Blue: 0.167, 0.04
    let normalizedToOne = [];
    let red;
    let green
    let blue;

    normalizedToOne[0] = (cred / 255);
    normalizedToOne[1] = (cgreen / 255);
    normalizedToOne[2] = (cblue / 255);


    // Make red more vivid
    if (normalizedToOne[0] > 0.04045) {
        red = Math.pow(
                (normalizedToOne[0] + 0.055) / (1.0 + 0.055), 2.4);
    } else {
        red = (normalizedToOne[0] / 12.92);
    }

    // Make green more vivid
    if (normalizedToOne[1] > 0.04045) {
        green = Math.pow((normalizedToOne[1] + 0.055)
                / (1.0 + 0.055), 2.4);
    } else {
        green = (normalizedToOne[1] / 12.92);
    }

    // Make blue more vivid
    if (normalizedToOne[2] > 0.04045) {
        blue = Math.pow((normalizedToOne[2] + 0.055)
                / (1.0 + 0.055), 2.4);
    } else {
        blue = (normalizedToOne[2] / 12.92);
    }

    let X = (red * 0.649926 + green * 0.103455 + blue * 0.197109);
    let Y = (red * 0.234327 + green * 0.743075 + blue * 0.022598);
    let Z = (red * 0.0000000 + green * 0.053077 + blue * 1.035763);

    let x = X / (X + Y + Z);
    let y = Y / (X + Y + Z);

    let xy = [];
    xy[0] = x;
    xy[1] = y;

    return xy;
}