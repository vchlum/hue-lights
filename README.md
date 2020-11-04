# hue-lights
![screenshot](https://github.com/vchlum/hue-lights/blob/main/screenshot.png)

## Gnome Shell extension
hue-lights is a Gnome Shell extension for Philips Hue lights controlled by Philips Hue Bridge on local network. The extension groups the lights in zones and rooms. It is possible to control the state, the brightness, and the color. The scenes can be activated for the zones or rooms. The color picker is shown after clicking the name of light. Multiple bridges should be possible to control. It is also possible to set lights that will blink on notification.

## Installation from e.g.o
https://extensions.gnome.org/extension/3737/hue-lights

## Manual installation

 1. `git clone https://github.com/vchlum/hue-lights.git`
 1. `cd hue-lights`
 1. `./release.sh`
 1. `gnome-extensions install hue-lights@chlumskyvaclav.gmail.com.zip`
 1. `gnome-extensions enable hue-lights@chlumskyvaclav.gmail.com`
 1. Log out & Log in
