$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]

function Await-WinRt($AsyncOperation, [Type] $ResultType) {
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } |
    Select-Object -First 1
  $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($AsyncOperation))
  $task.Wait()
  return $task.Result
}

$source = Join-Path $PSScriptRoot 'outputs\chusyou_ocr_images'
$target = Join-Path $PSScriptRoot 'outputs\chusyou_ocr_text'
New-Item -ItemType Directory -Force -Path $target | Out-Null

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('ja'))
if (-not $engine) { throw 'Japanese Windows OCR engine is unavailable.' }

$files = Get-ChildItem -LiteralPath $source -File | Sort-Object Name
$index = 0
foreach ($file in $files) {
  $index++
  $output = Join-Path $target ($file.BaseName + '.txt')
  if (-not (Test-Path -LiteralPath $output)) {
    $storageFile = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($file.FullName)) ([Windows.Storage.StorageFile])
    $stream = Await-WinRt ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    Set-Content -LiteralPath $output -Value $result.Text -Encoding UTF8
    $bitmap.Dispose()
    $stream.Dispose()
  }
  if (($index % 25) -eq 0 -or $index -eq $files.Count) {
    Write-Output "ocr=$index/$($files.Count)"
  }
}
