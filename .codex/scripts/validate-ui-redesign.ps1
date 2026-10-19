[CmdletBinding()]
param(
  [switch]$Hook
)

$ErrorActionPreference = 'Stop'

function Finish([bool]$Continue, [string]$Message, [int]$ExitCode) {
  if ($Hook) {
    @{ continue = $Continue; stopReason = $Message } | ConvertTo-Json -Compress
  } else {
    Write-Output $Message
  }
  exit $ExitCode
}

$root = (git rev-parse --show-toplevel).Trim()
Set-Location $root
$mode = Get-Content -Raw '.codex/ui-redesign-mode.json' | ConvertFrom-Json

if (-not $mode.active) {
  Finish $true 'UI redesign gate inactive: design approval and hook trust are required before activation.' 0
}

$changed = @(git status --porcelain -- frontend | ForEach-Object { $_.Substring(3) })
if ($changed.Count -eq 0) {
  Finish $true 'UI redesign gate passed: no frontend files changed.' 0
}

$ledger = Get-Content -Raw 'docs/ui-redesign/approval-ledger.md'
$required = @('DESIGN-001', 'DESIGN-002', 'DESIGN-003', 'DESIGN-004')
$missingApproval = @()
foreach ($id in $required) {
  if ($ledger -notmatch "(?m)^\| $id \| APPROVED \|") {
    $missingApproval += $id
  }
}
if ($missingApproval.Count -gt 0) {
  Finish $false ("UI redesign gate blocked: human approval missing for " + ($missingApproval -join ', ') + '.') 1
}

$pageLedger = Get-Content -Raw 'docs/ui-redesign/page-ledger.md'
if ($pageLedger -notmatch '(?i)ready for human review|qa passed') {
  Finish $false 'UI redesign gate blocked: record current page QA evidence in docs/ui-redesign/page-ledger.md before completion.' 1
}

& (Join-Path $root '.codex/scripts/test-ui-policy.ps1')
if ($LASTEXITCODE -ne 0) {
  Finish $false 'UI redesign gate blocked: UI policy validation failed. Correct the changed code and rerun the policy script.' 1
}

Finish $true 'UI redesign gate passed: approvals and page QA evidence are present. Run the route checks and frontend build before requesting human review.' 0
