# Plugin development

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
Windows WebView: the diagnostic tab reached Wasm through IPC and rendered its result. See the
application's [development guide](https://github.com/synra-rs/synra-app/blob/main/CONTRIBUTING.md)
for the isolated debug profile and explicit opt-in. Pixel layout and phone-to-PC delivery remain
unverified. A successful local diagnostic is not acceptance of remote computer operations.

The target-computer panel reads the host's paired-device list with `device:list`, shows
offline status, and requires an explicit canonical UUID selection. It never substitutes the
first computer. Refreshes have a single in-flight request and an eight-second UI deadline;
late replies after timeout or page exit are ignored. Device pairing or online status does not
grant permission to execute a remote operation. The showcase cards preserve `unsupported`,
`capability_denied`, offline, timeout and queued states.
