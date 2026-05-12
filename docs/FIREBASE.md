# Firebase Firestore (Sharing MVP)

Markdown Studio keeps editor persistence local-first with Dexie/IndexedDB. Firestore is used only for manual share publishing and shared route reads.

## Current Behavior

- `/editor` continues to autosave locally in IndexedDB.
- Clicking `Publish` creates a Firestore document in `sharedDocuments`.
- `/share/:id` loads markdown from Firestore in read-only mode.
- Theme is not stored in Firestore; shared pages render with `github-light`.

## Firestore Document Shape

Collection: `sharedDocuments`

```json
{
  "markdown": "string",
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000,
  "sourceDocId": "optional string"
}
```

## Firestore Rules for MVP

This MVP uses public-by-ID sharing without auth. Start with open rules while iterating:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sharedDocuments/{docId} {
      allow read, write: if true;
    }
  }
}
```

For production hardening, replace with stricter rules (auth, write limits, abuse controls, and optional expiry).
