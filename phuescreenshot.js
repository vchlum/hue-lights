'use strict';

/**
 * screenshot
 * JavaScript screenshot capturer.
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

const Screenshot = imports.ui.screenshot;
const Shell = imports.gi.Shell;
const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;

/**
 * PhueScreenshot class for taking screenshots
 *
 * @class PhueScreenshot
 * @constructor
 * @private
 * @return {Object} instance
 */
var PhueScreenshot =  GObject.registerClass({
    GTypeName: "PhueScreenshot",
}, class PhueScreenshot extends GObject.Object {

    _init(props={}) {
        super._init(props);
        this._screenshot = new Shell.Screenshot();
    }

    /**
     * Picks color of coordianets on screenshot
     * 
     * @method getColorPixel
     * @param {Number} x coordiante
     * @param {Number} y coordinate
     * @return {Object} color
     */
    getColorPixel(x, y) {
        return new Promise((resolve, reject) => {
            if (!this.pixelWithinScreen(x, y)) {
                let color = new Clutter.Color();
                color.red = 0;
                color.green = 0;
                color.blue = 0;
                color.alfa = 0;

                resolve(color);
                return;
            }

            try {
                this._screenshot.pick_color(x, y, (o, res) => {
                    let [ok, color] = this._screenshot.pick_color_finish(res);
                    if (ok) {
                        resolve(color);
                        return;
                    }

                    reject();
                });
            } catch(e) {
                logError(e, "Failed to get pixel from screenshot.");
            }
        });
    }

    pixelWithinScreen(x, y) {
        if (x < 0 || y < 0) {
            return false;
        }

        if (x > global.screen_width) {
            return false;
        }

        if (y > global.screen_height) {
            return false;
        }

        /* check if [x, y] is within any screen */
        let displaysNumber = global.display.get_n_monitors();
        for (let i = 0; i < displaysNumber; i++) {
            let monitorRectangle = global.display.get_monitor_geometry(i);
            if (monitorRectangle.x <= x &&
                x <= (monitorRectangle.x + monitorRectangle.width) &&
                monitorRectangle.y <= y &&
                y <= (monitorRectangle.y + monitorRectangle.height)) {

                return true;
            }
        }


        return false;
    }
});
    