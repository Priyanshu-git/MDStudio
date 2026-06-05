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
- Unauthenticated users can edit locally but must sign in with Google to see backed-up Recent Documents or share.
- Signed-in users can back up editable documents to private owner-only user document collections.
- Creating a share link writes a Firestore document in `sharedDocuments`.
- After link creation, the local document is marked as Firebase-backed with `sourceShareId` and `sourceOwnerUid`.
- The current share dialog shows the existing link and copy action for already-linked documents; it does not expose an update-link action.
- The storage service and Firestore rules support owner updates, but the current editor UI intentionally does not expose an update action after a link exists.
- `/share/:id` loads title, markdown, and owner metadata from Firestore in read-only mode.
- Shared pages are public by ID.
- Owners see `Edit Original`; non-owners see `Make a Copy`.
- `Edit Original` reuses the shared document's `sourceDocId` when it exists locally, otherwise creates a Firebase-sourced local document.
- Non-owner copies are new local documents and do not keep Firebase source metadata.
- Theme is not stored in Firestore; shared pages use the app-level local theme preference.

## Private Firestore Document Shape

Collection path: `users/{uid}/documents/{documentId}`

```json
{
  "title": "string",
  "markdown": "string",
  "ownerUid": "user uid",
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000,
  "localDocumentId": "optional local id",
  "deletedAt": "legacy optional timestamp"
}
```

Only the authenticated owner can read or write these documents.
Deleting a private backup hard-deletes the document from this collection. Older records with `deletedAt` are legacy tombstones and are ignored by the app.

## Legacy Deleted Document Cleanup

`npm run cleanup:deleted-cloud-docs` scans private `users/{uid}/documents` subcollections for legacy records where `deletedAt > 0`. The default run is a dry run that prints matched paths, titles, and owners without deleting anything.

To delete the matched legacy tombstones, run:

```bash
npm run cleanup:deleted-cloud-docs -- --confirm
```

The script requires Firebase Admin credentials through `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_SERVICE_ACCOUNT_PATH`, `FIREBASE_SERVICE_ACCOUNT_JSON`, or the matching values in `.env.local`.

## Shared Firestore Document Shape

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
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    match /users/{userId}/documents/{docId} {
      allow read, delete: if isOwner(userId);
      allow create: if isOwner(userId)
        && request.resource.data.ownerUid == userId;
      allow update: if isOwner(userId)
        && resource.data.ownerUid == userId
        && request.resource.data.ownerUid == userId;
    }

    match /sharedDocuments/{docId} {
      allow read: if true;
      allow create: if isSignedIn()
        && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if isSignedIn()
        && resource.data.ownerUid == request.auth.uid
        && request.resource.data.ownerUid == resource.data.ownerUid;
    }
  }
}
```

For production hardening, add schema validation, size limits, rate limits/abuse controls, optional expiry, and stricter update field checks.
