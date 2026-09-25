# Simulator demo

Local development fixture for [MVP-05-T12](../../../docs/product/oath-visual-polish.md). From `apps/mobile`, using the Node version in the repository `.nvmrc`:

```sh
npm ci
npm run demo -- --ios --localhost
```

The isolated Expo project serves `demo/index.ts` on port **8082**. The production `index.ts`, app entry and dependencies remain unchanged. Open the available iPhone simulator in Expo Go. `npm run demo -- --localhost` starts the same server without opening a simulator. The launcher's extra arguments are passed to Expo. It requests IPv4-first local DNS so Metro's localhost listener matches the IPv4 address advertised to Expo Go.

A small **DEMO** button opens controls away from the player journey. It starts with an empty, onboarded Polish Forge. Controls offer PL/EN, fresh onboarding, empty Forge, returning player, interface restart, expired session, offline/online, lost next acceptance response, and adding an Oath. Returning data includes three current Oaths and 22 historical records for pagination. Adding an Oath while a pause preview is open allows checking stale revision handling; refresh Today to fetch the added record.

All authentication, API responses, service time and persistence are **DUMMY**, isolated in `runtime.ts`. No credentials or live API calls are used. Rule text and policy come directly from the authoritative `apps/api/resources/oath/workout_oath_v1.json`; the demo does not carry a second copy of policy. Interface restart preserves in-memory pending confirmation, while scenario reset, Metro reload and process restart lose all data. The demo cannot establish SecureStore/Keychain persistence, Apple authentication, real backend ordering/reconciliation, delivery, proof or rewards. Its local-time resolver is a deterministic walkthrough substitute, not the production authority. Native permission adapters are inert.

The launcher explicitly sets `NODE_ENV=development` and `OATHFORGE_DEMO=1`. Configuration rejects missing flags and production. Metro additionally rejects every `dev=false` bundle request; the entry guards DUMMY initialization with `__DEV__`. The production entry has no reference to this isolated project.

```sh
npm test -- --runInBand demo
# From demo/; must fail with “development-only”:
NODE_ENV=production OATHFORGE_DEMO=1 node ../node_modules/expo/bin/cli export --platform ios
```

Verified during implementation: focused tests, TypeScript, live iOS development bundle from port 8082, rejected production export, and HTTP 500 for a `dev=false` bundle. Native visual/accessibility verification is recorded separately in the task evidence; bundling is not native acceptance.

## Simulator walkthrough (pending native acceptance)

1. On empty Forge, create an Oath, choose activity, pick completion date/time, optionally search/change timezone, then view rules. Return through Today and verify the draft remains.
2. Read the promise, activation, completion, receipt cutoff and both evidence alternatives; scroll through every rule. Only the final explicit action commits. Open the resulting detail and compare the stored times.
3. In demo controls select the returning scenario. Open a hearth seal, compare its detail to the full list, then inspect History and load the second page.
4. Review Pause and every withdrawal/preserve row. Adding a synthetic Oath from demo controls before confirming exercises the changed-revision review. Resume and check withdrawals remain in History.
5. Arm a lost reply before confirmation; recover it without creating a second Oath. Toggle offline to exercise retry; expire the session to exercise reauthentication. These are DUMMY scenarios, not real transport/provider evidence.
6. Repeat in EN, at a smaller supported simulator size, with system larger text and Reduce Motion. Check VoiceOver reading order, selected values, error announcement and focus where the simulator supports it. Record actual runtime/settings and blockers; do not substitute static font scaling for native acceptance.
