# NCR Engine

NCR (Notia Compliance Runtime) is the execution/runtime layer.

It consumes the chain-agnostic semantic standard from `@notia/core` and applies runtime compliance workflows (BorderTest), on-chain verifications, and anchoring.

## Responsibility

- Run compliance scenarios using semantic bundles from `@notia/core`
- Verify identity and assets using IOTA adapters
- Evaluate policy/runtime decisions for operational flows
- Anchor compliance evidence on IOTA testnet

## Not in This Repo

The semantic standard itself is in `notia-core` (`@notia/core`):

- canonical semantic model
- deterministic semantic pipeline
- structural/core schema validation logic

## Main Runtime Areas

- `src/bordertest/` runtime composition/evaluation/demo
- `src/iota/` IOTA integrations and on-chain verifiers
- `src/cli/` CLI runtime entrypoints
- `move/` Move contracts
- `events/` runtime event fixtures

## Build

```bash
npm install
npm run build
```
