import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Moves one user from V1 to V2, at the moment they log in.
 *
 * We lost admin access to V1, so there is no bulk migration: auth.users is
 * unreachable without its service_role key, which means we cannot read anyone's
 * email or password hash. What we can do is wait for each user to sign in — a V1
 * session proves who they are and carries their email.
 *
 * The trust boundary is the whole point of this file. The browser sends a V1 access
 * token and nothing else that matters; identity is established by handing that token
 * back to V1 and asking who it belongs to. Nothing self-reported (an email in the
 * body, a user id, a role) is ever believed — otherwise anyone could POST
 * {email: "admin@..."} and have us mint them an admin account in V2.
 */

export const config = { maxDuration: 60 };

const V1_URL = process.env.LEGACY_SUPABASE_URL ?? process.env.VITE_LEGACY_SUPABASE_URL;
const V1_ANON = process.env.LEGACY_SUPABASE_ANON_KEY ?? process.env.VITE_LEGACY_SUPABASE_ANON_KEY;
const V2_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const V2_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface V1User {
  id: string;
  email: string;
  user_metadata?: { full_name?: string };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!V1_URL || !V1_ANON || !V2_URL || !V2_SERVICE) {
    return res.status(500).json({ error: 'Migration is not configured on the server.' });
  }

  const {
    v1_access_token: v1Token,
    new_password: newPassword,
    check_only: checkOnly,
  } = (req.body ?? {}) as {
    v1_access_token?: string;
    new_password?: string;
    /**
     * Ask whether this account has already moved, without changing anything.
     *
     * Needed because a migrated user whose browser autofills their OLD password
     * fails against V2, still succeeds against V1, and would otherwise be shown the
     * "we've moved" screen on every single login — silently resetting their password
     * each time. It requires a valid V1 token, so it cannot be used to probe which
     * emails are registered.
     */
    check_only?: boolean;
  };

  if (!v1Token) return res.status(400).json({ error: 'v1_access_token is required' });
  if (!checkOnly && (!newPassword || newPassword.length < 8)) {
    return res.status(400).json({ error: 'Choose a password of at least 8 characters.' });
  }

  // --- Establish identity from V1, not from the request body ------------------
  const v1 = createClient(V1_URL, V1_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${v1Token}` } },
  });

  const {
    data: { user: v1User },
    error: whoError,
  } = await v1.auth.getUser(v1Token);

  if (whoError || !v1User?.email) {
    return res.status(401).json({ error: 'That legacy session is not valid.' });
  }

  const legacy = v1User as unknown as V1User;
  const email = legacy.email;

  const v2 = createClient(V2_URL, V2_SERVICE, { auth: { persistSession: false } });

  try {
    // --- Already migrated? Set the password they just chose --------------------
    // Returning a bare "already migrated" here was a bug: the client then tried to
    // sign in with the new password, but the account still carried the one set on
    // the first run, so a second attempt always failed with "could not move your
    // account".
    //
    // They have just re-authenticated against V1, which is the same proof of
    // ownership the original migration relied on — so applying the new password is
    // sound, and it turns V1 into a recovery path for anyone who forgets the one
    // they chose.
    const { data: existing } = await v2.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const already = existing?.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    // A pure question: has this account moved? Changes nothing.
    if (checkOnly) {
      return res.status(200).json({ ok: true, already_migrated: Boolean(already), email });
    }

    if (already) {
      const { error: pwError } = await v2.auth.admin.updateUserById(already.id, {
        password: newPassword!,
      });

      if (pwError) throw new Error(pwError.message);

      return res.status(200).json({ ok: true, already_migrated: true, email });
    }

    // --- Read their own V1 rows, as them --------------------------------------
    // RLS scopes each of these to the caller, so a user can only ever bring their
    // own data across. Roles come from V1's user_roles, which only an admin could
    // write there — so a learner cannot arrive in V2 holding an admin role.
    const [{ data: profile }, { data: roles }, { data: enrollments }, { data: progress }] =
      await Promise.all([
        v1.from('profiles').select('full_name, avatar_url').eq('user_id', legacy.id).maybeSingle(),
        v1.from('user_roles').select('role').eq('user_id', legacy.id),
        v1.from('enrollments').select('*').eq('user_id', legacy.id),
        v1.from('progress').select('*').eq('user_id', legacy.id),
      ]);

    const fullName = profile?.full_name ?? legacy.user_metadata?.full_name ?? null;

    // --- Create them in V2 -----------------------------------------------------
    // email_confirm: true — they already proved control of this address on V1, so
    // making them re-verify would be theatre that locks out anyone whose inbox has
    // since died.
    const { data: created, error: createError } = await v2.auth.admin.createUser({
      email,
      password: newPassword!,
      email_confirm: true,
      user_metadata: { full_name: fullName, migrated_from_v1: legacy.id },
    });

    if (createError || !created.user) {
      throw new Error(createError?.message ?? 'Could not create the account.');
    }

    const newId = created.user.id;

    // handle_new_user already inserted a profile and the student role on signup.
    await v2.from('profiles').update({ full_name: fullName, avatar_url: profile?.avatar_url ?? null })
      .eq('user_id', newId);

    // Carry over any role beyond 'student' (i.e. admin).
    const extraRoles = (roles ?? [])
      .map((r: { role: string }) => r.role)
      .filter((role) => role !== 'student');

    if (extraRoles.length > 0) {
      await v2.from('user_roles').upsert(
        extraRoles.map((role) => ({ user_id: newId, role })),
        { onConflict: 'user_id,role' }
      );
    }

    // Course ids are identical in V2 (content was seeded with its original UUIDs),
    // so these carry across untouched apart from the new user id.
    //
    // A returning learner is approved on arrival. They already paid, on the old platform,
    // and making them wait for an admin to re-approve a course they have been studying for
    // months would be the worst possible first impression of the new one. New signups still
    // go through the normal pending -> admin-approves flow; this shortcut exists only for
    // people whose payment V1 has already vouched for.
    //
    // A rejected enrolment stays rejected. It was refused for a reason, and "everyone from
    // V1 gets in" must not quietly become "including the people we turned away".
    if (enrollments?.length) {
      await v2.from('enrollments').upsert(
        enrollments.map(({ id: _drop, user_id: _u, status, approved_at, ...rest }) => ({
          ...rest,
          user_id: newId,
          status: status === 'rejected' ? 'rejected' : 'approved',
          approved_at: status === 'rejected' ? null : (approved_at ?? new Date().toISOString()),
        })),
        { onConflict: 'user_id,course_id' }
      );
    }

    if (progress?.length) {
      await v2.from('progress').upsert(
        progress.map(({ id: _drop, user_id: _u, ...rest }) => ({ ...rest, user_id: newId })),
        { onConflict: 'user_id,capsule_id' }
      );
    }

    return res.status(200).json({
      ok: true,
      email,
      enrollments: enrollments?.length ?? 0,
      progress: progress?.length ?? 0,
      admin: extraRoles.includes('admin'),
    });
  } catch (error) {
    console.error('migrate-user failed:', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
}
