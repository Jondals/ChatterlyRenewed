/**
 * src/routes/social.ts
 * User search, friendships, direct messages and presence.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context';
import { areFriends, getUser, getUsers, orderedPair, toPublicUser, type UserRow } from '../models';
import { usernameField, callerId } from '../validation';

interface FriendRow {
  user_a: string;
  user_b: string;
  requested_by: string;
  status: 'pending' | 'accepted';
}

/** Registers the routes of friends, direct chats and presence. */
export function registerSocialRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, hub } = ctx;
  const me = callerId;
  const auth = { onRequest: [app.authenticate] };

  // ---- user directory -----------------------------------------------------------------------

  app.get(
    '/api/users/search',
    {
      ...auth,
      schema: {
        querystring: {
          type: 'object',
          required: ['q'],
          properties: { q: { type: 'string', minLength: 2, maxLength: 24 } },
        },
      },
    },
    /**
     * GET /api/users/search: users whose name starts with the text (the characters of the pattern are escaped).
     */
    async function (req) {
      const { q } = req.query as { q: string };
      const escaped = q.replace(/[\\%_]/g, function (c) {
        return '\\' + c;
      });
      const rows = db
        .prepare(
          `SELECT * FROM users WHERE username LIKE ? ESCAPE '\\' AND id <> ? ORDER BY username LIMIT 10`,
        )
        .all(escaped + '%', me(req)) as UserRow[];
      return { users: rows.map(toPublicUser) };
    },
  );

  app.get(
    '/api/users',
    {
      ...auth,
      schema: {
        querystring: {
          type: 'object',
          required: ['ids'],
          properties: { ids: { type: 'string', maxLength: 4000 } },
        },
      },
    },
    /** GET /api/users: several users by id (at most 100). */
    async function (req) {
      const ids = (req.query as { ids: string }).ids.split(',').slice(0, 100);
      return { users: getUsers(db, ids) };
    },
  );

  app.get('/api/users/:id', auth, async function (req, reply) {
    const row = getUser(db, (req.params as { id: string }).id);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return { user: toPublicUser(row) };
  });

  // ---- friends ------------------------------------------------------------------------------

  function friendState(userId: string) {
    const rows = db
      .prepare('SELECT * FROM friendships WHERE user_a = ? OR user_b = ?')
      .all(userId, userId) as FriendRow[];
    const friends: string[] = [];
    const incoming: string[] = [];
    const outgoing: string[] = [];
    for (const row of rows) {
      const other = row.user_a === userId ? row.user_b : row.user_a;
      if (row.status === 'accepted') friends.push(other);
      else if (row.requested_by === userId) outgoing.push(other);
      else incoming.push(other);
    }
    return {
      friends,
      incoming,
      outgoing,
      users: getUsers(db, [...friends, ...incoming, ...outgoing]),
    };
  }

  const notifyFriends = function (a: string, b: string) {
    hub.sendTo(a, { t: 'friends.update' });
    hub.sendTo(b, { t: 'friends.update' });
  };

  app.get('/api/friends', auth, async function (req) {
    return friendState(me(req));
  });

  app.post(
    '/api/friends/request',
    {
      ...auth,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['username'],
          properties: { username: usernameField },
        },
      },
    },
    /**
     * POST /api/friends/request: sends a friend request, or accepts it when the other person had already sent one.
     */
    async function (req, reply) {
      const self = me(req);
      const { username } = req.body as { username: string };
      const target = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
        UserRow | undefined;
      if (!target) return reply.code(404).send({ error: 'user_not_found' });
      if (target.id === self) return reply.code(400).send({ error: 'cannot_friend_self' });
      const [a, b] = orderedPair(self, target.id);
      const existing = db
        .prepare('SELECT * FROM friendships WHERE user_a = ? AND user_b = ?')
        .get(a, b) as FriendRow | undefined;
      if (existing) {
        if (existing.status === 'accepted')
          return reply.code(409).send({ error: 'already_friends' });
        if (existing.requested_by === self)
          return reply.code(409).send({ error: 'already_requested' });
        // They already asked us: treat our request as acceptance.
        db.prepare(
          "UPDATE friendships SET status = 'accepted' WHERE user_a = ? AND user_b = ?",
        ).run(a, b);
        notifyFriends(self, target.id);
        return { status: 'accepted' };
      }
      db.prepare(
        "INSERT INTO friendships (user_a, user_b, requested_by, status, created_at) VALUES (?,?,?,'pending',?)",
      ).run(a, b, self, Date.now());
      notifyFriends(self, target.id);
      return reply.code(201).send({ status: 'pending' });
    },
  );

  app.post('/api/friends/:id/accept', auth, async function (req, reply) {
    const self = me(req);
    const other = (req.params as { id: string }).id;
    const [a, b] = orderedPair(self, other);
    const row = db
      .prepare('SELECT * FROM friendships WHERE user_a = ? AND user_b = ?')
      .get(a, b) as FriendRow | undefined;
    if (!row || row.status !== 'pending' || row.requested_by === self) {
      return reply.code(404).send({ error: 'no_pending_request' });
    }
    db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_a = ? AND user_b = ?").run(
      a,
      b,
    );
    notifyFriends(self, other);
    return { status: 'accepted' };
  });

  // Remove a friend, decline an incoming request or cancel an outgoing one.
  app.delete('/api/friends/:id', auth, async function (req, reply) {
    const self = me(req);
    const other = (req.params as { id: string }).id;
    const [a, b] = orderedPair(self, other);
    const result = db.prepare('DELETE FROM friendships WHERE user_a = ? AND user_b = ?').run(a, b);
    if (!result.changes) return reply.code(404).send({ error: 'not_found' });
    notifyFriends(self, other);
    return reply.code(204).send();
  });

  // ---- direct messages ----------------------------------------------------------------------

  app.get('/api/dms', auth, async function (req) {
    const self = me(req);
    const rows = db
      .prepare(
        `SELECT c.id AS channel_id, other.user_id AS user_id,
                (SELECT MAX(created_at) FROM messages m WHERE m.channel_id = c.id) AS last_message_at
           FROM dm_members mine
           JOIN channels c ON c.id = mine.channel_id
           JOIN dm_members other ON other.channel_id = c.id AND other.user_id <> mine.user_id
          WHERE mine.user_id = ?
          ORDER BY COALESCE(last_message_at, c.created_at) DESC`,
      )
      .all(self) as {
      channel_id: string;
      user_id: string;
      last_message_at: number | null;
    }[];
    const dms = rows.map(function (r) {
      return {
        channelId: r.channel_id,
        userId: r.user_id,
        lastMessageAt: r.last_message_at,
      };
    });
    return {
      dms,
      users: getUsers(
        db,
        dms.map(function (d) {
          return d.userId;
        }),
      ),
    };
  });

  app.post(
    '/api/dms',
    {
      ...auth,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['userId'],
          properties: { userId: { type: 'string', maxLength: 64 } },
        },
      },
    },
    /** POST /api/dms: opens the direct chat with a friend (only friends can have one). */
    async function (req, reply) {
      const self = me(req);
      const { userId } = req.body as { userId: string };
      if (userId === self || !areFriends(db, self, userId)) {
        return reply.code(403).send({ error: 'not_friends' });
      }
      const [a, b] = orderedPair(self, userId);
      const dmKey = `${a}:${b}`;
      let channel = db.prepare('SELECT id FROM channels WHERE dm_key = ?').get(dmKey) as
        { id: string } | undefined;
      if (!channel) {
        const id = randomUUID();
        db.transaction(function () {
          db.prepare(
            "INSERT INTO channels (id, guild_id, type, name, dm_key, created_at) VALUES (?,NULL,'dm','dm',?,?)",
          ).run(id, dmKey, Date.now());
          const add = db.prepare('INSERT INTO dm_members (channel_id, user_id) VALUES (?,?)');
          add.run(id, a);
          add.run(id, b);
        })();
        channel = { id };
        hub.sendTo(userId, { t: 'friends.update' });
      }
      return { channelId: channel.id, userId };
    },
  );

  // Convenience for clients: who is online right now among the people I know.
  app.get('/api/presence', auth, async function (req) {
    return { presence: hub.snapshotFor(me(req)) };
  });
}
