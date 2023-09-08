
'use strict';

/**
 * gstreamer
 * JavaScript library for GStreamer.
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

/**
 * Inspired by https://github.com/raihan2000/visualizer
 * https://lazka.github.io/pgi-docs/Gst-1.0/index.html
 * https://gstreamer.freedesktop.org/documentation/spectrum/index.html?gi-language=c#spectrum
 */

import GObject from 'gi://GObject';
import Gst from 'gi://Gst';
import Gvc from 'gi://Gvc';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Utils from './utils.js';

/**
 * HueGStreamer class. Using of Gstreamer. E.g.: for sync audio.
 * 
 * @class PhueMenu
 * @constructor
 * @return {Object} menu widget instance
 */
export const HueGStreamer = GObject.registerClass({
    GTypeName: "HueGStreamer",
    Signals: {
    }
}, class HueGStreamer extends GObject.Object {

    _init() {
        this._freq = [];
        this._spectBands = 64;

        Gst.init(null);
        this._pipeline = Gst.Pipeline.new("bin");

        this._src = Gst.ElementFactory.make("pulsesrc", "src");

        this._spectrum = Gst.ElementFactory.make("spectrum", "spectrum");
        this._spectrum.set_property("bands", this._spectBands);
        this._spectrum.set_property("threshold", -80);
        this._spectrum.set_property("post-messages", true);

        this._pipeline.add(this._src);
        this._pipeline.add(this._spectrum);

        let _sink = Gst.ElementFactory.make("fakesink", "sink");
        this._pipeline.add(_sink);

        if (!this._src.link(this._spectrum) || !this._spectrum.link(_sink)) {
                Utils.logError('GStreamer filed to link');
        }

        this.setStream();

        this._handler = null;
    }

    /**
     * Internal handler for message.
     * Calls the external handler if set.
     * 
     * @method _handleMsg
     * @private
     * @param {Object} msg
     */
    _handleMsg(msg) {
        let struct = msg.get_structure();
        let [magbool, magnitudes] = struct.get_list("magnitude");
        if (magbool) {
            for (let i = 0; i < this._spectBands; ++i) {
                this._freq[i] = magnitudes.get_nth(i) * -1;
            }

            if (this._handler !== null) {
                this._handler(this._freq);
            }
        }
    }

    /**
     * Start reading messages.
     * 
     * @method start
     */
    start() {
        let bus = this._pipeline.get_bus();
        bus.add_signal_watch();
        this._signal = bus.connect('message::element',(bus, msg) => {
            this._handleMsg(msg);
        });
        this._pipeline.set_state(Gst.State.PLAYING);
    }

    /**
     * Stops reading messages.
     * 
     * @method stop
     */
    stop() {
        this._pipeline.set_state(Gst.State.NULL);
        if (this._signal) {
            let bus = this._pipeline.get_bus();
            bus.disconnect(this._signal);
            this._signal = null;
        }
    }

    /**
     * Sets the bands size.
     * 
     * @method setBands
     * @param {Number} bands
     */
    setBands(bands) {
        this._spectBands = bands;
        this._spectrum.set_property("bands", this._spectBands);
    }

    /**
     * Sets the interval of messages
     *
     * @method setBands
     * @param {Number} interval coeficient
     */
    setInterval(intervalCoef) {
        let base = 100000000; /* 0.2 seconds */
        this._interval = base * intervalCoef + 30000000; /* + 0.03 seconds*/
        this._spectrum.set_property("interval", this._interval);
    }

    /**
     * Sets the device to listen.
     * 
     * @method setStream
     * @param {String} device name
     */
    setStream(stream = null) {
        if (stream === null) {
            stream = Main.panel.statusArea.quickSettings._volumeOutput._output.stream.get_name() + '.monitor';
        }
        this._src.set_property('device', stream);
    }

    /**
     * Get possible audio stream devices.
     * 
     * @method getAudioStreams
     * @return {Object} list of devices
     */
    getAudioStreams() {
        let res = [];
        let control = Main.panel.statusArea.quickSettings._volumeOutput._control;
        if (control.get_state() == Gvc.MixerControlState.READY) {
            let streams = control.get_streams();
            for (let stream of streams) {
                if (stream instanceof Gvc.MixerSink) {
                    res.push(stream.get_name() + '.monitor');
                }
                if (stream instanceof Gvc.MixerSource) {
                    res.push(stream.get_name());
                }
            }
            
          }
    }

    /**
     * Sets external handler
     * 
     * @method setHandler
     * @param {Object} main, external handler to be call
     */
    setHandler(handler) {
        this._handler = handler;
    }
});
