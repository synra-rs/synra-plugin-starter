# Synra Starter

Reference plugin for Synra, with the identity `@synra-plugin/starter`.

This independent repository currently contains a Rust headless plugin. Its `debug` action accepts
an empty JSON object and reports the plugin version, WIT contract version and actual host SDK
version, host kind, locale and dark mode. It requests no permissions and makes no system changes.
Unknown actions and invalid or oversized arguments are refused before reading host information.

## Development

Rust is pinned in `rust-toolchain.toml`. The SDK and author CLI use core revision
`9c7c78b9788e5357ccb4537c9ff1f8d3abedea58`; Cargo.lock is committed. No SDK publication is needed.

```sh
cargo fmt --all --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo clippy --locked --target wasm32-unknown-unknown -- -D warnings
cargo install synra-plugin-cli --git https://github.com/synra-rs/synra-core.git --rev 9c7c78b9788e5357ccb4537c9ff1f8d3abedea58 --locked
synra-plugin build
synra-plugin verify
git diff --exit-code -- Cargo.lock
```

`synra-plugin build` encodes the SDK's Wasm module as a component and writes `plugin.wasm`.
`verify` checks the actual manifest, binary ABI and imports. A raw `cargo build --target
wasm32-unknown-unknown` output is not the final component. Generated artifacts are ignored.
CI runs the development checks and builds the component; it does not publish anything.

## Remaining functionality

Add the Vue interface, target-PC selection, permission diagnostics, bounded request tracing,
computer selection capture to the phone clipboard, and opening HTTP/HTTPS links on the selected PC.
The current headless diagnostic action is not a complete Starter or a cross-device implementation.

Use the authenticated host channel and explicit target permissions. Capture the actual current
selection, preserve clipboard formats and concurrent writes, and distinguish empty selection,
unsupported platform, denied permission, timeout and read failure. A phone clipboard failure
must remain distinct from a successful PC read. Never fall back to opening a phone browser and
report success for the PC. Logs must not contain selection contents or secrets.

The full contract lives in [the official-plugin design](https://github.com/synra-rs/design-docs/blob/main/29-official-plugins.md).
The existing Electron starter is a workflow reference; its transport and data formats are not reused.
