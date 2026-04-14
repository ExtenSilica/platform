# =============================================================================
# ExtenSilica xsil CLI — Windows installer (PowerShell)
#
# Usage (run from an elevated or regular PowerShell prompt):
#   irm https://extensilica.com/install.ps1 | iex
#
# Environment overrides (optional, set before running):
#   $env:XSIL_VERSION     — install a specific version, e.g. "v1.2.0"
#   $env:XSIL_INSTALL_DIR — install binary here (default: %LOCALAPPDATA%\xsil)
#
# Supported platforms:
#   Windows x86_64 (MSVC)
# =============================================================================
#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo        = "extensilica/xsil"
$Binary      = "xsil"
$ReleasesUrl = "https://github.com/$Repo/releases"
$ApiUrl      = "https://api.github.com/repos/$Repo/releases/latest"
$Target      = "x86_64-pc-windows-msvc"

# ── Helpers ───────────────────────────────────────────────────────────────────

function Say   { param($Msg) Write-Host "`e[1m$Msg`e[0m" }
function Info  { param($Msg) Write-Host "  `e[34m→`e[0m $Msg" }
function Ok    { param($Msg) Write-Host "  `e[32m✓`e[0m $Msg" }
function Bail  { param($Msg) Write-Host "`e[31merror:`e[0m $Msg" -ForegroundColor Red; exit 1 }

# ── Resolve version ───────────────────────────────────────────────────────────

function Resolve-Version {
    if ($env:XSIL_VERSION) { return $env:XSIL_VERSION }

    try {
        $resp = Invoke-RestMethod -Uri $ApiUrl -Headers @{ "User-Agent" = "xsil-installer" }
        $tag  = $resp.tag_name  # e.g. "cli/v1.0.0"
        return $tag -replace '^cli/', ''
    } catch {
        Bail "Could not reach GitHub API. Check your internet connection or set `$env:XSIL_VERSION manually."
    }
}

# ── Choose install directory ──────────────────────────────────────────────────

function Get-InstallDir {
    if ($env:XSIL_INSTALL_DIR) { return $env:XSIL_INSTALL_DIR }
    return "$env:LOCALAPPDATA\xsil"
}

# ── Verify checksum ───────────────────────────────────────────────────────────

function Verify-Checksum {
    param($ArchivePath, $SumsFile, $ArchiveName)

    $expected = (Get-Content $SumsFile | Where-Object { $_ -match [regex]::Escape($ArchiveName) }) -split '\s+' | Select-Object -First 1
    if (-not $expected) { Bail "Could not find checksum for $ArchiveName in SHA256SUMS.txt" }

    $actual = (Get-FileHash -Algorithm SHA256 $ArchivePath).Hash.ToLower()
    if ($actual -ne $expected.ToLower()) {
        Bail "Checksum mismatch for $ArchiveName`n  expected: $expected`n  got:      $actual"
    }
}

# ── Main ──────────────────────────────────────────────────────────────────────

Say ""
Say "xsil installer"
Say "══════════════"

$Version    = Resolve-Version
$InstallDir = Get-InstallDir
$Archive    = "$Binary-$Target.zip"
$BaseUrl    = "https://github.com/$Repo/releases/download/cli/$Version"

Info "version   : $Version"
Info "target    : $Target"
Info "install to: $InstallDir"
Say ""

# ── Download ──────────────────────────────────────────────────────────────────

$TmpDir = Join-Path $env:TEMP "xsil-install-$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $TmpDir | Out-Null

try {
    Info "Downloading $Archive ..."
    Invoke-WebRequest "$BaseUrl/$Archive"       -OutFile "$TmpDir\$Archive"      -UseBasicParsing
    Invoke-WebRequest "$BaseUrl/SHA256SUMS.txt" -OutFile "$TmpDir\SHA256SUMS.txt" -UseBasicParsing

    # ── Verify ────────────────────────────────────────────────────────────────

    Info "Verifying checksum ..."
    Verify-Checksum -ArchivePath "$TmpDir\$Archive" -SumsFile "$TmpDir\SHA256SUMS.txt" -ArchiveName $Archive
    Ok "Checksum OK"

    # ── Extract and install ───────────────────────────────────────────────────

    Expand-Archive -Path "$TmpDir\$Archive" -DestinationPath $TmpDir -Force

    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir | Out-Null
    }

    Move-Item -Path "$TmpDir\$Binary.exe" -Destination "$InstallDir\$Binary.exe" -Force
    Ok "$Binary $Version installed → $InstallDir\$Binary.exe"

} finally {
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}

# ── PATH ──────────────────────────────────────────────────────────────────────

$UserPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [System.Environment]::SetEnvironmentVariable("PATH", "$UserPath;$InstallDir", "User")
    Say ""
    Say "Added $InstallDir to your user PATH."
    Say "Restart your terminal (or open a new one) for the change to take effect."
}

# ── Quick test ────────────────────────────────────────────────────────────────

$env:PATH += ";$InstallDir"
try {
    Say ""
    Say "Quick test:"
    & "$InstallDir\$Binary.exe" --version
} catch { }

Say ""
Say "Done! Get started:"
Say ""
Write-Host "  xsil search         " -NoNewline; Write-Host "# browse packages"  -ForegroundColor DarkGray
Write-Host "  xsil install <pkg>  " -NoNewline; Write-Host "# install a package" -ForegroundColor DarkGray
Write-Host "  xsil login          " -NoNewline; Write-Host "# authenticate to publish" -ForegroundColor DarkGray
Say ""
Write-Host "Docs: https://extensilica.com"
Say ""
