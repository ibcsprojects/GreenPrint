// The extension's permanent identity. Chrome derives an extension's ID from its public key.
// A copy loaded unpacked has no key of its own, so its ID comes from the folder it sits in and
// changes if the folder moves. Putting the Chrome Web Store's public key in the manifest of
// local builds makes every copy get the store's ID, so Google sign-in is registered once for
// that single ID and works for everyone.
//
// This is a PUBLIC key: it ships inside every published package, so it is safe to commit.
// It must NOT be in the package uploaded to the store (the store adds its own), which is why
// `npm run build:store` leaves it out. See docs/SETUP.md.

/** The Chrome Web Store item's public key (the manifest `key` field: base64, no PEM lines). */
export const EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAswZrd/VNXGQApBS5ys3SX5UnmEMA735mA0TG7KBgv6FmcGnelHtS0Oxk7uiU/eIVIJHw1UgTSQZGoKrStHNdFEAxDyGPC7nJTvqO/OWfON8edwKLKHqvOUC8n0JvmQHoLMKo4rrW00fhs/gvmjOD/Rw1ymmpoAFBvWzo+JF9pse5jt+y8TlUqPbC01YF31Rx6VYKgbP5uOuN4FOfL6BRq/ffMe6vUpjwgr+YsQwOTaS0V2aKl0js8pzfsID6lDS14/Lt6bboyHUIQ7DxwsNRb08B5VLd3i8NxCuS7mMMqey/SphxcCs85gBbhcJnWQdmXD6ms8kLAksclpZEeWllVQIDAQAB'

/** The ID the store gave the item, and so the ID of every build that carries the key. */
export const STORE_EXTENSION_ID = 'ckpmdoeegcphjabkldemolclppipjkan'
