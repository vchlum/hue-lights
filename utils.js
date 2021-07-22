'use strict';

/**
 * utils hue-lights
 * JavaScript Gnome extension for Philips Hue lights and bridges.
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

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Config = imports.misc.config;

const Gettext = imports.gettext;
const _ = Gettext.gettext;

var HUELIGHTS_SETTINGS_SCHEMA = "org.gnome.shell.extensions.hue-lights";
var HUELIGHTS_SETTINGS_BRIDGES = "bridges";
var HUELIGHTS_SETTINGS_BRIDGES_TYPE = "a{sa{ss}}";
var HUELIGHTS_SETTINGS_INDICATOR = "indicator-position";
var HUELIGHTS_SETTINGS_ZONESFIRST = "zones-first";
var HUELIGHTS_SETTINGS_SHOWSCENES = "show-scenes";
var HUELIGHTS_SETTINGS_COMPACTMENU = "compact-menu";
var HUELIGHTS_SETTINGS_COMPACTMENU_REMEMBER_OPENED = "compact-menu-remember-opened";
var HUELIGHTS_SETTINGS_CONNECTION_TIMEOUT = "connection-timeout";
var HUELIGHTS_SETTINGS_DEBUG = "debug";
var HUELIGHTS_SETTINGS_NOTIFY_LIGHTS = "notify-lights";
var HUELIGHTS_SETTINGS_NOTIFY_LIGHTS_TYPE = "a{sa{si}}";
var HUELIGHTS_SETTINGS_ICONPACK = "icon-pack";
var HUELIGHTS_SETTINGS_ENTERTAINMENT = "entertainment";
var HUELIGHTS_SETTINGS_ENTERTAINMENT_TYPE = "a{sa{si}}";

/**
 * https://developers.meethue.com/develop/hue-api/supported-devices/
 * https://zigbee.blakadder.com/all.html
 * https://compatibility.jeedom.com/index.php?v=d&p=home&search=&lang=en_US
 */
