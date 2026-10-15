$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$python = Join-Path $projectRoot ".venv\Scripts\python.exe"
$runner = Join-Path $projectRoot "scripts\weekly_collect.py"
$envFile = Join-Path $projectRoot ".env"
$taskName = "SkillScope Weekly Collection"

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw "Project Python was not found at $python. Create the virtual environment first."
}
if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw "Project .env was not found. Configure HeadHunter credentials before scheduling."
}
& $python -c "import skillscope" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "SkillScope is not installed in the project virtual environment. Run pip install -e `".[api]`" first."
}

$action = New-ScheduledTaskAction `
    -Execute $python `
    -Argument "`"$runner`"" `
    -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 1 -DaysOfWeek Sunday -At "9:00AM"
$principal = New-ScheduledTaskPrincipal `
    -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 3)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Weekly SkillScope HeadHunter audit, collection and local recovery copy." `
    -Force | Out-Null

Write-Output "Registered '$taskName' for Sundays at 09:00 local time."
Write-Output "The task runs only while this Windows user is logged in."
