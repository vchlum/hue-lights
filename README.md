# hue-lights
![screenshot](https://github.com/vchlum/hue-lights/blob/main/screenshot.png)

## Gnome Shell extension
hue-lights is a Gnome Shell extension for Philips Hue lights controlled by Philips Hue Bridge on local network. The extension groups the lights in zones and rooms. It is possible to control the state, the brightness, and the color. The scenes can be activated for the zones or rooms. The color picker is shown after clicking the name of light. Multiple bridges should be possible to control. It is also possible to set lights that will blink on notification.

## Philips Hue Entertainment areas
This Extension supports the Entertainment areas. Using the original app on the phone, you can create an Entertainment area. You can start synchronizing your lights with your screen afterward. The sync feature requires a special key generated on the bridge pairing. Upgrading from version 8 or earlier requires to remove and connect the Philips Hue bridge. Please, keep your bridge up to date. The feature also needs the api version 1.22 or newer. An example of this feature is in this video: https://youtu.be/4WEKdGSNbPY

## Warning
This application makes use of fast changing light effects conditions alone, or in combination with certain content on the screen it may trigger previously undetected epileptic symptoms or seizures in persons who have no history of prior seizures or epilepsy.

## Installation from e.g.o
https://extensions.gnome.org/extension/3737/hue-lights

## Manual installation

 1. `git clone https://github.com/vchlum/hue-lights.git`
 1. `cd hue-lights`
 1. `./release.sh`
 1. `gnome-extensions install hue-lights@chlumskyvaclav.gmail.com.zip`
 1. Log out & Log in
 1. `gnome-extensions enable hue-lights@chlumskyvaclav.gmail.com`
