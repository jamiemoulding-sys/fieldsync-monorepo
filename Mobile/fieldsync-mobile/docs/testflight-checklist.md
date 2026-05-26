# FieldSync iOS Internal TestFlight Checklist

This checklist prepares the FieldSync Expo app for an internal TestFlight build without committing secrets or uploading automatically.

## Current App Identity

- App name: FieldSync
- Expo slug: fieldsync-mobile
- iOS bundle identifier: com.zorviatech.fieldsyncmobile
- Production API URL in app config: https://app.zorviatech.co.uk/api

## Required EAS Environment Variables

Set these in EAS before building. Do not commit the values to the repository.

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY

Optional override if the API host changes:

- EXPO_PUBLIC_API_URL

## Build Command

Run from `Mobile/fieldsync-mobile`:

```sh
eas build --platform ios --profile testflight
```

## Submit Command

Run only after the build is ready and App Store Connect is configured:

```sh
eas submit --platform ios --profile testflight --latest
```

## Apple Developer Prerequisites

- Active Apple Developer Program membership.
- Apple team access for signing certificates and provisioning profiles.
- App Store Connect app created with bundle ID `com.zorviatech.fieldsyncmobile`.
- Internal testers added in App Store Connect.
- App privacy details prepared, including location usage and account data handling.

## App Store Connect Setup

- Confirm the app record uses the FieldSync name and bundle ID.
- Confirm encryption export compliance answer matches `ITSAppUsesNonExemptEncryption`.
- Confirm location permission descriptions match FieldSync's shift tracking behavior.
- Confirm TestFlight internal testing group is created before submitting the build.

## Pre-Build Checks

```sh
npm run check
npm --workspace Mobile/fieldsync-mobile run lint
npx expo config --json
```

## Internal TestFlight Smoke Test

- Login and logout.
- View dashboard/home data.
- View schedule.
- Clock in and clock out at an assigned location.
- Confirm tracking starts after clock-in and stops after clock-out.
- View shift history.
- View payslips and test signed download flow.
- Confirm offline and API error states are understandable.
