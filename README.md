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
1. Start identity server: `cd services/iota-identity-backend && ./start.sh`
2. Run: `npm run demo:tui`
3. Negative case: `npm run demo:tui:fail`

## Move contracts (testnet)
- notia_anchor: 0xf3153d...
- border_compliance: 0x48ba85...
- vehicle_certificate: 0xd6e889...
- cargo_manifest: 0xd1ffed...

## Environment
Copy .env.example and fill in keys.
