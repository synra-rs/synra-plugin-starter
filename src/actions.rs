//! Starter showcase actions and their bounded argument validation.

use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use synra_plugin_sdk::{Error, Outcome, host};

pub const OPEN_URL: &str = "starter.open-url";
pub const CLIPBOARD_READ_SELECTION: &str = "starter.clipboard-read-selection";
pub const CLIPBOARD_WRITE: &str = "starter.clipboard-write";
pub const APPS_LIST: &str = "starter.apps-list";
pub const APPS_OPEN: &str = "starter.apps-open";
pub const RESPONSE_POLL: &str = "starter.response-poll";

pub const EVENT_OPEN_URL: &str = "_plugin.@synra-plugin/starter.open-url";
pub const EVENT_CLIPBOARD_READ_SELECTION: &str =
    "_plugin.@synra-plugin/starter.clipboard-read-selection";
pub const EVENT_CLIPBOARD_WRITE: &str = "_plugin.@synra-plugin/starter.clipboard-write";
pub const EVENT_APPS_LIST: &str = "_plugin.@synra-plugin/starter.apps-list";
pub const EVENT_APPS_OPEN: &str = "_plugin.@synra-plugin/starter.apps-open";
pub const EVENT_RESPONSE: &str = "_plugin.@synra-plugin/starter.response";

const MAX_ARGS: usize = 64 * 1024;
const MAX_TEXT: usize = 64 * 1024;
const MAX_URL: usize = 2048;
const MAX_APP_ID: usize = 128;
const MAX_REQUEST_ID: usize = 128;
const MAX_RESPONSES: usize = 64;

static RESPONSES: OnceLock<Mutex<HashMap<String, Value>>> = OnceLock::new();

fn responses() -> &'static Mutex<HashMap<String, Value>> {
    RESPONSES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub(crate) fn declare() -> Outcome {
    for (name, schema) in [
        (
            OPEN_URL,
            r#"{"type":"object","properties":{"target":{"type":"string"},"requestId":{"type":"string"},"url":{"type":"string"}},"required":["target","requestId","url"],"additionalProperties":false}"#,
        ),
        (
            CLIPBOARD_READ_SELECTION,
            r#"{"type":"object","properties":{"target":{"type":"string"},"requestId":{"type":"string"}},"required":["target","requestId"],"additionalProperties":false}"#,
        ),
        (
            CLIPBOARD_WRITE,
            r#"{"type":"object","properties":{"target":{"type":"string"},"requestId":{"type":"string"},"text":{"type":"string"}},"required":["target","requestId","text"],"additionalProperties":false}"#,
        ),
        (
            APPS_LIST,
            r#"{"type":"object","properties":{"target":{"type":"string"},"requestId":{"type":"string"}},"required":["target","requestId"],"additionalProperties":false}"#,
        ),
        (
            APPS_OPEN,
            r#"{"type":"object","properties":{"target":{"type":"string"},"requestId":{"type":"string"},"appId":{"type":"string"}},"required":["target","requestId","appId"],"additionalProperties":false}"#,
        ),
        (
            RESPONSE_POLL,
            r#"{"type":"object","properties":{"requestId":{"type":"string"}},"required":["requestId"],"additionalProperties":false}"#,
        ),
    ] {
        if let Outcome::Err(error) = host::action_declare(name, schema) {
            return Outcome::Err(error);
        }
    }
    Outcome::Ok(String::new())
}

pub(crate) fn invoke(name: &str, args: &str) -> Outcome {
    if args.len() > MAX_ARGS {
        return refused("badArgument", "showcase arguments exceed 64 KiB");
    }
    let value = match serde_json::from_str::<Value>(args) {
        Ok(Value::Object(value)) => value,
        Ok(_) => return refused("badArgument", "showcase arguments must be a JSON object"),
        Err(_) => return refused("badArgument", "showcase arguments are not valid JSON"),
    };

    match name {
        RESPONSE_POLL => poll_response(&value),
        OPEN_URL => {
            let target = match required_string(&value, "target", 64) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let url = match required_string(&value, "url", MAX_URL) {
                Ok(value) => value,
                Err(error) => return error,
            };
            if !is_device_id(target) {
                return refused("badArgument", "target must be a canonical device id");
            }
            if !is_supported_url(url) {
                return refused("badArgument", "only http and https URLs are supported");
            }
            let request_id = match request_id(&value) {
                Ok(value) => value,
                Err(error) => return error,
            };
            send(
                target,
                EVENT_OPEN_URL,
                serde_json::json!({ "requestId": request_id, "url": url }),
            )
        }
        CLIPBOARD_READ_SELECTION => {
            let target = match target(&value) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let request_id = match request_id(&value) {
                Ok(value) => value,
                Err(error) => return error,
            };
            send(
                target,
                EVENT_CLIPBOARD_READ_SELECTION,
                serde_json::json!({ "requestId": request_id }),
            )
        }
        CLIPBOARD_WRITE => {
            let target = match target(&value) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let text = match required_string(&value, "text", MAX_TEXT) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let request_id = match request_id(&value) {
                Ok(value) => value,
                Err(error) => return error,
            };
            send(
                target,
                EVENT_CLIPBOARD_WRITE,
                serde_json::json!({ "requestId": request_id, "text": text }),
            )
        }
        APPS_LIST => {
            let target = match target(&value) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let request_id = match request_id(&value) {
                Ok(value) => value,
                Err(error) => return error,
            };
            send(
                target,
                EVENT_APPS_LIST,
                serde_json::json!({ "requestId": request_id }),
            )
        }
        APPS_OPEN => {
            let target = match target(&value) {
                Ok(value) => value,
                Err(error) => return error,
            };
            let app_id = match required_string(&value, "appId", MAX_APP_ID) {
                Ok(value) => value,
                Err(error) => return error,
            };
            if app_id.trim().is_empty() {
                return refused("badArgument", "appId cannot be empty");
            }
            let request_id = match request_id(&value) {
                Ok(value) => value,
                Err(error) => return error,
            };
            send(
                target,
                EVENT_APPS_OPEN,
                serde_json::json!({ "requestId": request_id, "appId": app_id }),
            )
        }
        _ => refused("actionNotFound", "unknown Starter showcase action"),
    }
}

