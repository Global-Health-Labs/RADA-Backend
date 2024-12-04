$pythonFiles = @(
    "App.py",
    "config.py",
    "db.py",
    "requirements.txt",
    "models",
    "routes",
    "templates"
)

foreach ($item in $pythonFiles) {
    if (Test-Path $item) {
        if (Test-Path "archive/$item") {
            Remove-Item "archive/$item" -Recurse -Force
        }
        Move-Item $item "archive/" -Force
    }
}
