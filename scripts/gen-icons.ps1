# Renders the SparePage logo (public/icons/sparepages-svg.svg) to the PNGs that can't be SVG:
#
#   Outputs: public/icons/icon{16,48,128}.png  - Chrome toolbar / extensions page
#            site/assets/favicon-32.png        - site favicon
#            site/assets/apple-touch-icon.png  - iOS home screen (opaque white background)
#
# Uses headless Chrome, so no image tooling is needed.
# Run:  powershell -ExecutionPolicy Bypass -File scripts/gen-icons.ps1
$root = Split-Path -Parent $PSScriptRoot
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Chrome not found' }

$tmp = Join-Path ([IO.Path]::GetTempPath()) 'sparepage-icons'
New-Item -ItemType Directory -Force $tmp | Out-Null
Copy-Item (Join-Path $root 'public/icons/sparepages-svg.svg') (Join-Path $tmp 'logo.svg') -Force

function Render([int]$size, [string]$out, [string]$bg = 'transparent') {
  $page = Join-Path $tmp 'p.html'
  "<!doctype html><style>html,body{margin:0;background:$bg}img{display:block;width:${size}px;height:${size}px}</style><img src=`"logo.svg`">" |
    Set-Content -Encoding utf8 $page
  $shot = Join-Path $tmp 'out.png'
  & $chrome --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
    --default-background-color=00000000 "--window-size=$size,$size" "--screenshot=$shot" ([Uri]$page).AbsoluteUri 2>$null | Out-Null
  Copy-Item $shot (Join-Path $root $out) -Force
}

Render 16 'public/icons/icon16.png'
Render 48 'public/icons/icon48.png'
Render 128 'public/icons/icon128.png'
Render 32 'site/assets/favicon-32.png'
Render 180 'site/assets/apple-touch-icon.png' '#fff'
