param([Parameter(Mandatory=$true)][string]$InputPath,[Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -eq 0} | Stop-Process -Force -ErrorAction SilentlyContinue
$wordInstance=$null
$contractDocument=$null
try {
 $wordInstance=New-Object -ComObject Word.Application
 try{$wordInstance.Visible=$false}catch{Write-Warning "[PDF] Warning ocultando Word: $($_.Exception.Message)"}
 try{$wordInstance.DisplayAlerts=0}catch{Write-Warning "[PDF] Warning ajustando DisplayAlerts: $($_.Exception.Message)"}
 try{$wordInstance.AutomationSecurity=3}catch{Write-Warning "[PDF] Warning ajustando AutomationSecurity: $($_.Exception.Message)"}
 $contractDocument=$wordInstance.Documents.Open($InputPath,$false,$true,$false)
 $contractDocument.ExportAsFixedFormat($OutputPath,17)
 if(-not (Test-Path -LiteralPath $OutputPath)){throw 'Microsoft Word no creó el archivo PDF.'}
 $pdfFile=Get-Item -LiteralPath $OutputPath
 if($pdfFile.Length -le 0){throw 'Microsoft Word creó un archivo PDF vacío.'}
 Write-Output "[PDF] Exportación Word exitosa"
} catch {
 Write-Output "[PDF] Conversión fallida: $($_.Exception.Message)"
 throw
} finally {
 try {if($null -ne $contractDocument){$contractDocument.Close([ref]0)}} catch {Write-Warning "[PDF] Warning cerrando documento: $($_.Exception.Message)"}
 try {if($null -ne $wordInstance){$wordInstance.Quit([ref]0)}} catch {Write-Warning "[PDF] Warning cerrando Word: $($_.Exception.Message)"}
 try {if($null -ne $contractDocument){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($contractDocument)}} catch {Write-Warning "[PDF] Warning liberando documento COM: $($_.Exception.Message)"}
 try {if($null -ne $wordInstance){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordInstance)}} catch {Write-Warning "[PDF] Warning liberando Word COM: $($_.Exception.Message)"}
 try {
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
 } catch {Write-Warning "[PDF] Warning durante limpieza GC: $($_.Exception.Message)"}
}

