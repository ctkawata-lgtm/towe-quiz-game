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

$source = (Resolve-Path '.\outputs\koteishisan_ocr_images').Path
$target = Join-Path (Resolve-Path '.\outputs').Path 'koteishisan_ocr_text'
New-Item -ItemType Directory -Force -Path $target | Out-Null

$language = [Windows.Globalization.Language]::new('ja')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
if (-not $engine) { throw 'Japanese Windows OCR engine is unavailable.' }

$files = Get-ChildItem -LiteralPath $source -File | Sort-Object Name
$index = 0
foreach ($image in $files) {
  $index++
  $output = Join-Path $target ($image.BaseName + '.txt')
  if (-not (Test-Path -LiteralPath $output)) {
    $file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($image.FullName)) ([Windows.Storage.StorageFile])
    $stream = Await-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    Set-Content -LiteralPath $output -Value $result.Text -Encoding UTF8
    $bitmap.Dispose()
    $stream.Dispose()
  }
  if ($index % 25 -eq 0 -or $index -eq $files.Count) {
    Write-Output "ocr=$index/$($files.Count)"
  }
}
