# Starts ShareUp locally. Secrets are read from ".env" next to this script (see .env.example).
#
#   .\start-all.ps1                 all three services + frontend, each in its own window
#   .\start-all.ps1 rental          only rental-service, in a new window
#   .\start-all.ps1 rental -Here    only rental-service, in this window

param(
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [ValidateSet('auth', 'item', 'rental', 'frontend')]
    [string[]]$Services = @('auth', 'item', 'rental', 'frontend'),

    [switch]$Here
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# ---- read .env -------------------------------------------------------------

$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
    Write-Host "Missing $envFile" -ForegroundColor Red
    Write-Host "Copy .env.example to .env and fill in the values."
    exit 1
}

$cfg = @{}
foreach ($line in Get-Content $envFile -Encoding UTF8) {
    $line = $line.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { continue }
    $i = $line.IndexOf('=')
    if ($i -lt 1) { continue }
    $cfg[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim().Trim('"').Trim("'")
}

# ---- what each service needs -----------------------------------------------
# A value starting with "@" is looked up in .env; anything else is used as written.

$cloudinary = @{
    CLOUDINARY_CLOUD_NAME = '@CLOUDINARY_CLOUD_NAME'
    CLOUDINARY_API_KEY    = '@CLOUDINARY_API_KEY'
    CLOUDINARY_API_SECRET = '@CLOUDINARY_API_SECRET'
}

$defs = @{
    auth = @{
        Dir = 'auth-service'
        Run = { & .\mvnw.cmd spring-boot:run }
        Env = @{
            PORT                           = '8080'
            DATABASE_URL                   = '@DATABASE_URL'
            DB_USERNAME                    = '@DB_USERNAME'
            DB_PASSWORD                    = '@DB_PASSWORD'
            JWT_SECRET                     = '@JWT_SECRET'
            SPRING_JPA_HIBERNATE_DDL_AUTO  = 'update'
        }
    }
    item = @{
        Dir = 'item-service'
        Run = { & .\mvnw.cmd spring-boot:run }
        Env = @{
            PORT        = '8081'
            MONGODB_URI = '@ITEM_MONGODB_URI'
            JWT_SECRET  = '@JWT_SECRET'
        } + $cloudinary
    }
    rental = @{
        Dir = 'rental-service'
        Run = { & .\mvnw.cmd spring-boot:run }
        Env = @{
            PORT             = '8082'
            MONGODB_URI      = '@RENTAL_MONGODB_URI'
            JWT_SECRET       = '@JWT_SECRET'
            AUTH_SERVICE_URL = 'http://localhost:8080'
            ITEM_SERVICE_URL = 'http://localhost:8081'
            MAIL_USERNAME    = '@MAIL_USERNAME'
            MAIL_PASSWORD    = '@MAIL_PASSWORD'
        } + $cloudinary
    }
    frontend = @{
        Dir = 'Frontend\shareup-frontend'
        Run = { npm run dev }
        Env = @{}
    }
}

# ---- check .env has everything before opening any window -------------------

$missing = @()
foreach ($name in $Services) {
    foreach ($value in $defs[$name].Env.Values) {
        if ($value.StartsWith('@') -and -not $cfg[$value.Substring(1)]) { $missing += $value.Substring(1) }
    }
}
if ($missing) {
    Write-Host "These values are empty or missing in .env:" -ForegroundColor Red
    $missing | Sort-Object -Unique | ForEach-Object { Write-Host "  $_" }
    exit 1
}

# ---- start -----------------------------------------------------------------

if ($Here) {
    if ($Services.Count -ne 1) {
        Write-Host "-Here runs one service: .\start-all.ps1 rental -Here" -ForegroundColor Red
        exit 1
    }

    $def = $defs[$Services[0]]
    foreach ($key in $def.Env.Keys) {
        $value = $def.Env[$key]
        if ($value.StartsWith('@')) { $value = $cfg[$value.Substring(1)] }
        Set-Item -Path "Env:$key" -Value $value
    }

    $Host.UI.RawUI.WindowTitle = "ShareUp - $($Services[0])"
    Set-Location (Join-Path $root $def.Dir)
    & $def.Run
    return
}

foreach ($name in $Services) {
    Start-Process powershell -ArgumentList @(
        '-NoExit', '-ExecutionPolicy', 'Bypass',
        '-File', "`"$PSCommandPath`"", $name, '-Here'
    )
    Write-Host "Started $name"
}
