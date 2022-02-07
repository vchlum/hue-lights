'use strict';

/**
 * areaselector
 * JavaScript library for Selection area on screen.
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

const GObject = imports.gi.GObject;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

/**
 * AreaSelector class for selection area on screen.
 *
 * @class AreaSelector
 * @constructor
 * @private
 * @return {Object} instance
 */
 var AreaSelector =  GObject.registerClass({
    GTypeName: "AreaSelector",
    Signals: {
        "area-selected": {},
        "area-canceled": {}
    }
}, class AreaSelector extends GObject.Object {

    /**
     * AreaSelector class initialization
     * 
     * @method _init
     * @private
     */
    _init(params) {

        super._init();

        this._mouseDown = false;
        this._shellGlobal = Shell.Global.get();

        this._container = new St.Widget({
            name: "area-selector",
            style: 'background-color: #4A90D9; border: 1px solid #4A90D9',
            visible: true,
            reactive: true,
            opacity: 130,
            x: -10,
            y: -10,
        });

        Main.uiGroup.add_actor(this._container);

        if (Main.pushModal(this._container)) {
            this._signalCapturedEvent = this._shellGlobal.stage.connect('captured-event', this._onCaptureEvent.bind(this));
      
            this._setCaptureCursor();
        }
    }

    /**
     * Set mouse cursor to default icon.
     * 
     * @method _setDefaultCursor
     * @private
     */
    _setDefaultCursor() {
        this._shellGlobal.display.set_cursor(Meta.Cursor.DEFAULT);
    }

    /**
     * Set mouse cursor to capture icon.
     * 
     * @method _setCaptureCursor
     * @private
     */
    _setCaptureCursor() {
        this._shellGlobal.display.set_cursor(Meta.Cursor.CROSSHAIR);
    }

    /**
     * Draws the container on screen.
     * 
     * @method _drawContainer
     * @private
     * @param {object} array with new position of container
     */
    _drawContainer([x, y, w, h]) {
        this._container.set_position(x, y);
        this._container.set_size(w, h);
    }

    /**
     * Provides rectangle selected by the mouse.
     * 
     * @method getRectangle
     * @return {object} array with rectangle
     */
    getRectangle() {
        let x1 = this.startX;
        let y1 = this.startY;
        let x2 = this.x;
        let y2 = this.y;

        return [
            Math.min(x1, x2),
            Math.min(y1, y2),
            Math.abs(x1 - x2),
            Math.abs(y1 - y2),
        ];
    }

    /**
     * Event callback
     * 
     * @method _onCaptureEvent
     * @private
     * @param {object} actor
     * @param {object} event
     */
    _onCaptureEvent(actor, event) {
        let type = event.type();
        let [x, y] = global.get_pointer();


        switch (type) {

            case Clutter.EventType.KEY_PRESS:

                if (event.get_key_symbol() === Clutter.KEY_Escape) {
                    this.emit("area-canceled");
                    this.stop();
                }

                break;

            case Clutter.EventType.BUTTON_PRESS: 

                [this.startX, this.startY] = [x, y];
                this._mouseDown = true;

                break;

            case Clutter.EventType.MOTION:

                if (this._mouseDown) {
                    this.x = x;
                    this.y = y;

                    this._drawContainer(
                        this.getRectangle()
                    );
                }

                break;

            case Clutter.EventType.BUTTON_RELEASE:

                if (this._mouseDown) {
                    this.x = x;
                    this.y = y;

                    this._drawContainer(
                        this.getRectangle()
                    );

                    this._mouseDown = false;

                    this.emit("area-selected");
                    this.stop();
                }

                break;

            default:
                break;
        }
    }

    /**
     * End of selection and cleanup.
     * 
     * @method stop
     */
    stop() {
        this._setDefaultCursor();

        if (this._signalCapturedEvent !== undefined) {
            this._shellGlobal.stage.disconnect(this._signalCapturedEvent);
        }

        Main.uiGroup.remove_actor(this._container);
        Main.popModal(this._container);
        this._container.destroy();
    }
});
