export function runInTransaction(db, fn) {
  if (typeof db.transaction === "function") return db.transaction(fn)();

  db.exec("begin immediate");
  try {
    const result = fn();
    db.exec("commit");
    return result;
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

export function json(value) {
  return JSON.stringify(value ?? null);
}

export function boolInt(value) {
  return value ? 1 : 0;
}
