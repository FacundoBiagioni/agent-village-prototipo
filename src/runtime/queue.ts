import { PgBoss } from "pg-boss";

export const QUEUES = { task: "agent-task", backup: "db-backup", importPlaces: "import-overture", reminders: "payment-reminders", mediaCleanup: "media-cleanup", supervise: "supervise", webCheck: "web-check" } as const;
export type TaskJob = { runId: string } | { approvalId: string };

let sender: Promise<PgBoss> | undefined;

/** Instancia solo para encolar (la usa Next.js). El worker crea la suya con mantenimiento y cron. */
export function getSender() {
  sender ??= new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    supervise: false,
    schedule: false,
    migrate: false,
    registerInstance: false,
  }).start();
  return sender;
}

export async function enqueue(job: TaskJob) {
  const boss = await getSender();
  return boss.send(QUEUES.task, job);
}
