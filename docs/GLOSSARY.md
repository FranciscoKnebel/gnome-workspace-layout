# Glossary

## Workspace Layout

The product and extension. It captures and applies named arrangements of windows
across GNOME workspaces and monitors.

## Layout

A named JSON file stored at `~/.config/workspace-layout/layouts/<name>.json`.
It contains workspaces and the windows to create in each workspace.

## Workspace

A GNOME workspace identified by its existing display name. The extension validates
that every workspace referenced by a layout already exists.

## Monitor Index

The GNOME monitor index used in layout files. Indexes are simple integers such as
`0`, `1`, `2`, and `3`.

## Window Entry

One desired window in a layout. It can include `label`, `appId`, `command`,
`title`, `match`, `monitor`, `position`, `minimized`, and `timeoutMs`.

## Position Preset

A semantic placement value: `full`, `left`, `right`, `top`, `bottom`, or `center`.

## Relative Rectangle

A custom position expressed relative to the selected monitor, using `x`, `y`,
`width`, and `height` values between `0` and `1`.

## Setup

The command that captures the current window arrangement into a layout file.

## Apply

The command that launches and positions new windows according to a layout file.
It does not modify existing windows.

## Doctor

The command that checks CLI paths, D-Bus connectivity, extension availability,
layout paths, schema paths, monitors, and workspaces.
