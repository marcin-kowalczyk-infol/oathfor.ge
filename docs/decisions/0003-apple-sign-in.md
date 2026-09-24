# ADR 0003 — Sign in with Apple

Status: accepted route; native credential boundary implemented; account/session integration pending.
Date: 2026-09-24.

## Decision and context

The owner selected **Sign in with Apple** as the single initial sign-in route for the iOS MVP. Email codes were considered and not selected. This is a local product decision, not a claim that Android sign-in is implemented.

Use `expo-apple-authentication` for the native request. Configure its plugin and `ios.usesAppleSignIn`; the eventual screen uses the native Apple button only when available. The SDK supports nonce/state and a cancellation outcome. Configuration changes require a rebuilt binary; Expo Go identifiers can differ from a standalone app. Real-device checks remain necessary. **Technical basis:** [Expo SDK 57 AppleAuthentication](https://docs.expo.dev/versions/v57.0.0/sdk/apple-authentication/), checked 2026-09-24.

## Implemented boundary

`apps/mobile/src/auth/appleCredential.ts` accepts caller-supplied nonce/state, checks availability and requests a credential without name/email scopes. It separates cancellation, unavailability, failure and invalid responses. Missing identity token or mismatched state cannot produce a credential result. Provider exceptions are reduced to reason codes; tokens are not logged or persisted. These are local implementation choices under the [security rules](../../.agents/rules/security.md).

The result is explicitly **unverified**. It neither creates an account nor grants a session. No current screen invokes the adapter. Tests use synthetic DUMMY provider responses; there is no dummy authentication mode in the app.

## Remaining contracts and acceptance

Before login is enabled, the backend slice must define one-use challenge issuance/expiry/consumption, Apple token verification, account identity and session issuance/revocation. Mobile must use that contract, secure credential storage and a usable expiry/sign-out path. This adapter's input is not an HTTP contract and does not replace backend nonce validation. Never trust the mobile result as account identity. Backend authentication ownership follows [architecture](../engineering/architecture.md).

The integration needs a registered iOS bundle identifier with Sign in with Apple capability and a signed build on a physical test device. These are later setup inputs, not credentials to paste into chat. Verify successful login, cancellation, provider failure and revoked credentials against the actual backend. No Apple console changes, live sign-in or signed-device verification have been performed.
