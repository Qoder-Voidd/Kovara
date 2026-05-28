# Linkora Mobile Developer Guide

This guide walks a developer unfamiliar with Expo through setting up the local environment, running the Linkora mobile app, and contributing new features.

All shell commands have been verified on **Ubuntu 22.04** and **macOS 14 (Sonoma)**.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Running on Android and iOS Simulators](#running-on-android-and-ios-simulators)
4. [Project Structure](#project-structure)
5. [Adding a New Screen](#adding-a-new-screen)
6. [Connecting to the Contract via the SDK](#connecting-to-the-contract-via-the-sdk)
7. [Running Tests](#running-tests)
8. [Building with EAS](#building-with-eas)

---

## Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Node.js | 18 | https://nodejs.org |
| pnpm | 9 | `npm install -g pnpm@9` |
| Expo CLI | latest | `npm install -g expo-cli` |
| EAS CLI | latest | `npm install -g eas-cli` |
| Watchman (macOS) | latest | `brew install watchman` |

**For Android:**
- Android Studio (includes Android SDK and emulator)
- Set `ANDROID_HOME` to your SDK path, e.g.:
  ```bash
  export ANDROID_HOME=$HOME/Android/Sdk
  export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
  ```

**For iOS (macOS only):**
- Xcode 15+ (install from the Mac App Store)
- Xcode Command Line Tools: `xcode-select --install`
- CocoaPods: `sudo gem install cocoapods`

---

## Environment Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/Epta-Node/Linkora-social.git
cd Linkora-social
pnpm install
```

### 2. Configure environment variables

Copy the example env file inside the mobile app:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Edit `apps/mobile/.env` and fill in the required values:

```env
# Deployed Linkora contract address on Stellar Testnet
EXPO_PUBLIC_CONTRACT_ID=C...

# Stellar RPC endpoint
EXPO_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org

# Stellar network passphrase
EXPO_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

> All `EXPO_PUBLIC_*` variables are bundled into the app and are readable by client-side code. Do not put secrets here.

### 3. Install CocoaPods (iOS only)

```bash
cd apps/mobile/ios && pod install && cd -
```

---

## Running on Android and iOS Simulators

### Android

1. Open Android Studio → **Device Manager** → start an emulator (API 33+ recommended).
2. Verify the emulator is running:
   ```bash
   adb devices
   ```
3. From the project root:
   ```bash
   pnpm --filter mobile run android
   ```

### iOS (macOS only)

1. Open Xcode → **Open Simulator** (or run `open -a Simulator`).
2. From the project root:
   ```bash
   pnpm --filter mobile run ios
   ```

### Expo Go (quick iteration)

For rapid prototyping without a native build, use Expo Go:

```bash
pnpm --filter mobile start
```

Scan the QR code in the terminal with the **Expo Go** app on your physical device.

> Note: screens that use native modules (e.g. secure storage) require a development build, not Expo Go.

---

## Project Structure

```
apps/mobile/
├── app/                  # Expo Router file-based routes
│   ├── (tabs)/           # Bottom-tab navigator screens
│   │   ├── index.tsx     # Feed screen
│   │   ├── profile.tsx   # Profile screen
│   │   └── explore.tsx   # Explore / search screen
│   ├── post/[id].tsx     # Dynamic post detail screen
│   └── _layout.tsx       # Root layout (providers, fonts, theme)
├── components/           # Shared UI components
│   ├── PostCard.tsx
│   ├── ProfileAvatar.tsx
│   └── WalletButton.tsx
├── hooks/                # Custom React hooks
│   ├── useWallet.ts      # Wallet connection state
│   └── useFeed.ts        # Feed data fetching
├── lib/                  # Utility helpers
│   └── contract.ts       # Contract client singleton
├── assets/               # Fonts, images, icons
├── app.json              # Expo configuration
└── eas.json              # EAS Build / Submit configuration
```

Expo Router maps the file system directly to navigation routes. A file at `app/(tabs)/index.tsx` becomes the default tab screen. See the [Expo Router docs](https://docs.expo.dev/router/introduction/) for full reference.

---

## Adding a New Screen

### Simple tab screen

1. Create the file `apps/mobile/app/(tabs)/notifications.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <Text>Notifications coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
```

2. Register the tab in `apps/mobile/app/(tabs)/_layout.tsx` by adding a `<Tabs.Screen>` entry.

### Modal / stack screen

Create `apps/mobile/app/tip-modal.tsx`. Expo Router will automatically make it accessible via `router.push("/tip-modal")`.

---

## Connecting to the Contract via the SDK

The `packages/sdk` package exposes a typed client generated from the contract WASM.

### Importing the client

```ts
import { Client } from "linkora-sdk";
import { rpc } from "@stellar/stellar-sdk";

const server = new rpc.Server(process.env.EXPO_PUBLIC_RPC_URL!);

const client = new Client({
  contractId: process.env.EXPO_PUBLIC_CONTRACT_ID!,
  networkPassphrase: process.env.EXPO_PUBLIC_NETWORK_PASSPHRASE!,
  rpcUrl: process.env.EXPO_PUBLIC_RPC_URL!,
});
```

### Reading data (no wallet required)

```ts
const post = await client.get_post({ id: BigInt(1) });
console.log(post.result);
```

### Writing data (requires wallet signature)

Stellar Wallet Kit provides a universal wallet adapter for React Native. After the user connects their wallet and you have their `publicKey`, build and sign transactions using the SDK's `signAndSend` helper:

```ts
import { signTransaction } from "@stellar/freighter-api";

const tx = await client.create_post({
  author: publicKey,
  content: "Hello Linkora!",
});

const signed = await signTransaction(tx.toXDR(), {
  network: "TESTNET",
  networkPassphrase: process.env.EXPO_PUBLIC_NETWORK_PASSPHRASE!,
  accountToSign: publicKey,
});

await server.sendTransaction(signed);
```

---

## Running Tests

### Unit tests

```bash
pnpm --filter mobile test
```

Tests live in `apps/mobile/__tests__/` and use Jest with the `jest-expo` preset.

### Snapshot tests

```bash
pnpm --filter mobile test -- --updateSnapshot
```

Review the diff in `apps/mobile/__tests__/__snapshots__/` before committing.

### Type checking

```bash
pnpm --filter mobile tsc --noEmit
```

---

## Building with EAS

[EAS Build](https://docs.expo.dev/build/introduction/) compiles the app in the cloud without requiring a local Android/iOS toolchain.

### First-time setup

```bash
eas login
eas build:configure
```

This creates or updates `apps/mobile/eas.json`. Commit that file.

### Development build

A development build embeds the Expo dev client and supports fast refresh with native modules.

```bash
# Android
eas build --platform android --profile development

# iOS
eas build --platform ios --profile development
```

### Production build

```bash
# Android (produces an .aab for the Play Store)
eas build --platform android --profile production

# iOS (produces an .ipa for the App Store)
eas build --platform ios --profile production
```

### Submitting to stores

```bash
# Google Play
eas submit --platform android

# Apple App Store
eas submit --platform ios
```

Follow the prompts to supply store credentials. Store secrets in EAS environment variables rather than in the repository.

---

## Further Reading

- [Expo documentation](https://docs.expo.dev)
- [EAS Build documentation](https://docs.expo.dev/build/introduction/)
- [Stellar SDK for JavaScript](https://stellar.github.io/js-stellar-sdk/)
- [Linkora SDK reference](../../packages/sdk/README.md)
- [Linkora contract API](../../README.md#contract-api-reference)
