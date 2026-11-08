# Synra Starter

A reference Synra plugin with the identity `@synra-plugin/starter`.
It combines a Rust/Wasm component with a Vue page to demonstrate device collaboration, scoped capabilities and the host–plugin boundary.

## What it does

- Shows a showcase page with home, demos, developer reference, diagnostics and about tabs.
- Demonstrates URL requests, clipboard requests and a safe application-catalog boundary for an explicitly selected computer.
- Displays plugin build information and the host's SDK version, kind, locale and theme.
- Lists paired computers for explicit selection and keeps offline, denied and unsupported states distinct.
- Validates action arguments in Rust/Wasm before requesting device or platform capabilities.

The plugin requests `device:list`, scoped `device:send:*`, the platform clipboard and URL capabilities and the declarations for its showcase actions.

Remote event delivery is handled by the host's authenticated peer connection. The UI reports request admission separately from the computer's eventual action result.

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
