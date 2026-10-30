param([string]$JdkHome = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$javaBin = if ($JdkHome) { Join-Path $JdkHome 'bin' } else { Split-Path (Get-Command javac -ErrorAction Stop).Source }
$gson = Get-ChildItem (Join-Path $repo '.devlibs') -Filter 'gson-*.jar' | Select-Object -First 1
if (!$gson) { throw 'The config check needs the Gson compile-check jar in .devlibs.' }
$outputDir = Join-Path $env:TEMP ('petal-config-classes-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $outputDir | Out-Null
$sources = @(
    'mod/checks/support/net/fabricmc/loader/api/FabricLoader.java',
    'mod/src/main/java/dev/petal/client/ui/Theme.java',
    'mod/src/main/java/dev/petal/client/config/ModuleSettings.java',
    'mod/src/main/java/dev/petal/client/config/PetalConfig.java',
    'mod/checks/PetalConfigCheck.java'
) | ForEach-Object { Join-Path $repo $_ }
& (Join-Path $javaBin 'javac.exe') --release 21 -cp $gson.FullName -d $outputDir @sources
if ($LASTEXITCODE -ne 0) { throw 'Config check compilation failed.' }
& (Join-Path $javaBin 'java.exe') -ea -cp "$outputDir;$($gson.FullName)" PetalConfigCheck
if ($LASTEXITCODE -ne 0) { throw 'Config behavior checks failed.' }