pub(crate) fn on_event(event_json: &str) -> Outcome {
    let event = match serde_json::from_str::<Value>(event_json) {
        Ok(Value::Object(value)) => value,
        _ => return refused("badArgument", "event context is not valid JSON"),
    };
    let name = match event.get("event").and_then(Value::as_str) {
        Some(value) => value,
        None => return refused("badArgument", "event context has no event name"),
    };
    let payload = match event.get("payload") {
        Some(Value::Object(value)) => value,
        _ => return refused("badArgument", "event context has no object payload"),
    };
    let from = match event.get("from").and_then(Value::as_str) {
        Some(value) if is_device_id(value) => value,
        _ => return refused("badArgument", "event context has no valid sender device"),
    };
    if name == EVENT_RESPONSE {
        let Some(request_id) = payload.get("requestId").and_then(Value::as_str) else {
            return refused("badArgument", "event response has no request id");
        };
        if request_id.is_empty() || request_id.len() > MAX_REQUEST_ID {
            return refused("badArgument", "event response request id is invalid");
        }
        let Ok(mut responses) = responses().lock() else {
            return refused("internal", "event response storage is unavailable");
        };
        if responses.len() >= MAX_RESPONSES {
            responses.clear();
        }
        responses.insert(request_id.to_owned(), Value::Object(payload.clone()));
        return Outcome::Ok(String::new());
    }
    let request_id = match payload.get("requestId").and_then(Value::as_str) {
        Some(value) if !value.is_empty() && value.len() <= MAX_REQUEST_ID => value,
        _ => return refused("badArgument", "event payload has no valid request id"),
    };
    match name {
        EVENT_OPEN_URL => match payload.get("url").and_then(Value::as_str) {
            Some(url) if is_supported_url(url) => {
                reply(from, request_id, host::platform_open_url(url))
            }
            _ => reply(
                from,
                request_id,
                refused("badArgument", "event URL is invalid"),
            ),
        },
        EVENT_CLIPBOARD_WRITE => match payload.get("text").and_then(Value::as_str) {
            Some(text) if text.len() <= MAX_TEXT => {
                reply(from, request_id, host::platform_write_clipboard(text))
            }
            _ => reply(
                from,
                request_id,
                refused("badArgument", "event clipboard text is invalid"),
            ),
        },
        EVENT_CLIPBOARD_READ_SELECTION => reply(from, request_id, host::platform_read_clipboard()),
        EVENT_APPS_LIST => reply(
            from,
            request_id,
            Outcome::Ok(host_app_catalog().to_string()),
        ),
        EVENT_APPS_OPEN => {
            let Some(app_id) = payload.get("appId").and_then(Value::as_str) else {
                return reply(
                    from,
                    request_id,
                    refused("badArgument", "event app id is invalid"),
                );
            };
            if app_id.is_empty() || app_id.len() > MAX_APP_ID || !app_id.starts_with("synra-app-") {
                return reply(
                    from,
                    request_id,
                    refused("badArgument", "event app id is invalid"),
                );
            }
            reply(
                from,
                request_id,
                host::platform_open_path(&format!("synra-app://{app_id}")),
            )
        }
        _ => reply(
            from,
            request_id,
            refused("notImplemented", "this plugin does not handle that event"),
        ),
    }
}

fn target(value: &serde_json::Map<String, Value>) -> Result<&str, Outcome> {
    let target = required_string(value, "target", 64)?;
    if !is_device_id(target) {
        return Err(refused(
            "badArgument",
            "target must be a canonical device id",
        ));
    }
    Ok(target)
}

fn request_id(value: &serde_json::Map<String, Value>) -> Result<&str, Outcome> {
    required_string(value, "requestId", MAX_REQUEST_ID)
}

