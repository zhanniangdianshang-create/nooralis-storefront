param(
  [Parameter(Mandatory = $true)]
  [string]$CheckoutUrl,

  [string]$ProviderName = "Oceanpayment Card Checkout",
  [string]$ActionLabel = "Pay by Credit / Debit Card",
  [string]$Badges = "Visa|Mastercard|Apple Pay|Google Pay",
  [string]$Note = "Secure credit and debit card checkout for one-kit online payments. For 2+ kits, urgent shows, or custom finishes, use the quote form below.",
  [bool]$SingleUnitOnly = $true
)

$ErrorActionPreference = "Stop"

function Set-VercelEnv {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  npx vercel env add $Name production --value $Value --force --yes | Out-Null
}

Set-VercelEnv -Name "CHECKOUT_PROVIDER" -Value "hosted_link"
Set-VercelEnv -Name "CHECKOUT_PROVIDER_NAME" -Value $ProviderName
Set-VercelEnv -Name "CHECKOUT_ACTION_LABEL" -Value $ActionLabel
Set-VercelEnv -Name "CHECKOUT_BADGES" -Value $Badges
Set-VercelEnv -Name "CHECKOUT_NOTE" -Value $Note
Set-VercelEnv -Name "HOSTED_CHECKOUT_URL" -Value $CheckoutUrl
Set-VercelEnv -Name "HOSTED_CHECKOUT_SINGLE_UNIT_ONLY" -Value $SingleUnitOnly.ToString().ToLowerInvariant()

npx vercel --prod --yes

