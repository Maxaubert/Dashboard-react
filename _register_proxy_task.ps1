# Registers a Windows Scheduled Task that runs the YouTube residential
# proxy tunnel hidden in the background at every user logon.
#
# - Uses pythonw.exe so no console window appears.
# - Working directory is the dashboard-react folder (so the script can
#   find dashboard.txt and the youtube-proxy-helper folder beside it).
# - Restarts on failure, runs whether on battery or AC, no time limit.
# - Idempotent: re-registers cleanly if the task already exists.

$TaskName = 'Dashboard YouTube Proxy'
$WorkDir  = 'C:\Users\Admin\Documents\Claude Cowrk Projects\Dashboard\dashboard-react'
$PythonW  = 'C:\Program Files\Python314\pythonw.exe'
$Script   = '_test_proxy_tunnel.py'

# Stop + remove any existing version of the task
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing task '$TaskName'..."
    try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute $PythonW `
    -Argument "`"$Script`"" `
    -WorkingDirectory $WorkDir

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -Hidden `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description 'Keeps the SOCKS5 reverse-tunnel to the dashboard server alive so the dashboard can route YouTube/NRK traffic via the home residential IP.' | Out-Null

Write-Host "Registered task '$TaskName'."

# Start it right now so the tunnel comes up without waiting for next logon
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 2

$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host ("State:        {0}" -f $task.State)
Write-Host ("LastRunTime:  {0}" -f $info.LastRunTime)
Write-Host ("LastResult:   0x{0:X}" -f $info.LastTaskResult)
