/**
 * Pure admin user-management handlers (spec 094). Routes stay thin: they build deps from the
 * container, call into these, and map the result to a `Response`. Authorization (`requireAdmin`) is
 * the CALLER's job — every handler here assumes the caller already checked the caller is an admin.
 */
import type { AppContainer } from '$lib/server/container';
import type { User } from '$lib/server/repo/types';
import { UniqueViolationError } from '$lib/server/repo/memory';
import { isUniqueViolation } from '$lib/server/repo/pg';
import { validatePassword } from '$lib/server/auth/password-policy';
import { validateCreateInput, validateUpdateInput } from './admin-users.validate';
import type {
  AdminUserSummary,
  CreateUserInput,
  CreateUserResult,
  DeleteUserResult,
  ResetPasswordResult,
  UpdateUserInput,
  UpdateUserResult
} from './admin-users.types';

/** Never includes the password hash — that leaves the repo only via `UserCredential`. */
export function toAdminUserSummary(user: User): AdminUserSummary {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    hasPassword: user.hasPassword,
    hasGoogle: user.googleSub !== null,
    createdAt: user.createdAt
  };
}

/** True when `err` is either adapter's unique-violation shape (spec 094 race safety). */
function isRaceViolation(err: unknown): boolean {
  return err instanceof UniqueViolationError || isUniqueViolation(err);
}

export async function listUsers(container: AppContainer): Promise<{ users: AdminUserSummary[] }> {
  const users = await container.repo.users.listAll();
  return { users: users.map(toAdminUserSummary) };
}

export async function createUser(container: AppContainer, input: CreateUserInput): Promise<CreateUserResult> {
  const validated = validateCreateInput(input);
  if (!validated.ok) return { ok: false, status: 400, error: 'invalid', fields: validated.fields };

  const { email, username, password, isAdmin } = validated;
  if (await container.repo.users.findByEmail(email)) {
    return { ok: false, status: 409, error: 'email_taken' };
  }
  if (await container.repo.users.findByUsername(username)) {
    return { ok: false, status: 409, error: 'username_taken' };
  }

  const passwordHash = password === null ? null : await container.passwordHasher.hash(password);

  try {
    const user = await container.repo.users.createLocal({ email, username, passwordHash, isAdmin });
    return { ok: true, status: 201, user: toAdminUserSummary(user) };
  } catch (err) {
    if (isRaceViolation(err)) {
      // A concurrent create won the exact same email/username between our pre-check and this insert.
      // Re-check which one to report accurately rather than guessing.
      const emailTaken = await container.repo.users.findByEmail(email);
      return { ok: false, status: 409, error: emailTaken ? 'email_taken' : 'username_taken' };
    }
    throw err;
  }
}

export async function updateUser(
  container: AppContainer,
  userId: string,
  input: UpdateUserInput
): Promise<UpdateUserResult> {
  const target = await container.repo.users.findById(userId);
  if (!target) return { ok: false, status: 404, error: 'not_found' };

  const validated = validateUpdateInput(input);
  if (!validated.ok) return { ok: false, status: 400, error: 'invalid', fields: validated.fields };

  if (validated.email && validated.email !== target.email) {
    if (await container.repo.users.findByEmail(validated.email)) {
      return { ok: false, status: 409, error: 'email_taken' };
    }
  }
  if (validated.username && validated.username !== target.username) {
    if (await container.repo.users.findByUsername(validated.username)) {
      return { ok: false, status: 409, error: 'username_taken' };
    }
  }

  // Last-admin guard: demoting the sole remaining admin is rejected, nothing changed.
  if (validated.isAdmin === false && target.isAdmin) {
    const admins = await container.repo.users.countAdmins();
    if (admins <= 1) return { ok: false, status: 409, error: 'last_admin' };
  }

  try {
    let updated = target;
    if (validated.username !== undefined || validated.email !== undefined) {
      const patch: { username?: string; email?: string } = {};
      if (validated.username !== undefined) patch.username = validated.username;
      if (validated.email !== undefined) patch.email = validated.email;
      updated = await container.repo.users.updateIdentity(userId, patch);
    }
    if (validated.isAdmin !== undefined) {
      updated = await container.repo.users.setAdmin(userId, validated.isAdmin);
    }
    return { ok: true, status: 200, user: toAdminUserSummary(updated) };
  } catch (err) {
    if (isRaceViolation(err)) {
      const emailTaken = validated.email ? await container.repo.users.findByEmail(validated.email) : null;
      return { ok: false, status: 409, error: emailTaken ? 'email_taken' : 'username_taken' };
    }
    throw err;
  }
}

export async function resetPassword(
  container: AppContainer,
  userId: string,
  password: unknown
): Promise<ResetPasswordResult> {
  const target = await container.repo.users.findById(userId);
  if (!target) return { ok: false, status: 404, error: 'not_found' };

  const parsed = validatePassword(password);
  if (!parsed.ok) return { ok: false, status: 400, error: 'invalid_password' };

  const passwordHash = await container.passwordHasher.hash(parsed.value);
  await container.repo.users.setPassword(userId, passwordHash);
  return { ok: true, status: 200 };
}

export async function deleteUser(container: AppContainer, userId: string): Promise<DeleteUserResult> {
  const target = await container.repo.users.findById(userId);
  if (!target) return { ok: false, status: 404, error: 'not_found' };

  if (target.isAdmin) {
    const admins = await container.repo.users.countAdmins();
    if (admins <= 1) return { ok: false, status: 409, error: 'last_admin' };
  }

  // Sessions cascade via the existing FK — no extra work needed here.
  await container.repo.users.deleteUser(userId);
  return { ok: true, status: 204 };
}
