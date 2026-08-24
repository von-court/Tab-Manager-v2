## 1. Alarm reconcile

- [x] 1.1 Add `AUTO_ARCHIVE_FIRST_DELAY_MINUTES = 1` next to the existing alarm constants
- [x] 1.2 In `reconcileAlarm`, clear and return early when `autoArchiveEnabled` is false
- [x] 1.3 Read the existing alarm with `alarms.get` and return early when its `periodInMinutes`
      already matches `AUTO_ARCHIVE_PERIOD_MINUTES`
- [x] 1.4 Create with both `delayInMinutes` and `periodInMinutes` only in the missing/mismatched case
- [x] 1.5 Update the `reconcileAlarm` docstring to state the schedule-preservation contract and
      reference `spec: auto-archive`

## 2. Verification

- [x] 2.1 `pnpm build`
- [x] 2.2 Scoped eslint + prettier on the touched file
- [x] 2.3 Manual check (human): load the build, enable auto-archive, confirm via
      `chrome.alarms.getAll()` that `scheduledTime` does not move across service-worker restarts
      and that the first run happens ~1 minute after enabling
