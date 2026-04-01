param(
  [string]$OutputDir = "build/icons"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$resolvedOutputDir = Join-Path $projectRoot $OutputDir

if (-not (Test-Path $resolvedOutputDir)) {
  New-Item -ItemType Directory -Path $resolvedOutputDir | Out-Null
}

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-NetiorIcon {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size
  )

  $Graphics.Clear([System.Drawing.Color]::Transparent)
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  $scale = $Size / 512.0
  $bgColor = [System.Drawing.ColorTranslator]::FromHtml("#0F172A")
  $fgColor = [System.Drawing.ColorTranslator]::FromHtml("#F8FAFC")
  $accentColor = [System.Drawing.ColorTranslator]::FromHtml("#14B8A6")

  $path = New-RoundedRectPath (36 * $scale) (36 * $scale) (440 * $scale) (440 * $scale) (108 * $scale)
  $bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
  $Graphics.FillPath($bgBrush, $path)
  $bgBrush.Dispose()
  $path.Dispose()

  $pen = New-Object System.Drawing.Pen($fgColor, (30 * $scale))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $points = @{
    Top = New-Object System.Drawing.PointF(([float](256 * $scale)), ([float](124 * $scale)))
    LeftTop = New-Object System.Drawing.PointF(([float](154 * $scale)), ([float](194 * $scale)))
    RightTop = New-Object System.Drawing.PointF(([float](358 * $scale)), ([float](194 * $scale)))
    Center = New-Object System.Drawing.PointF(([float](256 * $scale)), ([float](256 * $scale)))
    LeftBottom = New-Object System.Drawing.PointF(([float](154 * $scale)), ([float](318 * $scale)))
    Bottom = New-Object System.Drawing.PointF(([float](256 * $scale)), ([float](388 * $scale)))
    RightBottom = New-Object System.Drawing.PointF(([float](358 * $scale)), ([float](318 * $scale)))
  }

  $Graphics.DrawLine($pen, $points.LeftTop, $points.Top)
  $Graphics.DrawLine($pen, $points.Top, $points.RightTop)
  $Graphics.DrawLine($pen, $points.LeftTop, $points.Center)
  $Graphics.DrawLine($pen, $points.Center, $points.RightTop)
  $Graphics.DrawLine($pen, $points.LeftBottom, $points.Center)
  $Graphics.DrawLine($pen, $points.Center, $points.RightBottom)
  $Graphics.DrawLine($pen, $points.LeftBottom, $points.Bottom)
  $Graphics.DrawLine($pen, $points.Bottom, $points.RightBottom)
  $pen.Dispose()

  $nodeBrush = New-Object System.Drawing.SolidBrush($fgColor)
  $accentBrush = New-Object System.Drawing.SolidBrush($accentColor)

  $radii = @{
    Top = 24
    LeftTop = 28
    RightTop = 28
    Center = 38
    LeftBottom = 28
    Bottom = 24
    RightBottom = 28
  }

  foreach ($name in @("LeftTop", "Top", "RightTop", "Center", "LeftBottom", "Bottom", "RightBottom")) {
    $point = $points[$name]
    $radius = $radii[$name] * $scale
    $Graphics.FillEllipse($nodeBrush, $point.X - $radius, $point.Y - $radius, $radius * 2, $radius * 2)
  }

  $accentRadius = 18 * $scale
  $Graphics.FillEllipse($accentBrush, $points.Center.X - $accentRadius, $points.Center.Y - $accentRadius, $accentRadius * 2, $accentRadius * 2)

  $nodeBrush.Dispose()
  $accentBrush.Dispose()
}

function New-PngBytes {
  param([int]$Size)

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  Draw-NetiorIcon -Graphics $graphics -Size $Size

  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()

  return $stream.ToArray()
}

$pngPath = Join-Path $resolvedOutputDir "netior-app-icon.png"
$pngBytes = New-PngBytes -Size 512
[System.IO.File]::WriteAllBytes($pngPath, $pngBytes)

$iconSizes = @(16, 32, 48, 64, 128, 256)
$icoPath = Join-Path $resolvedOutputDir "netior-app-icon.ico"
$fileStream = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$writer = New-Object System.IO.BinaryWriter($fileStream)

$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$iconSizes.Count)

$offset = 6 + (16 * $iconSizes.Count)
$images = @()

foreach ($size in $iconSizes) {
  $bytes = New-PngBytes -Size $size
  $images += [PSCustomObject]@{
    Size = $size
    Bytes = $bytes
    Offset = $offset
  }
  $offset += $bytes.Length
}

foreach ($image in $images) {
  $dimensionByte = if ($image.Size -ge 256) { 0 } else { [byte]$image.Size }
  $writer.Write($dimensionByte)
  $writer.Write($dimensionByte)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$image.Bytes.Length)
  $writer.Write([UInt32]$image.Offset)
}

foreach ($image in $images) {
  $writer.Write($image.Bytes)
}

$writer.Flush()
$writer.Dispose()
$fileStream.Dispose()

Write-Host "Wrote $pngPath"
Write-Host "Wrote $icoPath"
