//! Bounded diagnostic action; invalid arguments never query the host.

use synra_plugin_sdk::{Error, Outcome};

pub(crate) struct Environment {
    pub sdk_version: String,
    pub host_kind: String,
    pub locale: String,
    pub dark_mode: bool,
}

pub(crate) fn invoke(name: &str, args: &str, environment: impl FnOnce() -> Environment) -> Outcome {
    if name != "debug" {
        return refused("actionNotFound", "unknown Starter action");
    }
    if args.len() > 1024 {
        return refused("badArgument", "debug arguments exceed 1024 bytes");
    }
    if !matches!(serde_json::from_str::<serde_json::Value>(args),
        Ok(serde_json::Value::Object(fields)) if fields.is_empty())
    {
        return refused("badArgument", "debug expects an empty JSON object");
    }
    let env = environment();
    let report = serde_json::json!({
        "pluginId": "@synra-plugin/starter",
        "pluginVersion": env!("CARGO_PKG_VERSION"),
        "contractVersion": synra_plugin_sdk::CONTRACT_VERSION,
        "hostSdkVersion": env.sdk_version,
        "hostKind": env.host_kind,
        "locale": env.locale,
        "darkMode": env.dark_mode,
    });
    Outcome::Ok(report.to_string())
}

fn refused(code: &str, message: &str) -> Outcome {
    Outcome::Err(Error {
        code: code.to_owned(),
        message: message.to_owned(),
        details: None,
    })
}

#[cfg(test)]
mod tests {
    use super::{Environment, invoke};
    use synra_plugin_sdk::Outcome;

    fn environment() -> Environment {
        Environment {
            sdk_version: "0.1.0-test".to_owned(),
            host_kind: "desktop".to_owned(),
            locale: "zh-CN".to_owned(),
            dark_mode: true,
        }
    }

    #[test]
    fn diagnostic_returns_build_facts_and_host_values() -> Result<(), Box<dyn std::error::Error>> {
        let Outcome::Ok(report) = invoke("debug", "{}", environment) else {
            return Err("valid diagnostic action was refused".into());
        };
        let report: serde_json::Value = serde_json::from_str(&report)?;
        assert_eq!(report["pluginId"], "@synra-plugin/starter");
        assert_eq!(report["pluginVersion"], env!("CARGO_PKG_VERSION"));
        assert_eq!(report["hostSdkVersion"], "0.1.0-test");
        assert_eq!(report["hostKind"], "desktop");
        assert_eq!(report["locale"], "zh-CN");
        assert_eq!(report["darkMode"], true);
        Ok(())
    }

    #[test]
    fn invalid_requests_do_not_query_host() {
        for (name, args, code) in [
            ("other", "{}", "actionNotFound"),
            ("debug", "null", "badArgument"),
            ("debug", "[]", "badArgument"),
            ("debug", "{", "badArgument"),
            ("debug", "{\"text\":\"private\"}", "badArgument"),
            ("debug", "{\"x\":1,\"x\":2}", "badArgument"),
        ] {
            let mut queried = false;
            let result = invoke(name, args, || {
                queried = true;
                environment()
            });
            assert!(!queried);
            assert!(matches!(result, Outcome::Err(error) if error.code == code));
        }
    }

    #[test]
    fn oversized_json_is_refused_before_parsing() {
        let mut queried = false;
        let result = invoke("debug", &format!("{}{{}}", " ".repeat(1024)), || {
            queried = true;
            environment()
        });
        assert!(!queried);
        assert!(matches!(result, Outcome::Err(error) if error.code == "badArgument"));
    }
}
