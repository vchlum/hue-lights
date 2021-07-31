'use strict';

/**
 * queue
 * Queue library. Inspired by:
 * https://stackoverflow.com/questions/4797566/queue-ajax-calls/4797596#4797596
 * https://gist.github.com/paolorossi/5747533
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

const GLib = imports.gi.GLib;

var handlerType = {
    CUSTOM: 0,
    PROMPT: 1,
    TIMED: 2
};

 /**
 * _Queue class for running task.
 *
 * @class _Queue
 * @constructor
 * @private
 * @return {Object} instance
 */
class _Queue {

    constructor(hType = handlerType.CUSTOM, handler = undefined) {

        this._queue = [];

        if (hType === handlerType.CUSTOM) {
            this._handler = handler;
        }

        if (hType === handlerType.PROMPT) {
            this._handler = this._promptHandler;
        }

        if (hType === handlerType.TIMED) {
            this._handler = this._timedHandler;
        }
    }

    /**
     * Runs the queue handler and shifts queue until queue is empty.
     * 
     * @method _run
     * @private
     */
    _run() {
        this._handler(
            this._queue[0],
            () => { /* callback */
                this._queue.shift();

                if (this._queue.length > 0) {
                    this._run();
                } 
            }
        );
    }

    /**
     * Predefined prompt queue handler.
     * 
     * @method _promptHandler
     * @private
     * @param {Object} function to run
     * @param {Object} queue callback
     */
    _promptHandler(task, callback) {
        task();
        callback();
    }

    _delayTask(task, callback) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, task[1], () => {
            task[0]();
            callback();
            return GLib.SOURCE_REMOVE;
        });
    }
    /**
     * Predefined timed queue handler.
     * 
     * @method _timedHandler
     * @private
     * @param {Object} function to run
     * @param {Object} queue callback
     */
    async _timedHandler(task, callback) {

        await this._delayTask(task, callback);
    }

    /**
     * Add task for processing.
     * 
     * @method append
     * @param {Object} task
     */
    append(task) {
        this._queue.push(task);

        if (this._queue.length === 1) {
            this._run();
        }
    }

    /**
     * Returns queue length.
     * 
     * @method append
     * @param {Number} queue length
     */
    getQueueLength() {
        return this._queue.length;
    }
}

/**
 * Queue class for running tasks.
 *
 * @class Queue
 * @constructor
 * @return {Object} instance
 */
 var Queue = class Queue extends _Queue {

    constructor(params) {

        super(params);

        Object.assign(this, params);
    }
};