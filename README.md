# Synra Starter

A reference Synra plugin with the identity `@synra-plugin/starter`.
It combines a Rust/Wasm component with a Vue page to demonstrate the host–plugin boundary.

## What it does

- Displays plugin build information and the host's SDK version, kind, locale and theme.
- Invokes its own `debug` action through the injected client and real Wasm component.
- Lists paired computers, including discovered `desktop` targets, for explicit selection.
- Reports unavailable hosts, offline devices and failed calls without inventing successful results.

The plugin requests `device:list` and `action:declare:debug`.
Selecting a computer does not execute a remote action; selection capture and opening a link on that computer are not implemented.

## Use it

Install the built package in Synra, review its permissions, enable it and open the page.
On Android, use the host's return bar or system Back to return to Synra.
A standalone browser can preview the page but cannot provide real host capabilities.

## Build and contribute

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the pinned SDK/CLI revision, package build and integration checks.
The package is built and verified before installation; generated files are not source files.

[Plugin guide](https://synra-app.dev/plugins/getting-started) · [Application](https://github.com/synra-rs/synra-app) · [Issues](https://github.com/synra-rs/synra-plugin-starter/issues)

## License

MIT
