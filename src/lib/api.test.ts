import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST, GET } from "../app/api/club/route";
import { db } from "./server/database";
const folder = mkdtempSync(path.join(tmpdir(), "team-tong-api-"));
process.env.TEAM_TONG_DB = path.join(folder, "test.sqlite");
after(() => {
  db().close();
  rmSync(folder, { recursive: true, force: true });
});
test("HTTP account endpoints enforce origin, sessions, pending approval, and logout", async () => {
  const post = (body: unknown, cookie = "", origin = "http://127.0.0.1:3000") =>
    POST(
      new NextRequest("http://localhost:3000/api/club", {
        method: "POST",
        headers: {
          origin,
          host: "127.0.0.1:3000",
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify(body),
      }),
    );
  assert.equal(
    (
      await post(
        {
          type: "register",
          email: "qa@example.test",
          name: "QA",
          password: "test-password-123",
        },
        "",
        "https://attacker.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post({
        type: "register",
        email: "qa@example.test",
        name: "QA",
        password: "test-password-123",
      })
    ).status,
    200,
  );
  const login = await post({
    type: "login",
    email: "qa@example.test",
    password: "test-password-123",
  });
  assert.equal(login.status, 200);
  const header = login.headers.get("set-cookie")!;
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=strict/i);
  const cookie = header.split(";")[0];
  const read = () =>
    GET(
      new NextRequest("http://localhost:3000/api/club", {
        headers: { host: "127.0.0.1:3000", cookie },
      }),
    );
  const pending = await (await read()).json();
  assert.equal(pending.user.status, "pending");
  assert.equal(pending.user.password, undefined);
  assert.equal(pending.store, undefined);
  assert.equal(
    (
      await post(
        {
          type: "create",
          venue: "Turf",
          date: "2026-11-01",
          time: "20:30",
          fee: 5000,
        },
        cookie,
      )
    ).status,
    403,
  );
  assert.equal((await post({ type: "logout" }, cookie)).status, 200);
  assert.equal((await (await read()).json()).user, null);
});

test("HTTP rooms never return private data to nonmembers and ignore legacy global organizer authority", async () => {
  const post = (body: unknown, cookie = "", room = "") =>
    POST(
      new NextRequest(
        "http://localhost:3000/api/club" + (room ? "?room=" + room : ""),
        {
          method: "POST",
          headers: {
            origin: "http://127.0.0.1:3000",
            host: "127.0.0.1:3000",
            cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        },
      ),
    );
  const read = (cookie: string, room = "") =>
    GET(
      new NextRequest(
        "http://localhost:3000/api/club" + (room ? "?room=" + room : ""),
        { headers: { host: "127.0.0.1:3000", cookie } },
      ),
    );
  async function createAccount(email: string) {
    await post({
      type: "register",
      email,
      name: "API tester",
      password: "test-password-123",
    });
    await db()
      .prepare("UPDATE accounts SET email_verified=1 WHERE email=?")
      .run(email);
    const r = await post({
      type: "login",
      email,
      password: "test-password-123",
    });
    return r.headers.get("set-cookie")!.split(";")[0];
  }
  const owner = await createAccount("owner-api@example.test"),
    other = await createAccount("other-api@example.test");
  const room = (
    await (
      await post({ type: "roomCreate", name: "Private API room" }, owner)
    ).json()
  ).roomId;
  const outside = await (await read(other, room)).json();
  assert.equal(outside.store, undefined);
  assert.equal(outside.room, undefined);
  await db()
    .prepare(
      "UPDATE accounts SET role='organizer',status='approved' WHERE email=?",
    )
    .run("other-api@example.test");
  assert.notEqual(
    (
      await post(
        {
          type: "create",
          venue: "Denied",
          date: "2026-11-03",
          time: "20:00",
          fee: 500,
        },
        other,
        room,
      )
    ).status,
    200,
  );
  const info = await (await read(owner, room)).json();
  const preview = await (
    await post({ type: "invitePreview", code: info.room.code })
  ).json();
  assert.deepEqual(Object.keys(preview.invitation).sort(), ["logo", "name"]);
  await post({ type: "roomJoin", code: info.room.code }, other);
  assert.equal((await (await read(other, room)).json()).store, undefined);
  const otherId = (await (await read(other)).json()).user.id;
  await post({ type: "roomDecide", user: otherId, approve: true }, owner, room);
  const approved = await (await read(other, room)).json();
  assert.equal(approved.user.role, "member");
  assert.equal(approved.room.code, undefined);
  assert.deepEqual(approved.members, []);
  assert.notEqual(
    (
      await post(
        { type: "roomRole", user: otherId, organizer: true },
        other,
        room,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await post(
        {
          type: "create",
          venue: "Allowed",
          date: "2026-11-03",
          time: "20:00",
          fee: 500,
        },
        owner,
        room,
      )
    ).status,
    200,
  );
  assert.equal(
    (await (await read(other, room)).json()).store.matches.length,
    1,
  );
});