var getHueIconFile = {
    "HML004": "archetypesWallShade",
    "HML006": "archetypesRecessedCeiling",
    "LCA001": "bulbsSultan",
    "LCA002": "bulbsSultan",
    "LCA003": "bulbsSultan",
    "LCB001": "bulbFlood",
    "LCC001": "archetypesCeilingRound",
    "LCD001": "archetypesRecessedCeiling",
    "LCD002": "archetypesRecessedCeiling",
    "LCE001": "bulbCandle",
    "LCE002": "bulbCandle",
    "LCF001": "archetypesBollard",
    "LCF002": "archetypesBollard",
    "LCF005": "archetypesBollard",
    "LCG002": "bulbsSpot",
    "LCL001": "heroesLightstrip",
    "LCL002": "heroesLightstrip",
    "LCL003": "heroesLightstrip",
    "LCP003": "archetypesWallLantern",
    "LCS001": "archetypesFloorSpot",
    "LCT001": "bulbsSultan",
    "LCT002": "bulbFlood",
    "LCT003": "bulbsSpot",
    "LCT007": "bulbsSultan",
    "LCT010": "bulbsSultan",
    "LCT011": "bulbFlood",
    "LCT012": "bulbCandle",
    "LCT014": "bulbsSultan",
    "LCT015": "bulbsSultan",
    "LCT016": "bulbsSultan",
    "LCT024": "heroesHueplay",
    "LCT026": "heroesHuego",
    "LCW001": "archetypesWallShade",
    "LCW002": "archetypesWallShade",
    "LCX001": "heroesLightstrip",
    "LDD001": "archetypesTableShade",
    "LDD002": "archetypesRecessedFloor",
    "LDF001": "archetypesRecessedCeiling",
    "LDF002": "archetypesWallShade",
    "LDT001": "archetypesRecessedCeiling",
    "LFF001": "archetypesRecessedFloor",
    "LLC005": "heroesBloom",
    "LLC006": "heroesIris",
    "LLC007": "heroesBloom",
    "LLC010": "heroesIris",
    "LLC011": "heroesBloom",
    "LLC012": "heroesBloom",
    "LLC013": "archetypesTableWash",
    "LLC014": "heroesBloom",
    "LLC020": "heroesHuego",
    "LLM001": "archetypesPendantRound",
//    "LLM010": "",
//    "LLM011": "",
//    "LLM012": "",
    "LOM001": "devicesPlug",
    "LOM002": "devicesPlug",
    "LOM003": "devicesPlug",
    "LOM005": "devicesPlug",
    "LOM004": "devicesPlug",
    "LOM006": "devicesPlug",
    "LST001": "heroesLightstrip",
    "LST002": "heroesLightstrip",
    "LST003": "heroesLightstrip",
    "LST004": "heroesLightstrip",
    "LTA001": "bulbsSultan",
    "LTA002": "bulbsSultan",
    "LTA003": "bulbsSultan",
    "LTB002": "bulbFlood",
    "LTC001": "archetypesRecessedCeiling",
    "LTC002": "archetypesRecessedCeiling",
    "LTC003": "archetypesRecessedCeiling",
    "LTC004": "archetypesRecessedCeiling",
    "LTC011": "archetypesRecessedCeiling",
    "LTC012": "archetypesRecessedCeiling",
    "LTC013": "archetypesCeilingSquare",
    "LTC014": "archetypesCeilingSquare",
    "LTC015": "archetypesCeilingSquare",
    "LTC016": "archetypesCeilingRound",
    "LTC021": "archetypesRecessedCeiling",
    "LTD001": "archetypesRecessedCeiling",
    "LTD002": "archetypesRecessedCeiling",
    "LTD003": "archetypesPendantRound",
    "LTD009": "archetypesRecessedCeiling",
    "LTD010": "archetypesRecessedCeiling",
    "LTD011": "archetypesRecessedFloor",
    "LTE002": "bulbCandle",
    "LTF001": "archetypesRecessedCeiling",
    "LTF002": "archetypesRecessedCeiling",
    "LTG001": "bulbsSpot",
    "LTG002": "bulbsSpot",
    "LTP001": "archetypesPendantRound",
    "LTP002": "archetypesPendantRound",
    "LTP003": "archetypesPendantRound",
    "LTP004": "archetypesPendantRound",
    "LTP005": "archetypesPendantRound",
    "LTP007": "archetypesPendantRound",
    "LTP008": "archetypesPendantRound",
    "LTP011": "archetypesPendantRound",
    "LTT001": "archetypesTableShade",
    "LTW001": "bulbsSultan",
    "LTW004": "bulbsSultan",
    "LTW010": "bulbsSultan",
    "LTW011": "bulbFlood",
    "LTW012": "bulbCandle",
    "LTW013": "bulbsSpot",
    "LTW014": "bulbsSpot",
    "LTW015": "bulbsSultan",
    "LTW017": "archetypesWallLantern",
    "LWA001": "bulbsSultan",
    "LWA002": "bulbsSultan",
    "LWA003": "bulbsSultan",
    "LWA004": "bulbsFilament",
    "LWA005": "bulbsFilament",
    "LWA007": "bulbsSultan",
    "LWA008": "bulbsSultan",
    "LWA009": "bulbsSultan",
    "LWA010": "bulbsSultan",
    "LWA011": "bulbsSultan",
    "LWB004": "bulbsSultan",
    "LWB006": "bulbsClassic",
    "LWB007": "bulbsClassic",
    "LWB010": "bulbsClassic",
    "LWB014": "bulbsClassic",
    "LWB015": "bulbsClassic",
    "LWB022": "bulbFlood",
    "LWE001": "bulbCandle",
    "LWE002": "bulbCandle",
    "LWF002": "bulbsClassic",
    "LWG001": "bulbsSpot",
    "LWG004": "bulbsSpot",
    "LWO001": "bulbsFilament",
    "LWO003": "bulbsFilament",
    "LWU001": "bulbsClassic",
    "LWV001": "bulbsFilament",
    "LWV002": "bulbsFilament",
    "LWW001": "archetypesWallShade",
    "LWW003": "bulbsSultan",
//    "MWM001": "",
//    "ROM001": "", /* smart button */
    "RWL020": "devicesDimmerswitch",
    "RWL021": "devicesDimmerswitch",
    "RWL022": "devicesDimmerswitch",
    "SML001": "devicesMotionSensor",
    "SML002": "devicesOutdoorMotionSensor",
    "SWT001": "devicesTap",

    "Downstairs": "zonesAreasGroundfloor",
    "Upstairs": "zonesAreasFirstfloor",
    "Top floor": "zonesAreasSecondfloor",
    "Attic": "roomsAttic",
    "Home": "tabbarHome",
    "Gym": "roomsGym",
    "Lounge": "roomsLounge",
    "TV": "otherWatchingMovie",
    "Computer": "roomsComputer",
    "Recreation": "roomsRecreation",
    "Man cave": "roomsMancave",
    "Music": "otherMusic",
    "Reading": "otherReading",
    "Studio": "roomsStudio",
    "Living room": "roomsLiving",
    "Kitchen": "roomsKitchen",
    "Dining": "roomsDining",
    "Bedroom": "roomsBedroom",
    "Kids bedroom": "roomsKidsbedroom",
    "Bathroom": "roomsBathroom",
    "Nursery": "roomsNursery",
    "Office": "roomsOffice",
    "Toilet": "roomsToilet",
    "Staircase": "roomsStaircase",
    "Hallway": "roomsHallway",
    "Laundry room": "roomsLaundryroom",
    "Storage": "roomsStorage",
    "Closet": "roomsCloset",
    "Garage": "roomsGarage",
    "Other": "roomsOther",
    "Garden": "roomsOutdoor",
    "Terrace": "roomsTerrace",
    "Balcony": "roomsBalcony",
    "Driveway": "roomsDriveway",
    "Carport": "roomsCarport",
    "Front door": "roomsFrontdoor",
    "Porch": "roomsPorch",
    "Barbecue": "roomsOutdoorSocialtime",
    "Pool": "roomsPool"
};

