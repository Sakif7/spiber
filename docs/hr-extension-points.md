# HR: where attendance and leave attach

The employee module was deliberately built so that attendance and leave can be
added later without reshaping what payroll has already produced. Nothing here is
stubbed out — there is no dead code waiting to be filled in. This is a note about
where the seams are, so the next person does not have to infer them.

## What exists today

| Piece           | File                                           | What it does                                                 |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Employee record | `lib/models/employee.ts`                       | Who is on the payroll                                        |
| Share history   | `lib/models/employee.ts` (`EmployeeShareRate`) | Append-only percentages, effective from a month              |
| Payroll run     | `lib/models/payrollRun.ts`                     | One month: revenue snapshot, a line per person, approval     |
| Month maths     | `lib/hr/months.ts`                             | Dhaka calendar months                                        |
| Pay maths       | `lib/hr/payroll-math.ts`                       | Rounding a share of revenue                                  |
| Services        | `lib/services/hr/`                             | Employee CRUD, rate history, computing and approving a month |

Only directors are paid today, as a share of monthly revenue.

## The three seams

### 1. `Employee.kind` — who someone is

`director | staff`. Nothing branches on it yet; it exists so that adding staff
does not mean telling them apart by their pay scheme. Attendance would apply to
`staff` and not to `director`.

### 2. `Employee.payScheme` — how they are paid

`revenue_share | fixed | none`. `computeMonth` in
`lib/services/hr/payroll.service.ts` switches on this, and each scheme decides
its own line amount:

```ts
if (e.payScheme === "revenue_share") { … }
else if (e.payScheme === "fixed" && e.fixedMonthlyMinor) { … }
// "none" is deliberately not paid by this run
```

An attendance-based scheme is a fourth branch here (`hourly`, say), reading the
month's attendance and producing an amount. Nothing else in payroll changes,
because a line is already just `{ employee, basis, amount }`.

`fixed` is recorded and stored but not yet exercised in anger — the field is
there and the branch computes it, but no one is on it.

### 3. `PayrollRun.lines[]` — what a month owes

A line carries `rateBp` (null for schemes without a rate) and `amountMinor`. A
scheme that needs to explain itself differently — "18 days worked at ৳X" — should
add its own optional fields to the line rather than overloading `rateBp`, so the
payslip can show the right basis per scheme.

## Rules a new scheme must not break

1. **An approved month is frozen.** `getRun` returns an approved run untouched
   and never recomputes it. Whatever a new scheme reads, it must be snapshotted
   into the line at approval, exactly as the rate is — otherwise editing an
   attendance record would silently rewrite a month someone was already paid for.

2. **Rates are append-only.** `EmployeeShareRate` is never edited. Anything
   time-varying that affects pay (an hourly rate, a leave entitlement) should
   follow the same shape: a new record with an `effectiveFrom` month.

3. **Months are Dhaka months.** Use `monthWindow` from `lib/hr/months.ts`. A UTC
   month boundary is six hours out and would move a day's work into the wrong
   month.

4. **Revenue has one definition.** `revenueBetween` in
   `lib/repositories/revenue.repo.ts` is what the dashboard and payroll both
   use. A new scheme that needs revenue must call it rather than writing its own
   aggregation.

## Where the UI would go

- Nav: the `People` group in `components/admin/shell/nav.ts` (super-admin only).
- Pages: `app/[locale]/admin/company/people/`.
- An attendance screen belongs beside Employees and Payroll in that group, and
  the payroll view already renders whatever lines a run produces, so a new
  scheme appears there without a change.
