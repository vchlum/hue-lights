'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Hue = Me.imports.phue;
const Utils = Me.imports.utils;



var hue;

function init() {
    Utils.initTranslations();

    hue = new Hue.Phue();

    log(`initializing ${Me.metadata.name} version ${Me.metadata.version}`);
}

function enable() {
    hue.run();
    log(`enabling ${Me.metadata.name} version ${Me.metadata.version}`);
}

function disable() {
    log(`disabling ${Me.metadata.name} version ${Me.metadata.version}`);
}
