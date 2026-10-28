# Synra Starter

Reference plugin for Synra, with the identity `@synra-plugin/starter`.

This independent repository contains a Rust headless plugin and a Vue diagnostic page. The page
invokes the real `debug` action with an empty object and displays plugin/build metadata and the
host SDK version, host kind, locale and theme. Activation requests only `action:declare:debug`
to register this local action. Unknown actions and malformed or oversized arguments are refused.

The UI keeps one request in flight, bounds diagnostic history to eight records, suppresses late
results after leaving the page, and redacts native error payloads. Opening it in a standalone
browser reports that Synra is unavailable.

## Development

Rust is pinned in `rust-toolchain.toml`. SDK and author CLI use the reviewed core revision
`e0c5481494b409af6fdbbdec9f78786ae4ee0612`; Cargo.lock is committed. No SDK publication is needed.

```sh
cargo fmt --all --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo clippy --locked --target wasm32-unknown-unknown -- -D warnings
cargo install synra-plugin-cli --git https://github.com/synra-rs/synra-core.git --rev e0c5481494b409af6fdbbdec9f78786ae4ee0612 --locked
synra-plugin build
synra-plugin verify --dir dist
git diff --exit-code -- Cargo.lock
```

The current hybrid-capable core CLI encodes the SDK's Wasm module as a component, builds
the Vue page, and writes `dist/manifest.json`, `dist/plugin.wasm` and `dist/ui.zip`.
`verify --dir dist` checks the packaged manifest, binary ABI, imports and actual UI ZIP. A raw `cargo build --target
wasm32-unknown-unknown` output is not the final component. Generated artifacts are ignored.
CI checks the Vue types, lint and tests with pinned Node/pnpm, then builds the real hybrid
package and verifies `dist/` using the same core revision as the SDK. No release or package
publishing is part of this work.

The UI uses the published `@synra/client@0.0.11` declarations; no local overrides are retained.
With the Node version in `.node-version` and pnpm version in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm lint
pnpm build
```

The native integration gate runs from the application checkout after building this package:
set `SYNRA_STARTER_PACKAGE` to this repository's absolute `dist` path, then run
`cargo test --no-default-features --features official-plugin-tests --lib official_starter`
in the application's `src-tauri/`. It drives production install, scoped consent, activation,
extracted entry/assets and self-RPC through real Wasmtime, including invalid requests and close.
It does not render a WebView or prove phone-to-PC delivery.

The application's separate desktop smoke entry has also exercised this package in a real
Windows WebView: the existing diagnostic button reached Wasm through IPC and rendered its
result. See the application's README for the isolated debug profile and explicit opt-in.
Pixel layout and phone-to-PC delivery remain unverified; a successful local diagnostic is
not acceptance of remote computer operations.

The target-computer panel reads the host's paired-device list with `device:list`, shows
offline status, and requires an explicit canonical UUID selection. It never substitutes the
first computer. Refreshes have a single in-flight request and an eight-second UI deadline;
late replies after timeout or page exit are ignored. Device pairing or online status does not
grant permission to execute a remote operation.

## Remaining functionality

Complete visual WebView and phone/computer acceptance of target selection, computer selection
capture to the phone clipboard, and opening HTTP/HTTPS links on the selected PC. The local
diagnostic page does not establish a cross-device implementation.

Use the authenticated host channel and explicit target permissions. Capture the actual current
selection, preserve clipboard formats and concurrent writes, and distinguish empty selection,
unsupported platform, denied permission, timeout and read failure. A phone clipboard failure
must remain distinct from a successful PC read. Never fall back to opening a phone browser and
report success for the PC. Logs must not contain selection contents or secrets.

The full contract lives in [the official-plugin design](https://github.com/synra-rs/design-docs/blob/main/29-official-plugins.md).
The existing Electron starter is a workflow reference; its transport and data formats are not reused.
