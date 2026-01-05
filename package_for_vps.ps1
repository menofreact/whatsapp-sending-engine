$zipName = "WAHAsender_VPS.zip"
$exclude = @("node_modules", ".git", "uploads", "db", "*.zip")

echo "Packaging project for VPS..."

# Remove old zip if exists
if (Test-Path $zipName) { Remove-Item $zipName }

# Create zip (excluding heavy folders)
Compress-Archive -Path * -DestinationPath $zipName -Force

echo "✅ Created $zipName"
echo "Instructions:"
echo "1. Upload $zipName to your VPS."
echo "2. Unzip it: 'unzip $zipName'"
echo "3. Run: 'bash vps_setup.sh'"
