# Invalid fixtures

Each file here is a trace event that must fail validation, paired with the code
the validator has to report. `trace-event.test.ts` asserts on the code, not just
on "it failed", so a fixture that starts failing for a different reason is a
test failure rather than a silent pass.

They are the day 3 done-when — "a broken fixture fails" — and they are also the
cheapest documentation of what the format actually rules out.

| File | Must report |
|---|---|
| `bad-trace-id.json` | `TRACE_BAD_TRACE_ID` |
| `self-parent.json` | `TRACE_SELF_PARENT` |
| `unknown-event-kind.json` | `TRACE_UNKNOWN_EVENT_KIND` |
| `unknown-attribute.json` | `TRACE_UNKNOWN_ATTRIBUTE` |
| `missing-required-attribute.json` | `TRACE_MISSING_ATTRIBUTE` |
| `sequence-as-number.json` | `TRACE_BAD_ATTRIBUTE_TYPE` |
| `rejected-but-ok.json` | `TRACE_STATUS_CONTRADICTS_KIND` |
| `settled-without-end.json` | `TRACE_SETTLED_WITHOUT_END` |
| `error-without-message.json` | `TRACE_MISSING_ERROR_MESSAGE` |
| `end-before-start.json` | `TRACE_END_BEFORE_START` |
| `nested-attribute.json` | `TRACE_BAD_ATTRIBUTE_VALUE` |
| `extra-top-level-field.json` | `TRACE_UNKNOWN_FIELD` |
| `incarnation-as-string.json` | `TRACE_BAD_ATTRIBUTE_TYPE` |
