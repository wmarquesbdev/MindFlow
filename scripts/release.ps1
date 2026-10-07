$ErrorActionPreference = 'Stop'
$repoPath = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repoPath
$version = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
$tag = "v$version"
$folder = Join-Path $repoPath 'out/make/squirrel.windows/x64'
$installer = Join-Path $folder "MindFlow-$version Setup.exe"
$package = Join-Path $folder "MindFlow-$version-full.nupkg"
$manifest = Join-Path $folder 'RELEASES'
foreach ($asset in @($installer, $package, $manifest)) {
  if (-not (Test-Path -LiteralPath $asset -PathType Leaf)) { throw "Build incompleto: $asset" }
}
$packageName = Split-Path $package -Leaf
$hash = (Get-FileHash -LiteralPath $package -Algorithm SHA1).Hash
$size = (Get-Item -LiteralPath $package).Length
if ((Get-Content -LiteralPath $manifest -Raw).Trim() -ine "$hash $packageName $size") { throw 'RELEASES não corresponde ao pacote desta versão.' }
if (git status --porcelain) { throw 'Faça commit e push antes de publicar.' }
$commit = git rev-parse HEAD
gh release create $tag $installer $package $manifest --repo wmarquesbdev/MindFlow --target $commit --title "MindFlow $version" --generate-notes --draft
if ($LASTEXITCODE -ne 0) { throw 'Falha no envio; mantenha o rascunho até conferir todos os arquivos.' }
gh release edit $tag --repo wmarquesbdev/MindFlow --draft=false --latest
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível publicar o rascunho.' }
