// Legacy global organizer promotion is intentionally disabled after room migration.
console.error(
  "Organizer roles now belong to individual rooms. Ask that room’s owner to use Room administration. For a new room, verify your email and choose Create private room. Existing founding-room ownership is preserved automatically.",
);
process.exitCode = 1;
