# Firebase Firestore and Auth

Markdown Studio keeps editor persistence local-first with Dexie/IndexedDB. Firebase is used for Google sign-in and explicit share publishing.

## Environment

Configure the Vite Firebase variables from `.env.example`:

```txt
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

Google sign-in uses Firebase Auth with `signInWithPopup` and `prompt: select_account`.

## Current Behavior

- `/editor` continues to save editable documents locally in IndexedDB.
- Unauthenticated users can edit locally but must sign in with Google to share.
- Creating a share link writes a Firestore document in `sharedDocuments`.
- Updating an existing share link updates that Firestore document.
- `/share/:id` loads title, markdown, and owner metadata from Firestore in read-only mode.
- Shared pages are public by ID.
- Owners see `Edit Original`; non-owners see `Make a Copy`.
- Theme is not stored in Firestore; shared pages use the app-level local theme preference.

## Firestore Document Shape

Collection: `sharedDocuments`

```json
{
  "title": "string",
  "markdown": "string",
  "ownerUid": "string",
  "ownerDisplayName": "string",
  "ownerEmail": "string",
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000,
  "sourceDocId": "optional string"
}
```

## Firestore Rules

Public reads are allowed. Creates require auth and matching ownership. Updates and deletes require the original owner and must preserve `ownerUid`.

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /sharedDocuments/{docId} {
      allow read: if true;
      allow create: if request.auth != null
        && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if request.auth != null
        && resource.data.ownerUid == request.auth.uid
        && request.resource.data.ownerUid == resource.data.ownerUid;
    }
  }
}
```

For production hardening, add schema validation, size limits, rate limits/abuse controls, optional expiry, and stricter update field checks.
