// STAGE STEP (not an actor): the only file allowed to touch the database or run commands. The journey calls
// bootstrapOwners() once, after the two owner accounts exist through the UI; the PDF lists it under
// "Operator bootstrap (not a user action)". Everything printed here is also written to stage.log.
import { execFileSync } from 'node:child_process';

const project = 'twipay-wt';

export function sql(statement: string): string {
  return execFileSync('docker', ['exec', `${project}-postgres-1`, 'psql', '-U', 'wt', '-d', 'wip_twipay_walkthrough', '-tAc', statement], { encoding: 'utf8' }).trim();
}

export function assertWalkthroughDatabase(): void {
  const name = sql('select current_database()');
  if (name !== 'wip_twipay_walkthrough') throw new Error(`STAGE_REFUSED: connected to ${name}, expected wip_twipay_walkthrough`);
}

// The first SUPER_ADMIN is a database row (no screen creates it). Grants it to accounts that signed up and verified by UI.
export function bootstrapOwners(emails: string[]): string[] {
  assertWalkthroughDatabase();
  const statements: string[] = [];
  for (const email of emails) {
    if (!/^[a-z0-9.+_-]+@[a-z0-9.-]+\.example$/.test(email)) throw new Error(`STAGE_REFUSED: ${email} is not a fictional .example address`);
    const statement = `insert into user_roles ("userId","roleId","assignedAt") select u.id, r.id, now() from users u, roles r where u.email='${email}' and r.code='SUPER_ADMIN' on conflict do nothing`;
    sql(statement);
    statements.push(statement);
  }
  return statements;
}

// The proposal screen can only delegate support, audit and compliance roles. The finance and operations roles have no screen, so
// the stage step grants them to accounts that signed up and verified by UI. Listed in the PDF as operator bootstrap.
export function bootstrapRoles(grants: Array<{ email: string; role: 'FINANCE_OPERATOR' | 'FINANCE_APPROVER' | 'OPERATIONS' }>): string[] {
  assertWalkthroughDatabase();
  const statements: string[] = [];
  for (const { email, role } of grants) {
    if (!/^[a-z0-9.+_-]+@[a-z0-9.-]+\.example$/.test(email)) throw new Error(`STAGE_REFUSED: ${email} is not a fictional .example address`);
    const statement = `insert into user_roles ("userId","roleId","assignedAt") select u.id, r.id, now() from users u, roles r where u.email='${email}' and r.code='${role}' on conflict do nothing`;
    sql(statement);
    statements.push(statement);
  }
  return statements;
}
