[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (git rev-parse --show-toplevel).Trim()
Set-Location $root

$diff = git diff --no-ext-diff -U0 HEAD -- frontend
$approvedThemeFiles = @('frontend/src/theme/antTheme.ts')

$rules = @(
  @{ Name = 'raw hexadecimal colour'; Pattern = '#(?:[0-9a-fA-F]{3,8})\b'; Advice = 'Use the approved Ant Design theme token instead.' },
  @{ Name = 'Tailwind semantic colour'; Pattern = '\b(?:bg|text|border|ring)-(?:red|green|amber|yellow|blue|orange|purple|pink|lime|emerald|cyan|sky|indigo|violet|rose)-\d{2,3}\b'; Advice = 'Use an Ant Design semantic component or status prop.' },
  @{ Name = 'hand-built modal overlay'; Pattern = '\bfixed\s+inset-0\b'; Advice = 'Use Ant Design Modal, Drawer, Popconfirm, or Image preview.' }
)

$violations = @()
$currentFile = ''
foreach ($line in $diff) {
  if ($line -match '^\+\+\+ b/(.+)$') {
    $currentFile = $Matches[1]
    continue
  }
  if ($line -notmatch '^\+' -or $line -match '^\+\+\+') {
    continue
  }
  foreach ($rule in $rules) {
    if ($rule.Name -eq 'raw hexadecimal colour' -and $currentFile -in $approvedThemeFiles) {
      continue
    }
    if ($line -match $rule.Pattern) {
      $violations += ('[{0}] {1}; {2}' -f $rule.Name, $line.Substring(1).Trim(), $rule.Advice)
    }
  }
}

if ($violations.Count -gt 0) {
  Write-Error ('UI policy failed. Newly added code violates the approved rebuild rules: ' + ($violations -join ' | '))
  exit 1
}

Write-Output 'UI policy passed: no newly added raw colours, Tailwind semantic colours, or hand-built overlays.'
