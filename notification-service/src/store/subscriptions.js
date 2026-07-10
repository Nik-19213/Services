/**
 * In-memory store: walletAddress (lowercase) → PushSubscription object
 * For production, replace with a database.
 */
const store = new Map();

function save(address, subscription) {
  store.set(address.toLowerCase(), subscription);
}

function get(address) {
  return store.get(address.toLowerCase()) || null;
}

function remove(address) {
  store.delete(address.toLowerCase());
}

function all() {
  return [...store.entries()];
}

module.exports = { save, get, remove, all };