var entertainmentMode = {
    DISPLAYN: 0,
    SYNC: 1,
    SELECTION: 2,
    CURSOR: 3,
    RANDOM: 4
};

var entertainmentModeText = {
    0: _("Display"),
    1: _("Sync screen"),
    2: _("Sync selection"),
    3: _("Track cursor"),
    4: _("Random")
};

var debug = false;

/**
 * Check gnome version
 *
 * @method isGnome40
 * @return {Boolean} true if Gnome 40
 */
 function isGnome40() {
    if (parseInt(Config.PACKAGE_VERSION) >= 40) {
        return true;
    }

    return false;
}

/**
 * Logs debug message
 *
 * @method logDebug
 * @param {String} meassage to print
 */
function logDebug(msg) {
    if (debug) {
        log(`Hue Lights (debug): ${msg}`)
    }
}

/**
 * Converts Philips Hue colour temperature of white to
 * kelvin temperature (2000K - 6500K).
 * Lights are capable of 153 (6500K) to 500 (2000K).
 * https://developers.meethue.com/develop/hue-api/lights-api/
 * https://developers.meethue.com/forum/t/about-the-ct-value/6239/4
 * 
 * @method ctToKelvin
 * @param {Number} ct
 * @return {Number} temperature in kelvin
 */
function ctToKelvin(ct) {

    if (ct < 153) {ct = 153;}
    if (ct > 500) {ct = 500;}

    return Math.round(6500 - ((ct - 153) / (347 / 4500)));
}

