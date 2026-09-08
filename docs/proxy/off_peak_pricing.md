# Off-Peak Pricing

Some providers charge less during fixed clock windows; DeepSeek, for example, halves its rates outside its peak hours. `off_peak_pricing` on a model's pricing entry teaches LiteLLM cost tracking that schedule: while a configured window is open, spend is calculated at the off-peak rates instead of the standard ones, so tracked spend matches the provider invoice around the clock.

## Daily windows

`off_peak_pricing` is a model pricing key, the same kind of entry as `input_cost_per_token` in the [model cost map](./custom_model_cost_map). Attach it under `model_info` on a deployment:

```yaml
model_list:
  - model_name: deepseek-chat
    litellm_params:
      model: deepseek/deepseek-chat
      api_key: os.environ/DEEPSEEK_API_KEY
    model_info:
      off_peak_pricing:
        hours_utc: "16:30-00:30"
        input_cost_per_token: 1.35e-7
        output_cost_per_token: 5.5e-7
        cache_read_input_token_cost: 3.5e-8
```

`hours_utc` is a `"HH:MM-HH:MM"` window in UTC, or a list of them for providers with several windows per day. These windows apply every day of the week. A window may wrap past midnight, as above; the start is inclusive and the end exclusive; a window whose start equals its end covers the whole day. Numbers and windows here are illustrative; take the real schedule and rates from your provider's price sheet.

The schedule is scoped to the deployment it is set on. Other deployments of the same backend model keep their own pricing, so two deployments can carry different schedules and a deployment without the block always bills at its standard rates.

When `model_info` carries only the `off_peak_pricing` block, as above, the standard rates outside the windows come from the built-in cost map entry for the backend model. Set `input_cost_per_token` and `output_cost_per_token` beside the block to override them.

## Weekday-qualified windows

When the provider's schedule differs by day of week, use `windows`, a list of rules that each pair `hours_utc` with the weekdays it applies on. Weekdays are ISO numbers (1 = Monday through 7 = Sunday) or English names or abbreviations. A rule without `weekdays` applies every day, and any flat `hours_utc` at the top level stays active alongside the rules; the request is off-peak if any of them matches.

```yaml
model_info:
  off_peak_pricing:
    weekday_timezone: Asia/Shanghai
    windows:
      - hours_utc: ["10:00-01:00", "04:00-06:00"]
        weekdays: [mon, tue, wed, thu, fri]
      - hours_utc: "00:00-00:00"   # whole day
        weekdays: [sat, sun]
    input_cost_per_token: 1.35e-7
    output_cost_per_token: 5.5e-7
```

`weekday_timezone` is an optional IANA timezone name for the block. Hours are always UTC; the timezone only decides which calendar day a moment belongs to when weekdays are checked. That matters when the provider defines its schedule by its local weekday: 23:00 UTC on Friday is already Saturday in Asia/Shanghai, so with the config above it matches the weekend rule. The default is UTC, and an unrecognized name falls back to UTC.

## How the rates apply

An off-peak rate replaces the rate that would otherwise apply rather than discounting it. That includes tiered `above_{N}k` pricing: while a window is open, the flat off-peak rate bills the whole request. The block supports `input_cost_per_token`, `output_cost_per_token`, `output_cost_per_reasoning_token`, `cache_read_input_token_cost`, and `cache_creation_input_token_cost`; any of them left unset falls back to the standard rate. When `output_cost_per_reasoning_token` is unset, reasoning tokens bill the way they do outside the window: at the model's dedicated reasoning rate if it has one, otherwise at the output rate, off-peak included. The one-hour cache creation rate (`cache_creation_input_token_cost_above_1hr`) is never affected.

A request is priced by its completion time. A request that starts at the standard rate and finishes inside a window bills entirely at the off-peak rate, and one that crosses out of the window bills entirely at the standard rate.

Malformed windows and weekday values never match, so a typo in the schedule bills at the standard rate rather than applying the discount at the wrong time. Verify a new schedule by comparing tracked spend for the same request inside and outside a window, via `/spend/logs` or the usage dashboard.

`off_peak_pricing` works wherever a model pricing entry lives: deployment `model_info` as above, an entry in a [custom hosted cost map](./custom_model_cost_map#option-2-serve-your-own-cost-map), or `litellm.register_model` in the SDK. It is not a [custom pricing override](./custom_pricing), so setting it inside `litellm_params` has no effect.