fn required_string<'a>(
    value: &'a serde_json::Map<String, Value>,
    key: &str,
    max: usize,
) -> Result<&'a str, Outcome> {
    let Some(value) = value.get(key).and_then(Value::as_str) else {
        return Err(refused(
            "badArgument",
            "required showcase argument is missing",
        ));
    };
    if value.is_empty() || value.len() > max {
        return Err(refused(
            "badArgument",
            "showcase argument has an invalid length",
        ));
    }
    Ok(value)
}

fn send(target: &str, event: &str, payload: Value) -> Outcome {
    let request_id = payload
        .get("requestId")
        .and_then(Value::as_str)
        .unwrap_or_default();
    match host::device_send(target, event, &payload.to_string()) {
        Outcome::Ok(_) => Outcome::Ok(
            serde_json::json!({ "status": "queued", "requestId": request_id }).to_string(),
        ),
        Outcome::Err(error) => Outcome::Err(error),
    }
}

fn poll_response(value: &serde_json::Map<String, Value>) -> Outcome {
    let request_id = match request_id(value) {
        Ok(value) => value,
        Err(error) => return error,
    };
    let Ok(mut responses) = responses().lock() else {
        return refused("internal", "event response storage is unavailable");
    };
    Outcome::Ok(
        responses
            .remove(request_id)
            .unwrap_or_else(|| serde_json::json!({ "status": "pending", "requestId": request_id }))
            .to_string(),
    )
}

fn reply(from: &str, request_id: &str, outcome: Outcome) -> Outcome {
    let payload = match outcome {
        Outcome::Ok(value) => {
            let value = serde_json::from_str::<Value>(&value).unwrap_or(Value::String(value));
            serde_json::json!({
                "requestId": request_id,
                "status": "ok",
                "value": value,
            })
        }
        Outcome::Err(error) => serde_json::json!({
            "requestId": request_id,
            "status": "error",
            "code": error.code,
            "message": error.message,
        }),
    };
    match host::device_send(from, EVENT_RESPONSE, &payload.to_string()) {
        Outcome::Ok(_) => Outcome::Ok(String::new()),
        Outcome::Err(error) => Outcome::Err(error),
    }
}

fn host_app_catalog() -> Value {
    Value::Array(
        host::platform_capabilities()
            .into_iter()
            .filter_map(|entry| {
                let value = entry.strip_prefix("synra-app:")?;
                let (id, name) = value.split_once('\t')?;
                if id.is_empty() || name.is_empty() {
                    return None;
                }
                Some(serde_json::json!({ "id": id, "name": name }))
            })
            .collect(),
    )
}

fn is_supported_url(value: &str) -> bool {
    (value.starts_with("https://") || value.starts_with("http://"))
        && !value.chars().any(char::is_whitespace)
        && value.len() <= MAX_URL
}

fn is_device_id(value: &str) -> bool {
    value.len() == 36
        && value.as_bytes().iter().enumerate().all(|(index, byte)| {
            if matches!(index, 8 | 13 | 18 | 23) {
                *byte == b'-'
            } else {
                matches!(*byte, b'0'..=b'9' | b'a'..=b'f')
            }
        })
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
    use super::{EVENT_RESPONSE, RESPONSE_POLL, invoke, is_device_id, is_supported_url, on_event};
    use serde_json::Value;

    #[test]
    fn validates_only_canonical_device_ids() {
        assert!(is_device_id("11111111-1111-4111-8111-111111111111"));
        assert!(!is_device_id("Laptop"));
        assert!(!is_device_id("ABCDEFAB-1111-4111-8111-111111111111"));
        assert!(!is_device_id("11111111111141118111111111111111"));
    }

    #[test]
    fn validates_http_urls_without_accepting_commands() {
        assert!(is_supported_url("https://synra-app.dev"));
        assert!(is_supported_url("http://localhost:8080"));
        assert!(!is_supported_url("file:///tmp/private"));
        assert!(!is_supported_url("https://example.com/a b"));
    }

    #[test]
    fn stores_remote_responses_under_the_payload_request_id() {
        let request_id = "01TESTREQUEST0000000000000000";
        let event = serde_json::json!({
            "event": EVENT_RESPONSE,
            "from": "11111111-1111-4111-8111-111111111111",
            "requestId": "network-envelope-request",
            "payload": { "requestId": request_id, "status": "ok", "value": "done" }
        });

        assert!(matches!(
            on_event(&event.to_string()),
            super::Outcome::Ok(_)
        ));
        let result = invoke(
            RESPONSE_POLL,
            &serde_json::json!({ "requestId": request_id }).to_string(),
        );
        let super::Outcome::Ok(value) = result else {
            panic!("the stored response should be readable")
        };
        let parsed: Value = serde_json::from_str(&value).expect("a response object");
        assert_eq!(parsed["requestId"], request_id);
        assert_eq!(parsed["status"], "ok");
    }
}