/**
 * Converts kelvin temperature (2000K - 6500K) to
 * Philips Hue colour temperature of white.
 * Lights are capable of 153 (6500K) to 500 (2000K).
 * https://developers.meethue.com/develop/hue-api/lights-api/
 * https://developers.meethue.com/forum/t/about-the-ct-value/6239/4
 * 
 * @method kelvinToCt
 * @param {Number} k temperature in kelvin
 * @return {Number} ct
 */
function kelvinToCt(k) {

    if (k < 2000) {k = 2000;}
    if (k > 6500) {k = 6500;}

    return Math.round(500 - ((k - 2000) / (4500 / 347)));
}

/**
 * Converts kelvin temperature to RGB
 * https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html
 * 
 * @method kelvinToRGB
 * @param {Number} kelvin in temperature
 * @return {Object} array with [R, G, B]
 */
function kelvinToRGB(kelvin) {
    let tmpCalc = 0;
    let tmpKelvin = kelvin;
    let red = 0;
    let green = 0;
    let blue = 0;

    if (tmpKelvin < 1000) {
        tmpKelvin = 1000;
    }

    if (tmpKelvin > 40000) {
        tmpKelvin = 40000;
    }

    tmpKelvin = tmpKelvin / 100;

    if (tmpKelvin <= 66) {
        red = 255;
    } else {
        tmpCalc = tmpKelvin - 60;
        tmpCalc = 329.698727446 * Math.pow(tmpCalc, -0.1332047592);

        red = tmpCalc;
        if (red < 0) {red = 0;}
        if (red > 255) {red = 255;}
    }

    if (tmpKelvin <= 66) {
        tmpCalc = tmpKelvin;
        tmpCalc = 99.4708025861 * Math.log(tmpCalc) - 161.1195681661;

        green = tmpCalc;
        if (green < 0) {green = 0;}
        if (green > 255) {green = 255;}
    } else {
        tmpCalc = tmpKelvin - 60;
        tmpCalc = 288.1221695283 * Math.pow(tmpCalc, -0.0755148492);

        green = tmpCalc;
        if (green < 0) {green = 0;}
        if (green > 255) {green = 255;}
    }

    if (tmpKelvin >= 66) {
        blue = 255;
    } else if (tmpKelvin <=19) {
        blue = 0;
    } else {
        tmpCalc = tmpKelvin - 10;
        tmpCalc = 138.5177312231 * Math.log(tmpCalc) - 305.0447927307;

        blue = tmpCalc;
        if (blue < 0) {blue = 0;}
        if (blue > 255) {blue = 255;}
    }

    return [Math.round(red), Math.round(green), Math.round(blue)];
}

/**
 * Converts RGB to the closest kelvin in table
 * 
 * @method RGBToKelvin
 * @param {Number} red
 * @param {Number} green
 * @param {Number} blue
 * @return {Object} kelvin in temperature
 */
