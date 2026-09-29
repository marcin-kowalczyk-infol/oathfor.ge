# Simulator demo

Local development fixture for [MVP-05-T12](../../../docs/product/oath-visual-polish.md). From `apps/mobile`, using the Node version in the repository `.nvmrc`:

```sh
npm ci
npm run demo -- --ios --localhost
```

The isolated Expo project serves `demo/index.ts` on port **8082**. The production `index.ts`, app entry and dependencies remain unchanged. Open the available iPhone simulator in Expo Go. `npm run demo -- --localhost` starts the same server without opening a simulator. The launcher's extra arguments are passed to Expo. It requests IPv4-first local DNS so Metro's localhost listener matches the IPv4 address advertised to Expo Go. A caller `--port` replaces 8082. Expo Go cannot carry native fixes, so check images in the demo development build described in the [development guide](../../../docs/engineering/development.md#demo-development-build-and-react-native-patch).

A small **DEMO** button opens controls away from the player journey. The demo starts with the empty, onboarded Forge, so the real character creation screen appears first. After a character exists the app shows its own main menu, and "Enter the Forge" opens the app's Forge room. The demo no longer draws a room of its own. Controls offer PL/EN, fresh onboarding, empty Forge, returning player, interface restart, expired session, offline/online, lost next acceptance response, and adding an Oath. Returning data includes three current Oaths and 22 historical records for pagination. Player characters are DUMMY too. The returning player has two characters, Radomir (active, owner of all returning Oaths) and Wiesna, so the menu card and the change-character screen can switch between them or add a third. Radomir uses starter 2 in the thin build and Wiesna starter 3 in the heavy build. The DUMMY character client offers the six owner starters `starter_01` to `starter_06`, accepts the `thin` or `heavy` build, replays a repeated creation request only when name, preset, build and form match, and uses deterministic IDs. "Lost next response" also applies to character creation when it comes first. Adding an Oath while a pause review in Settings is open allows checking stale revision handling. Pull Today down, or leave and return to the app, to fetch the added record. Going back online in the controls counts as a network reconnect and reloads the visible list, because the simulator's own connection does not drop.

All authentication, API responses, service time and persistence are **DUMMY**, isolated in `runtime.ts`. No credentials or live API calls are used. Rule text and policy come directly from the authoritative `apps/api/resources/oath/workout_oath_v1.json`. The demo does not carry a second copy of policy. Interface restart preserves in-memory pending confirmation and the room guide flag, while scenario reset, Metro reload and process restart lose all data. The demo cannot establish SecureStore/Keychain persistence, Apple authentication, real backend ordering/reconciliation, delivery, proof or rewards. Its local-time resolver is a deterministic walkthrough substitute, not the production authority. Native permission adapters are inert.

The launcher explicitly sets `NODE_ENV=development` and `OATHFORGE_DEMO=1`. Configuration rejects missing flags and production. Metro additionally rejects every `dev=false` bundle request; the entry guards DUMMY initialization with `__DEV__`. The production entry has no reference to this isolated project.

```sh
npm test -- --runInBand demo
# From demo/; must fail with “development-only”:
NODE_ENV=production OATHFORGE_DEMO=1 node ../node_modules/expo/bin/cli export --platform ios
```

Verified during implementation: focused tests, TypeScript, live iOS development bundle from port 8082, rejected production export, and HTTP 500 for a `dev=false` bundle. Native visual/accessibility verification is recorded separately in the task evidence; bundling is not native acceptance.

## Simulator walkthrough (pending native acceptance)

1. On the empty Forge, create a character, enter the Forge from the menu, touch the hearth and create an Oath, choose activity, pick completion date/time, optionally search/change timezone, then view rules. Return to the Forge, touch the hearth again and verify the draft remains.
2. Read the promise, activation, completion, receipt cutoff and both evidence alternatives; scroll through every rule. Only the final explicit action commits. Open the resulting detail and compare the stored times.
3. In demo controls select the returning scenario. Enter the Forge from the menu, open the seals and one Oath detail, compare it to the full list, then inspect History and load the second page.
4. In Settings, open the pause row and review every withdrawal/preserve row. Adding a synthetic Oath from demo controls before confirming exercises the changed-revision review. Resume and check withdrawals remain in History.
5. Arm a lost reply before confirmation; recover it without creating a second Oath. Toggle offline to exercise retry; expire the session to exercise reauthentication. These are DUMMY scenarios, not real transport/provider evidence.
6. Repeat in EN, at a smaller supported simulator size, with system larger text and Reduce Motion. Check VoiceOver reading order, selected values, error announcement and focus where the simulator supports it. Record actual runtime/settings and blockers; do not substitute static font scaling for native acceptance.

## Forge room

The room is the app component `src/forge/ForgeRoom.tsx` with `src/forge/StationEffect.tsx`, reached through the main menu. Its copy lives in the main catalogs under `room`, and `demo/locales` keeps only the controls copy. The active character walks to each place and Żaromir stands aside, so the returning player (Radomir, pilot sprites) shows the full [Forge scene](../../../docs/product/forge-scene.md). Palenisko/Hearth, Pieczęcie/Seals, Kronika/Chronicle and the door each play a distinct decorative response. Arrival never creates an Oath or grants rewards. The dialogue panel's named action flies the camera into creation, current Oaths or history. One touch on Żaromir gives a hint and two counters from the demo counts. "Return to the Forge" goes back to the room while the Oath screens stay mounted, so drafts and unresolved acceptance survive. The moonlit door is a visit whose action returns to the menu. The four-step guide starts on the first room entry of each scenario. The DUMMY runtime keeps its "seen" flag in memory per account, in place of the app's device storage. Interface restart keeps it and a scenario reset clears it. The menu's Tutorial tile replays the guide. At large text or on a narrow window the app uses its simple layout, where "Enter the Forge" opens the Today list directly.

Artwork is provisional. Żaromir uses eight walk directions, a breathing loop, a pose facing each place, a turn and talk gestures over a room backdrop. Each place plays a sprite response on arrival, candles flicker and the seal drums are cut out so he can stand behind them in the doorway. See the [Forge motion assets](../../../docs/art/forge-motion-assets.md). Screens hidden behind the visible one are motion-suspended. See the [room handoff](../../../docs/art/forge-stations-prototype.md) and the [places manifest](../../../docs/art/forge-places-assets.md). No new dependency or external account is required.
