# Phase 5 Tier 1 — ClearPick mechanical catalog audit
# Reads products.json, checks each product across 4 dimensions, outputs CSV + summary

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'  # speeds up Invoke-WebRequest

$jsonPath = 'products.json'
if (-not (Test-Path $jsonPath)) { Write-Error "products.json not found at $jsonPath"; exit 1 }

$products = Get-Content $jsonPath -Raw -Encoding utf8 | ConvertFrom-Json
Write-Host "Loaded $($products.Count) products from products.json"
Write-Host ""

$results = @()
$counter = 0

foreach ($p in $products) {
  $counter++
  Write-Progress -Activity "Tier 1 audit" -Status "$counter / $($products.Count): $($p.id)" -PercentComplete (($counter / $products.Count) * 100)

  $row = [PSCustomObject]@{
    Slug              = $p.id
    PageExists        = ''
    AffiliateOk       = ''
    AffiliateTag      = ''
    ImageStatus       = ''
    ImageDrift        = ''
    Flags             = ''
    Notes             = ''
  }

  $flags = @()
  $notes = @()

  # === CHECK 1: Page exists ===
  $pagePath = if ($p.page) { $p.page } else { "products/$($p.id).html" }
  if (Test-Path $pagePath) {
    $row.PageExists = 'PASS'
  } else {
    $row.PageExists = 'FAIL'
    $flags += 'PAGE'
    $notes += "page not found: $pagePath"
  }

  # === CHECK 2: Affiliate URL ===
  $affUrl = $p.amazonUrl
  if (-not $affUrl) {
    $row.AffiliateOk = 'FAIL'
    $row.AffiliateTag = '(missing)'
    $flags += 'AFF-MISSING'
    $notes += "no amazonUrl field"
  } elseif ($affUrl -match 'amzn\.to/') {
    $row.AffiliateOk = 'PASS'
    $row.AffiliateTag = 'amzn.to (opaque)'
  } elseif ($affUrl -match 'amazon\.ca/dp/([A-Z0-9]+).*?tag=([a-zA-Z0-9\-]+)') {
    $tag = $matches[2]
    $row.AffiliateTag = $tag
    if ($tag -eq 'clearpick06-20' -or $tag -eq 'lifehackfi0fb-20') {
      $row.AffiliateOk = 'PASS'
    } else {
      $row.AffiliateOk = 'FAIL'
      $flags += 'AFF-TAG'
      $notes += "unexpected tag: $tag"
    }
  } else {
    $row.AffiliateOk = 'FAIL'
    $row.AffiliateTag = '(unparseable)'
    $flags += 'AFF-FORMAT'
    $notes += "URL doesn't match amazon.ca/dp/ or amzn.to: $affUrl"
  }

  # === CHECK 3: Image URL returns 200 ===
  $imgUrl = $p.image
  if (-not $imgUrl) {
    $row.ImageStatus = 'FAIL'
    $flags += 'IMG-MISSING'
    $notes += "no image field"
  } else {
    try {
      $resp = Invoke-WebRequest -Uri $imgUrl -Method Head -TimeoutSec 10 -MaximumRedirection 5 -UseBasicParsing -ErrorAction Stop
      if ($resp.StatusCode -eq 200) {
        $row.ImageStatus = '200'
      } else {
        $row.ImageStatus = "$($resp.StatusCode)"
        $flags += 'IMG-STATUS'
        $notes += "image returned $($resp.StatusCode)"
      }
    } catch {
      $statusCode = $null
      if ($_.Exception.Response) { $statusCode = [int]$_.Exception.Response.StatusCode }
      if ($statusCode) {
        $row.ImageStatus = "$statusCode"
        $flags += 'IMG-STATUS'
        $notes += "image returned $statusCode"
      } else {
        $row.ImageStatus = 'TIMEOUT/ERR'
        $flags += 'IMG-ERR'
        $notes += "image request failed: $($_.Exception.Message)"
      }
    }
  }

  # === CHECK 4: Image URL drift between products.json and HTML ===
  if ((Test-Path $pagePath) -and $imgUrl) {
    $html = Get-Content $pagePath -Raw -Encoding utf8

    # Look for og:image meta tag first (most authoritative source on HTML page)
    $htmlImg = $null
    if ($html -match '<meta\s+property="og:image"\s+content="([^"]+)"') {
      $htmlImg = $matches[1]
    } elseif ($html -match '<img[^>]+class="[^"]*product-hero[^"]*"[^>]+src="([^"]+)"') {
      $htmlImg = $matches[1]
    } elseif ($html -match '<img[^>]+src="(https?://[^"]*amazon[^"]+)"') {
      # Fallback: first amazon image
      $htmlImg = $matches[1]
    }

    if (-not $htmlImg) {
      $row.ImageDrift = 'NO-HTML-IMG'
      $flags += 'IMG-NO-HTML'
      $notes += "couldn't find primary image in HTML"
    } elseif ($htmlImg -eq $imgUrl) {
      $row.ImageDrift = 'MATCH'
    } else {
      $row.ImageDrift = 'DRIFT'
      $flags += 'IMG-DRIFT'
      $notes += "json: $imgUrl ; html: $htmlImg"
    }
  } else {
    $row.ImageDrift = 'N/A'
  }

  $row.Flags = if ($flags.Count) { $flags -join ',' } else { 'CLEAN' }
  $row.Notes = $notes -join ' | '

  $results += $row
}

