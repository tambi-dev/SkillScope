# Weekly local collection

The Windows Task Scheduler can run the full HeadHunter collection every Monday
at 09:00 local time. The task runs as the current Windows user, reads the
project `.env`, audits all five markets and configured role queries, and stops
before collection if the audit is incomplete or truncated.

Set up the project environment and credentials first:

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[api]"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Configure a valid `HH_ACCESS_TOKEN` and `HH_USER_AGENT` in `.env`, then register
the scheduled task:

```powershell
.\scripts\register_weekly_task.ps1
```

The PC must be on and the configured Windows user must be logged in at the
scheduled time. If Windows misses the start time, `StartWhenAvailable` runs the
task when it becomes available. The task skips overlapping runs. It does not
call ChatGPT or Codex; it uses the HeadHunter API token configured in `.env`.

Each successful run stores its audit, classification report, sanitized
snapshot, manual review file, raw API payload archive and an SQLite backup under
`data/processed/weekly/backups/<collection-id>/`. The SQLite copy is checked
with `PRAGMA integrity_check`, and the raw archive is checked before it is
published. The run log is at
`data/processed/weekly/logs/weekly_collection.log`. Failures return a nonzero
exit status and are recorded in that log. HeadHunter's token/API quota is used
for the audit and collection.

These recovery copies are local and use the same disk as the project. They
protect against a damaged current database or accidental replacement, but not
against loss of the computer or disk. Copy the backup directory elsewhere if
off-device recovery is needed.

To run a collection manually, use:

```powershell
.\.venv\Scripts\python.exe scripts\weekly_collect.py
```

To inspect the schedule:

```powershell
Get-ScheduledTask -TaskName "SkillScope Weekly Collection"
```
