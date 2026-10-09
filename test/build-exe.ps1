# test/build-exe.ps1
# Builds test/chatterly-test.exe from test/launcher.cs using the C# compiler that ships with Windows.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -Language CSharp -TypeDefinition (Get-Content -Raw -Encoding UTF8 (Join-Path $here 'launcher.cs')) -OutputType ConsoleApplication -OutputAssembly (Join-Path $here 'chatterly-test.exe')
Write-Host 'Built test/chatterly-test.exe'
