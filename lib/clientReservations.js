const STORAGE_PREFIX = "crafty-studio-reservations";
const UPDATED_EVENT = "crafty-studio-reservations-updated";

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId || "current-user"}`;
}

export function getClientReservationsSnapshot(userId) {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(storageKey(userId)) || "[]";
}

export function subscribeClientReservations(callback) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(UPDATED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(UPDATED_EVENT, callback);
  };
}

export function readClientReservations(userId) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(userId)) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveClientReservations(userId, reservations) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(reservations));
    window.dispatchEvent(new Event(UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function addClientReservations(userId, newReservations) {
  const existing = readClientReservations(userId);
  const updated = [...existing, ...newReservations];
  if (!saveClientReservations(userId, updated)) {
    throw new Error("Could not save the reservation in this browser.");
  }
  return updated;
}