Write-Progress -Activity "Tier 1 audit" -Completed
Write-Host ""

# === OUTPUT ===

# 1. Summary counts
$clean = ($results | Where-Object Flags -eq 'CLEAN').Count
$flagged = $results.Count - $clean

Write-Host "=============================="
Write-Host "TIER 1 SUMMARY"
Write-Host "=============================="
Write-Host "Total products audited:  $($results.Count)"
Write-Host "Clean (all 4 checks):    $clean"
Write-Host "Flagged (1+ issue):      $flagged"
Write-Host ""

# Flag-type breakdown
$flagTypes = @{
  'PAGE'        = 'page missing on disk'
  'AFF-MISSING' = 'amazonUrl field missing'
  'AFF-TAG'     = 'unexpected affiliate tag'
  'AFF-FORMAT'  = 'affiliate URL unparseable'
  'IMG-MISSING' = 'image field missing'
  'IMG-STATUS'  = 'image returned non-200'
  'IMG-ERR'     = 'image request errored'
  'IMG-NO-HTML' = "couldn't find primary image in HTML"
  'IMG-DRIFT'   = 'json/html image URL mismatch'
}

Write-Host "FLAG BREAKDOWN:"
foreach ($flagKey in $flagTypes.Keys | Sort-Object) {
  $count = ($results | Where-Object { $_.Flags -match $flagKey }).Count
  if ($count -gt 0) {
    Write-Host ("  {0,-15} {1,3}  ({2})" -f $flagKey, $count, $flagTypes[$flagKey])
  }
}
Write-Host ""

# 2. Flagged rows printed inline (most useful flags only — exclude amzn.to-only rows)
$problemRows = $results | Where-Object { $_.Flags -ne 'CLEAN' }
if ($problemRows) {
  Write-Host "FLAGGED PRODUCTS (top of list):"
  $problemRows | Select-Object -First 30 | Format-Table Slug, Flags, Notes -Wrap -AutoSize
  if ($problemRows.Count -gt 30) {
    Write-Host "... $($problemRows.Count - 30) more flagged products in CSV"
  }
}

# 3. Write full CSV
$csvPath = 'phase5-tier1-results.csv'
$results | Export-Csv -Path $csvPath -NoTypeInformation -Encoding utf8
Write-Host ""
Write-Host "Full results written to: $csvPath"
Write-Host "Open in Excel/VS Code and sort by Flags column to triage."
