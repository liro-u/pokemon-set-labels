# (Re)start the local server and open the site in Google Chrome. Data updates are done from the page (Update data).
# Run from the desktop shortcut, or: powershell -ExecutionPolicy Bypass -File scripts\start.ps1
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Port = 8000
$Url = "http://localhost:$Port/"
$Probe = "http://127.0.0.1:$Port/api/update"   # 127.0.0.1: "localhost" tries IPv6 first and is slower to answer

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is not installed or not on the PATH.' -ForegroundColor Red
  Read-Host 'Press Enter to close'; exit 1
}

# An update running in the current server: leave it alone, just open the page
$busy = $false
try { $busy = (Invoke-RestMethod -Uri $Probe -TimeoutSec 2).running -eq $true } catch { }

if (-not $busy) {
  # Stop a server this script started before (matched by its command line, so nothing else gets killed)
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -like '*scripts*serve.mjs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 300

  $other = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($other) {
    Write-Host "Port $Port is used by another program (PID $($other[0].OwningProcess)). Close it and try again." -ForegroundColor Red
    Read-Host 'Press Enter to close'; exit 1
  }

  # Start the server in the background (no window) and wait until it answers
  Start-Process -FilePath node -ArgumentList "`"$(Join-Path $Root 'scripts\serve.mjs')`" $Port" -WorkingDirectory $Root -WindowStyle Hidden
  $ready = $false
  for ($i = 0; $i -lt 50 -and -not $ready; $i++) {
    Start-Sleep -Milliseconds 200
    try { Invoke-WebRequest -UseBasicParsing -Uri $Probe -TimeoutSec 2 | Out-Null; $ready = $true } catch { }
  }
  if (-not $ready) { Write-Host 'The server did not start.' -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }
}

# Open in Google Chrome (registered install path), else the default browser
$chrome = @(
  (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(default)',
  (Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(default)',
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($chrome) { Start-Process -FilePath $chrome -ArgumentList $Url } else { Start-Process $Url }
