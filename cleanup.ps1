$f = "c:\Users\USER\Documents\New folder\genuine sugarmummies app\fsm-elite-footer-suite\fsm-elite-footer-suite.php"
$lines = Get-Content $f
# Keep only lines 1-1024 (0-1023 in 0-indexed)
$newLines = $lines[0..1023]
$newLines += ""
Set-Content -Path $f -Value ($newLines -join "`n") -NoNewline
Write-Output "Done. New total: $($newLines.Count) lines (was $($lines.Count))"
