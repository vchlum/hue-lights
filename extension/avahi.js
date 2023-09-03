'use strict';

/**
 * avahi
 * JavaScript Avahi mDNS discovery.
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

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * https://gjs.guide/guides/gio/subprocesses.html#asynchronous-communication
 */

export var Avahi = GObject.registerClass({
    GTypeName: "NanoAvahi",
    Properties: {
        "service": GObject.ParamSpec.string("service", "service", "service", GObject.ParamFlags.READWRITE, null),
    },
    Signals: {
        "service-found": {},
        "finished": {},
        "error": {},
    }
}, class Avahi extends GObject.Object {
    _init(props={}) {
        super._init(props);

        this._pid = null;
        this.error = null;

        this.discovered = {};
        this.discoverdHostname = null;
        this.discoverdIp = null;
        this.discoverdPort = null;
    }

    set service(value) {
        this._service = value;
    }

    parseLine(line) {
        if (line === null) {
            return;
        }

        line = line.split(";");

        if (line.length > 9) {

            if (line[2] !== "IPv4") {
                return;
            }

            this.discoverdHostname = line[6];
            this.discoverdIp = line[7];
            this.discoverdPort = line[8];

            this.discovered[this.discoverdIp] = { "hostname": this.discoverdHostname, "port": this.discoverdPort };

            this.emit("service-found");
        }
    }

    readOutput(stream, lineBuffer) {
        stream.read_line_async(0, null, (stream, res) => {
            try {
                let line = stream.read_line_finish_utf8(res)[0];
    
                if (line !== null) {
                    this.parseLine(line);

                    lineBuffer.push(line);
                    this.readOutput(stream, lineBuffer);
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    discover() {
        if(this._pid) {
            return;
        }

        try {

            let [, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
                null,
                ['avahi-browse', this._service, '-r', '-k', '-p', '-t'],
                null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null
            );

            this._pid = pid;

            GLib.close(stdin);

            let stdoutStream = new Gio.DataInputStream({
                base_stream: new Gio.UnixInputStream({
                    fd: stdout,
                    close_fd: true
                }),
                close_base_stream: true
            });

            let stdoutLines = [];
            this.readOutput(stdoutStream, stdoutLines);

            let stderrStream = new Gio.DataInputStream({
                base_stream: new Gio.UnixInputStream({
                    fd: stderr,
                    close_fd: true
                }),
                close_base_stream: true
            });
        
            let stderrLines = [];
            this.readOutput(stderrStream, stderrLines);

            GLib.child_watch_add(GLib.PRIORITY_DEFAULT_IDLE, pid, (pid, status) => {
                if (status === 0) {
                    this.emit("finished");
                } else {
                    console.error(new Error(stderrLines.join('\n')));
                }
        
                stdoutStream.close(null);
                stderrStream.close(null);
                GLib.spawn_close_pid(pid);

                this._pid = null;
            });

        } catch (e) {
            this.error = e;
            this.emit("error");
        }

    }
})