$ErrorActionPreference = "Stop"

param(
  [switch]$Local
)

function Resolve-PythonExecutable {
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) { return "py" }

  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($python) { return "python" }

  throw "Python executable not found. Install Python or add it to PATH."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$pythonExe = Resolve-PythonExecutable
$mediaProcess = $null
$workerExitCode = 0
$wranglerArgs = @("wrangler", "dev")
if ($Local) {
  $wranglerArgs += "--local"
}

Write-Output "[omni-dev] Starting Omni media service (python -m omni_media.run_server)..."

try {
  $mediaProcess = Start-Process -FilePath $pythonExe -ArgumentList @("-m", "omni_media.run_server") -WorkingDirectory $repoRoot -PassThru -NoNewWindow
  Start-Sleep -Milliseconds 600

  if ($mediaProcess.HasExited) {
    throw "Omni media service exited immediately with code $($mediaProcess.ExitCode)."
  }

  Write-Output "[omni-dev] Omni media service PID: $($mediaProcess.Id)"
  Write-Output "[omni-dev] Starting Cloudflare worker (npx $($wranglerArgs -join ' '))..."

  Push-Location $repoRoot
  try {
    & npx @wranglerArgs
    if ($LASTEXITCODE -ne $null) {
      $workerExitCode = [int]$LASTEXITCODE
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  if ($mediaProcess -and -not $mediaProcess.HasExited) {
    Write-Output "[omni-dev] Stopping Omni media service (PID $($mediaProcess.Id))..."
    Stop-Process -Id $mediaProcess.Id -Force -ErrorAction SilentlyContinue
  }
}

if ($workerExitCode -ne 0) {
  exit $workerExitCode
}
