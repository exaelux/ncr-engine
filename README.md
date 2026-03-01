# NCR — Notia Compliance Runtime

NCR is a compliance runtime that consumes the @notia/core semantic standard.

## Architecture
- notia-core: chain-agnostic semantic standard (CanonicalEvent, SemanticBundle)
- ncr-engine: compliance runtime (BorderTest profile, IOTA adapters)

## Services used
- IOTA Identity: DID + VC + VP verification
- IOTA Notarization: proof hash anchor
- IOTA Move (x4 contracts): anchor, compliance, vehicle_certificate, cargo_manifest
- IOTA Names: joebloggs.iota human-readable identity

## Running the demo
1. Run watch mode: `ncr`
2. Stable mode: `ncr demo`
3. Force watch mode: `ncr watch`
4. Negative case: `npm run demo:tui:fail`

## Scenario profiles
- Profiles are JSON files in `profiles/*.json`
- Default profile: `profiles/bordertest.json`
- Default input mode is on-chain (`eventSource: "onchain"` / `NCR_EVENT_SOURCE=onchain`)
- Run with profile id:
  - `ncr --profile bordertest`
- Run with profile file path:
  - `ncr --profile ./profiles/your-scenario.json`
- You can also set `NCR_PROFILE=bordertest` in the environment
- Optional demo fallback: `NCR_EVENT_SOURCE=file` (reads `eventsPath`)

## Move contracts (testnet)
- notia_anchor: 0xf3153d...
- border_compliance: 0x48ba85...
- vehicle_certificate: 0xd6e889...
- cargo_manifest: 0xd1ffed...

## Environment
Copy .env.example and fill in keys.