function RGBToKelvin(r, g, b) {
    let selectR = -1;
    let selectG = -1;
    let selectB = -1;
    let difference;

    /**
     * https://andi-siess.de/rgb-to-color-temperature/
     * RGB values are 2200-9200, relative temperature
     * is 2200-6500, which is suitable for the devices.
     */

    const whiteTemeratures = {
        2200: [255,147,44],
        2339: [255,154,57],
        2478: [255,161,70],
        2617: [255,167,84],
        2756: [255,174,97],
        2895: [255,181,110],
        3034: [255,188,123],
        3173: [255,194,136],
        3312: [255,201,150],
        3451: [255,208,163],
        3590: [255,215,176],
        3729: [255,221,189],
        3868: [255,228,202],
        4007: [255,235,215],
        4146: [255,242,227],
        4285: [255,248,242],
        4419: [255,255,255],
        4554: [252,253,255],
        4693: [249,251,255],
        4832: [246,249,255],
        4971: [243,247,255],
        5110: [240,245,255],
        5249: [237,243,255],
        5388: [234,241,255],
        5527: [232,239,255],
        5666: [229,236,255],
        5805: [226,234,255],
        5944: [223,232,255],
        6083: [220,230,255],
        6222: [217,228,255],
        6361: [214,226,255],
        6500: [211,224,255]
    }

    difference = 255;
    for (let i in whiteTemeratures) {
        let tmp = r - whiteTemeratures[i][0];
        if (tmp < 0) { tmp = tmp * -1; }

        if (tmp < difference) {
            difference = tmp;
            selectR = whiteTemeratures[i][0];
        }
    }

    difference = 255;
    for (let i in whiteTemeratures) {
        if (whiteTemeratures[i][0] !== selectR) {
            continue;
        }

        let tmp = g - whiteTemeratures[i][1];
        if (tmp < 0) { tmp = tmp * -1; }

        if (tmp < difference) {
            difference = tmp;
            selectG = whiteTemeratures[i][1];
        }
    }

    difference = 255;
    for (let i in whiteTemeratures) {
        if (whiteTemeratures[i][0] !== selectR) {
            continue;
        }

        if (whiteTemeratures[i][1] !== selectG) {
            continue;
        }

        let tmp = b - whiteTemeratures[i][2];
        if (tmp < 0) { tmp = tmp * -1; }

        if (tmp < difference) {
            difference = tmp;
            selectB = whiteTemeratures[i][2];
        }
    }

    for (let i in whiteTemeratures) {
        if (whiteTemeratures[i][0] !== selectR) {
            continue;
        }

        if (whiteTemeratures[i][1] !== selectG) {
            continue;
        }

        if (whiteTemeratures[i][2] !== selectB) {
            continue;
        }

        return i;
    }

    return 0;
}

/**
 * Converts RGB to xy values for Philips Hue Lights.
 * https://stackoverflow.com/questions/22564187/rgb-to-philips-hue-hsb 
 * https://github.com/PhilipsHue/PhilipsHueSDK-iOS-OSX/commit/f41091cf671e13fe8c32fcced12604cd31cceaf3 
 * https://developers.meethue.com/develop/application-design-guidance/color-conversion-formulas-rgb-to-xy-and-back/#Color-rgb-to-xy
 * 
 * @method colorToHueXY
 * @param {Number} red
 * @param {Number} green
 * @param {Number} blue
 * @return {Object} array with [x, y]
 */
function colorToHueXY(cred, cgreen, cblue) {
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

/**
 * Convert xy and brightness to RGB
 * https://stackoverflow.com/questions/22894498/philips-hue-convert-xy-from-api-to-hex-or-rgb
 * https://stackoverflow.com/questions/16052933/convert-philips-hue-xy-values-to-hex
 *
 * @param {Number} x
 * @param {Number} y
 * @param {Number} bri
 * @return {Object} array with RGB
 */
function XYBriToColor(x, y, bri) {
    let z = 1.0 - x - y;
    let Y = bri / 255.0;
    let X = (Y / y) * x;
    let Z = (Y / y) * z;

    let r = X * 1.612 - Y * 0.203 - Z * 0.302;
    let g = -X * 0.509 + Y * 1.412 + Z * 0.066;
    let b = X * 0.026 - Y * 0.072 + Z * 0.962;

    r = r <= 0.0031308 ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, (1.0 / 2.4)) - 0.055;
    g = g <= 0.0031308 ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, (1.0 / 2.4)) - 0.055;
    b = b <= 0.0031308 ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, (1.0 / 2.4)) - 0.055;

    let maxValue = Math.max(r,g,b);

    r /= maxValue;
    g /= maxValue;
    b /= maxValue;

     /* do not know why thay have if (r < 0) { r = 255 }; this works better */
    r = r * 255; if (r < 0) { r *= -1 };
    g = g * 255; if (g < 0) { g *= -1 };
    b = b * 255; if (b < 0) { b *= -1 };

    if (r > 255) { r = 0 };
    if (g > 255) { g = 0 };
    if (b > 255) { b = 0 };

    r = Math.round(r);
    g = Math.round(g);
    b = Math.round(b);

    return [r, g, b];
}
