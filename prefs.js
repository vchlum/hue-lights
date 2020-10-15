'use strict';

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;

// It's common practice to keep GNOME API and JS imports in separate blocks
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();


// Like `extension.js` this is used for any one-time setup like translations.
function init() {
    log(`initializing ${Me.metadata.name} Preferences`);
}


// This function is called when the preferences window is first created to build
// and return a Gtk widget. As an example we'll create and return a GtkLabel.
function buildPrefsWidget() {
    // This could be any GtkWidget subclass, although usually you would choose
    // something like a GtkGrid, GtkBox or GtkNotebook
    let prefsWidget = new Gtk.Label({
        label: `${Me.metadata.name} version ${Me.metadata.version}`,
        visible: true
    });

    // At the time buildPrefsWidget() is called, the window is not yet prepared
    // so if you want to access the headerbar you need to use a small trick
    GLib.timeout_add(0, () => {
        let window = prefsWidget.get_toplevel();
        let headerBar = window.get_titlebar();
        headerbar.title = `${Me.metadata.name} Preferences`;
    });

    return prefsWidget;
}
