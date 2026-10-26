import type { ScheduleError } from "@/lib/services/hr/pay-schedule.service";

/** HTTP status for a pay-schedule failure. */
export function scheduleStatus(code: ScheduleError): number {
  switch (code) {
    case "not_found":
      return 404;
    case "bad_cycle":
    case "bad_people":
      return 400;
    default:
      return 409;
  }
}
