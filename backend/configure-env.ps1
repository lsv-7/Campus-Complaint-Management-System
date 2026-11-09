$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $envPath) {
    throw 'backend/.env already exists. Edit it locally; this helper will not overwrite existing settings.'
}

$securePassword = Read-Host 'Enter MySQL root password (input is hidden)' -AsSecureString
$passwordPointer = [IntPtr]::Zero
$plainPassword = $null
$randomGenerator = $null
try {
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    $secretBytes = New-Object byte[] 48
    $randomGenerator.GetBytes($secretBytes)
    $jwtSecret = [Convert]::ToBase64String($secretBytes)
    $escapedPassword = $plainPassword.Replace('\', '\\').Replace('"', '\"')
    $lines = @(
        'PORT=5000',
        'CLIENT_URL=http://localhost:5173',
        'DB_HOST=localhost',
        'DB_PORT=3306',
        'DB_USER=root',
        "DB_PASSWORD=`"$escapedPassword`"",
        'DB_NAME=campuscare',
        "JWT_SECRET=$jwtSecret",
        'JWT_EXPIRES_IN=1d'
    )
    [IO.File]::WriteAllLines($envPath, $lines, [Text.UTF8Encoding]::new($false))
    Write-Output 'Created backend/.env. The MySQL password was not displayed.'
}
finally {
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    if ($randomGenerator) { $randomGenerator.Dispose() }
    if ($securePassword) { $securePassword.Dispose() }
    $plainPassword = $null
    $escapedPassword = $null
    $jwtSecret = $null
    $secretBytes = $null
}
