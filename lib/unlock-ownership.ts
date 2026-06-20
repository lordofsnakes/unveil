export function persistUnlockOwnership() {
  return process.env.PERSIST_UNLOCK_OWNERSHIP === "true";
}
