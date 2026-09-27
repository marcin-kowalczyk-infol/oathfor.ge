# ADR 0006: Patch React Native for stale image deliveries

Status: accepted by owner decision, 2026-09-27. Implemented in MVP-18-T11, 2026-09-27.

## Context

On iOS the Oath creation backdrop sometimes showed the state seal sprite sheet instead of the hearth close-up (MVP-18 native acceptance, see [testing](../engineering/testing.md#main-menu-acceptance-mvp-18-2026-09-26)). React Native 0.86.3 with Fabric reuses an unmounted `RCTImageComponentView` for another image. An image response of the old request that is already queued on the main thread is then applied to the new image. Upstream describes the same race in [react/react-native issue 58667](https://github.com/react/react-native/issues/58667), opened 2026-09-24. The fix, [PR 58669](https://github.com/react/react-native/pull/58669), landed on `main` as [53bf98b](https://github.com/react/react-native/commit/53bf98bf40713fad1bbe00a652d2aabce8b91eb1) on 2026-09-25. On 2026-09-27 it was not part of 0.86.3, 0.87.1 or 0.88.0-rc.2. The project uses Expo SDK 57 with React Native 0.86.3, and `npx expo install --check` accepts that pair.

Expo Go ships its own native binary, so a JavaScript change cannot fix it there. React Native 0.86 uses precompiled core binaries by default (`scripts/react_native_pods.rb` in the 0.86.3 package), so a patched source file is ignored unless React Native is built from source.

## Decision

Backport 53bf98b unchanged as `apps/mobile/patches/react-native+0.86.3.patch`. [patch-package](https://github.com/ds300/patch-package) 8.0.1, pinned, applies it from the `postinstall` script with `--error-on-fail`. `expo-build-properties` sets `ios.buildReactNativeFromSource` ([Expo build properties for SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/)), so native iOS builds compile the patched file. The generated Podfile only defaults the prebuilt switches with `||=`, so an exported `RCT_USE_PREBUILT_RNCORE=1` or `RCT_USE_RN_DEP=1` would still link the unpatched core. `npm run demo:build-ios` refuses to start with either set to `1` and stops unless `pod install` prints `[ReactNativeCore] Building from source: true`.

The iOS 27 SDK stops apps without the UIScene life cycle at launch, and the Expo SDK 57 template lacks it. `expo-build-properties` also sets `ios.enableSceneSupport`, which Expo provides for exactly this case in SDK 57 (same documentation, expo/expo PR 50205 and 50221). The simulator demo gets a Debug development build with generated, ignored native folders, built by `npm run demo:build-ios` as described in the [development guide](../engineering/development.md#demo-development-build-and-react-native-patch). `scripts/reactNativePatch.test.js` fails when the patch, its pinned version, the installed fix, the source build setting or the scene setting is missing.

Drop the patch, the test and the source build setting once the Expo SDK in use ships a React Native release that contains 53bf98b. Remove `ios.enableSceneSupport` with the move to Expo SDK 58, where it is a no-op.

## Alternatives considered

- Wait for a React Native release. Rejected: the defect is visible now and no release date is known.
- Work around it in JavaScript, for example with keys that force a new view. Rejected: it hides one symptom, depends on recycling internals and does not fix other images.
- Prebuilt React Native with the patch. Not possible: the precompiled core does not contain the patched file.
- A local config plugin for the scene life cycle. Used first, then dropped after review: `ios.enableSceneSupport` makes the same AppDelegate and Info.plist change with Expo's scene delegate, checks the Expo version, becomes a no-op on SDK 58, refuses to overwrite an existing scene manifest and tolerates other plugins that edit the startup block.

## Consequences

Native iOS builds are slower because React Native and Expo modules compile from source. Every install must run `postinstall`. patch-package is a devDependency, so `npm ci --omit=dev` fails, and no pipeline installs that way today. A React Native upgrade fails the install until the patch is regenerated or removed. Expo Go keeps showing the defect, so image acceptance needs the development build. The demo development build uses an unregistered placeholder bundle identifier and is for simulators only.
