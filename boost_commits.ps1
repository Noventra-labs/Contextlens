param (
    [int]$Count = 35
)

Write-Host "Creating $Count artificial commits..."
for ($i = 1; $i -le $Count; $i++) {
    git commit --allow-empty -m "chore: routine update $i"
}

Write-Host "Pushing to remote..."
git push

Write-Host "Done!"
