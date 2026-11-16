//! The config keys the router core reads, taken from its own types, for the YAML editor's
//! autocomplete. Serde's derive hands `deserialize_struct` the struct's field names, so a
//! deserializer that only records that call reads them without a value to parse.

use litellm_router_core::{RouterConfig, RouterDynamicConfig};
use serde::{
    de::{self, value::Error, Visitor},
    forward_to_deserialize_any, Deserialize, Deserializer,
};

struct Fields<'a>(&'a mut Vec<&'static str>);

impl<'de> Deserializer<'de> for Fields<'_> {
    type Error = Error;

    fn deserialize_any<V: Visitor<'de>>(self, _visitor: V) -> Result<V::Value, Error> {
        Err(de::Error::custom("not a struct"))
    }

    fn deserialize_struct<V: Visitor<'de>>(
        self,
        _name: &'static str,
        fields: &'static [&'static str],
        _visitor: V,
    ) -> Result<V::Value, Error> {
        self.0.extend_from_slice(fields);
        Err(de::Error::custom("recorded"))
    }

    forward_to_deserialize_any! {
        bool i8 i16 i32 i64 i128 u8 u16 u32 u64 u128 f32 f64 char str string bytes byte_buf
        option unit unit_struct newtype_struct seq tuple tuple_struct map enum identifier
        ignored_any
    }
}

fn fields_of<T: for<'de> Deserialize<'de>>() -> Vec<&'static str> {
    let mut fields = Vec::new();
    let _ = T::deserialize(Fields(&mut fields));
    fields
}

/// Fields the host fills in from other settings, or that only a Python `Router` sets, which a
/// proxy config never spells.
const HOST_ONLY: [&str; 9] = [
    "model_list",
    "routing_plugins",
    "callback_filters",
    "served_ops",
    "version",
    "allowed_fails_is_default",
    "fallback_keys",
    "default_deployment_raises",
    "provider_default_deployment_ids",
];

/// Every `router_settings` key the core reads, static config first, in declaration order.
pub(crate) fn router_settings() -> Vec<&'static str> {
    let mut keys = fields_of::<RouterConfig>();
    keys.extend(fields_of::<RouterDynamicConfig>());
    keys.retain(|key| !HOST_ONLY.contains(key));
    keys.dedup();
    keys
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn router_settings_come_from_both_configs() {
        let keys = router_settings();
        assert!(keys.contains(&"cooldown_time"));
        assert!(keys.contains(&"fallbacks"));
        assert!(!keys.contains(&"served_ops"));
    }
}
