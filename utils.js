'use strict';

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gettext = imports.gettext;
const _ = Gettext.gettext;

function initTranslations() {
    Gettext.textdomain(Me.metadata.uuid);
    Gettext.bindtextdomain(Me.metadata.uuid, Me.dir.get_child("locale").get_path());
}

function _settingsInit() {
    let gschema = Gio.SettingsSchemaSource.new_from_directory(
        Me.dir.get_child("schemas").get_path(),
        Gio.SettingsSchemaSource.get_default(),
        false
    );

    let settings = new Gio.Settings({
        settings_schema: gschema.lookup("org.gnome.shell.extensions.hue-lights", true)
    });

    return settings
}

function readBridges() {
    return _settingsInit().get_value("bridges").deep_unpack();
}

function saveBridges(data) {
    log("saving bridges:" + JSON.stringify(data));
    return _settingsInit().set_value("bridges", new GLib.Variant("a{sa{ss}}", data));
}

function readOrder() {
    return _settingsInit().get_value("zones-first");
}