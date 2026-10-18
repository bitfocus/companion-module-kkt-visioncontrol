<#
.SYNOPSIS
  Importiert die Original-Symbole aus der lokal installierten Vision Control App
  in den Ordner ./icons des Moduls.

.DESCRIPTION
  Holt die Symbole aus einer lokal installierten Vision Control App nach ./icons.
  Danach scripts/build-icons.cjs ausführen (oder beides mit "npm run icons"),
  damit alles in src/icons.generated.json gebündelt wird.

  Je Symbol entstehen zwei Dateien:
    <name>-light.png  weiße Glyphe (für dunkle/farbige Tasten)
    <name>-dark.png   schwarze Glyphe (für helle Tasten)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\import-icons.ps1
#>
param(
	[string]$OutDir = (Join-Path $PSScriptRoot '..\icons'),
	[int]$Size = 32
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$pkg = Get-AppxPackage | Where-Object { $_.Name -like '*VisionControl*' } | Select-Object -First 1
if (-not $pkg) { throw 'Die Vision Control App ist auf diesem Rechner nicht installiert.' }
$src = $pkg.InstallLocation

# Modul-Symbolname -> Symbolname in der App
$map = [ordered]@{
	blackout = 'maui_moon'
	full_on  = 'maui_sun'
	sound    = 'maui_sound'
	dimmer   = 'maui_fader'
	color    = 'maui_color_picker'
	chase    = 'maui_colorcircles_color_fx'
	pixel    = 'maui_squares_custom'
	circle   = 'maui_circles'
	wall     = 'maui_squares_line_vertical'
	snake    = 'maui_sinus'
	rain     = 'maui_lines_vertical'
	noise    = 'maui_shuffle'
	chess    = 'maui_squares_square'
	arrow    = 'maui_next'
	scene    = 'maui_scene'
	play     = 'maui_play'
	pause    = 'maui_pause'
	status   = 'maui_signal'
	rabbit   = 'maui_rabbit'
	turtle   = 'maui_turtle'
	range    = 'maui_fx_range'
	info     = 'maui_info'
}

function Save-Resized([string]$inFile, [string]$outFile, [int]$size) {
	$img = [System.Drawing.Image]::FromFile($inFile)
	try {
		$scale = $size / [math]::Max($img.Width, $img.Height)
		$w = [math]::Max(1, [int][math]::Round($img.Width * $scale))
		$h = [math]::Max(1, [int][math]::Round($img.Height * $scale))
		$bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
		$g = [System.Drawing.Graphics]::FromImage($bmp)
		$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
		$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
		$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
		$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
		$g.Clear([System.Drawing.Color]::Transparent)
		$g.DrawImage($img, 0, 0, $w, $h)
		$g.Dispose()
		$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
		$bmp.Dispose()
	} finally {
		$img.Dispose()
	}
}

New-Item -ItemType Directory -Force $OutDir | Out-Null
$count = 0
$missing = @()
foreach ($key in $map.Keys) {
	$app = $map[$key]
	$light = Join-Path $src "$($app)_dark.scale-200.png"  # weiße Glyphe
	$dark = Join-Path $src "$($app).scale-200.png"        # schwarze Glyphe
	if (Test-Path $light) { Save-Resized $light (Join-Path $OutDir "$key-light.png") $Size; $count++ } else { $missing += "$key-light" }
	if (Test-Path $dark) { Save-Resized $dark (Join-Path $OutDir "$key-dark.png") $Size; $count++ } else { $missing += "$key-dark" }
}

"$count Symbole importiert nach $((Resolve-Path $OutDir).Path) (Vision Control $($pkg.Version))."
if ($missing.Count) { 'Nicht gefunden: ' + ($missing -join ', ') }
