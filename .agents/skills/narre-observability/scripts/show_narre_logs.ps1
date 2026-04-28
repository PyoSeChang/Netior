param(
  [ValidateSet('latest', 'runtime', 'packaged')]
  [string]$Scope = 'runtime',

  [ValidateSet('both', 'main', 'narre')]
  [string]$Target = 'both',

  [string]$RuntimeScope,

  [string]$Worktree,

  [switch]$ListScopes,

  [int]$Tail = 80,

  [switch]$Wait
)

$root = Join-Path $env:APPDATA 'netior'
$runtimeRoot = Join-Path $root 'runtime'
$packagedLogs = Join-Path $root 'data\\logs'

function Get-LogTimestamp {
  param([string]$Path)

  if (Test-Path -LiteralPath $Path) {
    return (Get-Item -LiteralPath $Path).LastWriteTimeUtc
  }

  return [datetime]::MinValue
}

function New-LogCandidate {
  param(
    [string]$Kind,
    [string]$Name,
    [string]$LogsDir
  )

  $mainPath = Join-Path $LogsDir 'desktop-main.log'
  $narrePath = Join-Path $LogsDir 'narre-server.log'
  $updatedAt = (Get-LogTimestamp -Path $mainPath)
  $narreUpdatedAt = Get-LogTimestamp -Path $narrePath
  if ($narreUpdatedAt -gt $updatedAt) {
    $updatedAt = $narreUpdatedAt
  }

  [pscustomobject]@{
    Kind = $Kind
    Name = $Name
    Worktree = Get-WorktreeLabel -RuntimeScope $Name
    LogsDir = $LogsDir
    MainPath = $mainPath
    NarrePath = $narrePath
    UpdatedAt = $updatedAt
  }
}

function Get-WorktreeLabel {
  param([string]$RuntimeScope)

  if ($RuntimeScope -eq 'packaged') {
    return 'packaged'
  }

  if ($RuntimeScope -match '^dev-(.+)-[0-9a-f]{8}$') {
    return $Matches[1]
  }

  return $RuntimeScope
}

function Get-LogCandidates {
  $candidates = @()

  if (Test-Path -LiteralPath $packagedLogs) {
    $candidates += New-LogCandidate -Kind 'packaged' -Name 'packaged' -LogsDir $packagedLogs
  }

  if (Test-Path -LiteralPath $runtimeRoot) {
    Get-ChildItem -LiteralPath $runtimeRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $logsDir = Join-Path $_.FullName 'data\\logs'
      if (Test-Path -LiteralPath $logsDir) {
        $candidates += New-LogCandidate -Kind 'runtime' -Name $_.Name -LogsDir $logsDir
      }
    }
  }

  return $candidates | Where-Object {
    (Test-Path -LiteralPath $_.MainPath) -or (Test-Path -LiteralPath $_.NarrePath)
  }
}

function Show-Log {
  param(
    [string]$Label,
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Host "[missing] $Label -> $Path"
    return
  }

  Write-Host ""
  Write-Host "=== $Label ==="
  Write-Host $Path
  Get-Content -LiteralPath $Path -Tail $Tail
}

$candidates = Get-LogCandidates
if (-not $candidates -or $candidates.Count -eq 0) {
  Write-Error "No Netior log files found under $root"
  exit 1
}

if ($ListScopes) {
  $candidates |
    Sort-Object Kind, Worktree, Name |
    Select-Object Kind, Worktree, Name, UpdatedAt, LogsDir |
    Format-Table -AutoSize
  exit 0
}

if ($RuntimeScope -and $Scope -eq 'packaged') {
  Write-Error "-RuntimeScope cannot be combined with -Scope packaged"
  exit 1
}

if ($Worktree -and $Scope -eq 'packaged') {
  Write-Error "-Worktree cannot be combined with -Scope packaged"
  exit 1
}

$selectedPool = switch ($Scope) {
  'packaged' {
    $candidates | Where-Object { $_.Kind -eq 'packaged' }
  }
  'runtime' {
    $candidates | Where-Object { $_.Kind -eq 'runtime' }
  }
  default {
    $candidates
  }
}

if ($RuntimeScope) {
  $selectedPool = $selectedPool | Where-Object { $_.Name -eq $RuntimeScope }
}

if ($Worktree) {
  $selectedPool = $selectedPool | Where-Object { $_.Worktree -eq $Worktree }
}

$selected = $selectedPool | Sort-Object UpdatedAt -Descending | Select-Object -First 1

if (-not $selected -and $Worktree) {
  $availableWorktrees = $candidates |
    Where-Object { $_.Kind -eq 'runtime' } |
    Select-Object -ExpandProperty Worktree -Unique |
    Sort-Object
  $availableMessage = if ($availableWorktrees.Count -gt 0) {
    $availableWorktrees -join ', '
  } else {
    '(none)'
  }
  Write-Error "No matching runtime log scope found for worktree '$Worktree'. Available worktrees: $availableMessage"
  exit 1
}

if (-not $selected) {
  if ($RuntimeScope) {
    Write-Error "No matching log scope found for runtime scope '$RuntimeScope'"
    exit 1
  }

  Write-Error "No matching log scope found for '$Scope'"
  exit 1
}

Write-Host "Selected scope: $($selected.Name) [$($selected.Kind)]"
Write-Host "Worktree: $($selected.Worktree)"
Write-Host "Logs dir: $($selected.LogsDir)"

if ($Wait) {
  if ($Target -eq 'both') {
    Write-Error "Use -Wait with -Target main or -Target narre"
    exit 1
  }

  $path = if ($Target -eq 'main') { $selected.MainPath } else { $selected.NarrePath }
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Error "Log file not found: $path"
    exit 1
  }

  Write-Host "Following: $path"
  Get-Content -LiteralPath $path -Tail $Tail -Wait
  exit 0
}

switch ($Target) {
  'main' {
    Show-Log -Label 'desktop-main.log' -Path $selected.MainPath
  }
  'narre' {
    Show-Log -Label 'narre-server.log' -Path $selected.NarrePath
  }
  default {
    Show-Log -Label 'desktop-main.log' -Path $selected.MainPath
    Show-Log -Label 'narre-server.log' -Path $selected.NarrePath
  }
}
