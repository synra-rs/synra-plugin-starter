//! A minimal headless plugin. All host capabilities must be declared and granted before use.

#![forbid(unsafe_code)]

use synra_plugin_sdk::{Error, Outcome, exports};

struct Plugin;

impl exports::synra::plugin::lifecycle::Guest for Plugin {
    fn activate(_config_json: String) -> Outcome {
        synra_plugin_sdk::host::action_declare(
            "debug",
            r#"{"type":"object","additionalProperties":false}"#,
        )
    }

    fn deactivate() {}

    fn migrate(_from_version: String, _to_version: String) -> Outcome {
        Outcome::Ok(String::new())
    }

    fn on_tick(_tick_json: String) -> Outcome {
        Outcome::Ok(String::new())
    }

    fn on_event(_event_json: String) -> Outcome {
        Outcome::Err(Error {
            code: "notImplemented".to_owned(),
            message: "this plugin declares no event handlers".to_owned(),
            details: None,
        })
    }
}

impl exports::synra::plugin::share::Guest for Plugin {
    fn can_handle(_item_json: String) -> String {
        r#"{"handled":false}"#.to_owned()
    }

    fn execute(_action: String, _args_json: String) -> Outcome {
        refused()
    }
}

impl exports::synra::plugin::actions::Guest for Plugin {
    fn invoke(name: String, args_json: String) -> Outcome {
        crate::debug::invoke(&name, &args_json, || crate::debug::Environment {
            sdk_version: synra_plugin_sdk::host::env_sdk_version(),
            host_kind: synra_plugin_sdk::host::env_host_kind(),
            locale: synra_plugin_sdk::host::env_locale(),
            dark_mode: synra_plugin_sdk::host::env_dark_mode(),
        })
    }
}

fn refused() -> Outcome {
    Outcome::Err(Error {
        code: "actionNotFound".to_owned(),
        message: "this plugin has not implemented an action".to_owned(),
        details: None,
    })
}

synra_plugin_sdk::export!(Plugin);
