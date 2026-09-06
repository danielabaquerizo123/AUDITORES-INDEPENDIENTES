param([Parameter(Mandatory=$true)][string]$InputPath,[Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$wordInstance=$null
$contractDocument=$null
try {
 $wordInstance=New-Object -ComObject Word.Application
 $wordInstance.Visible=$false
 $wordInstance.DisplayAlerts=0
 $wordInstance.AutomationSecurity=3
 $contractDocument=$wordInstance.Documents.Open($InputPath,$false,$true,$false)
 $contractDocument.ExportAsFixedFormat($OutputPath,17)
} finally {
 if($null -ne $contractDocument){$contractDocument.Close([ref]0);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($contractDocument)}
 if($null -ne $wordInstance){$wordInstance.Quit([ref]0);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordInstance)}
}

