param(
    [switch]$Repair
)

$ErrorActionPreference = "Continue"

function Section($Name) {
    Write-Host ""
    Write-Host "=== $Name ==="
}

Section "Outbound IP"
try {
    Invoke-RestMethod -Uri "https://ipinfo.io/json" -TimeoutSec 15 |
        Select-Object ip, city, region, country, org, timezone |
        Format-List
} catch {
    Write-Host "Failed to query outbound IP:" $_.Exception.Message
}

Section "Proxy State"
Write-Host "WinHTTP:"
netsh winhttp show proxy
Write-Host ""
Write-Host "WinINET:"
$reg = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
Get-ItemProperty $reg |
    Select-Object ProxyEnable, ProxyServer, AutoConfigURL |
    Format-List
Write-Host "Environment proxy variables:"
Get-ChildItem Env: |
    Where-Object { $_.Name -match "proxy|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY" } |
    Sort-Object Name |
    Format-Table -AutoSize

Section "Routes"
Get-NetRoute -DestinationPrefix "0.0.0.0/0" |
    Sort-Object RouteMetric, InterfaceMetric |
    Select-Object ifIndex, InterfaceAlias, NextHop, RouteMetric, InterfaceMetric, PolicyStore |
    Format-Table -AutoSize
Get-NetRoute -AddressFamily IPv4 |
    Where-Object { $_.DestinationPrefix -in @("0.0.0.0/1", "128.0.0.0/1") } |
    Select-Object DestinationPrefix, InterfaceAlias, NextHop, RouteMetric, InterfaceMetric, PolicyStore |
    Format-Table -AutoSize

Section "Endpoint Tests"
try {
    Invoke-WebRequest -Uri "https://api.openai.com/v1/models" -Method Get -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop | Out-Null
    Write-Host "OpenAI API: HTTP 200"
} catch {
    if ($_.Exception.Response) {
        $code = [int]$_.Exception.Response.StatusCode
        Write-Host "OpenAI API: HTTP $code" $_.Exception.Response.StatusDescription
        if ($code -eq 401) {
            Write-Host "401 is expected without an API key; network path is reachable."
        }
    } else {
        Write-Host "OpenAI API: transport error:" $_.Exception.Message
    }
}

try {
    Invoke-WebRequest -Uri "https://api.github.com/repos/openai/plugins" -Method Head -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop | Out-Null
    Write-Host "GitHub API: reachable"
} catch {
    if ($_.Exception.Response) {
        Write-Host "GitHub API: HTTP" ([int]$_.Exception.Response.StatusCode) $_.Exception.Response.StatusDescription
    } else {
        Write-Host "GitHub API: transport error:" $_.Exception.Message
    }
}

if ($Repair) {
    Section "Repair"
    ipconfig /flushdns
    netsh winhttp reset proxy
    Set-ItemProperty -Path $reg -Name ProxyEnable -Value 0
    Set-ItemProperty -Path $reg -Name ProxyServer -Value ""
    Set-ItemProperty -Path $reg -Name AutoConfigURL -Value ""
    Write-Host "Repair complete. Restart Codex after switching to a supported, stable network exit."
}

Section "Note"
Write-Host "If the outbound country/region is HK, CN, or another unsupported region, switch the VPN/proxy node to a supported region such as JP, SG, TW, KR, US, or EU before logging in to Codex."
