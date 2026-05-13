$ErrorActionPreference = "Stop"

npm run build

if (-not (Test-Path -LiteralPath "dist")) {
  throw "A pasta dist nao foi gerada pelo build."
}

if (Test-Path -LiteralPath "docs") {
  Get-ChildItem -LiteralPath "docs" -Force | Remove-Item -Recurse -Force
} else {
  New-Item -ItemType Directory -Path "docs" | Out-Null
}

Copy-Item -Path "dist\*" -Destination "docs" -Recurse -Force
