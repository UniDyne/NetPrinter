# NetPrinter

This is a dead simple Electron app that allows you to serve any USB printer
as a raw network printer (i.e. port 9100).

It's a little quirky, but was built to solve an issue where we needed to be
able to print to Zebra label printers over the network, but only had a few
USB label printers available. This was a quick and dirty app solution that
was written in an afternoon. The idea is to provide a UI for a non-technical
user to easily add and share a local printer over the network, without dealing
with Windows printer sharing and other bits.

This app is being provided as source only. There is no pacakaged version
available. One must clone this repo, install the dependencies, build the
binaries, then build the packaged app.

```
npm install
npx electron-rebuild
npx electron-packager . NetPrinter --platform=win32 --arch=x64
```
