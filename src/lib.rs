//! Reference actions using Synra's capability-gated SDK.

#![forbid(unsafe_code)]

#[cfg(target_arch = "wasm32")]
mod guest;

#[cfg(any(target_arch = "wasm32", test))]
mod debug;
