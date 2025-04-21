# Install dependencies
Write-Host "Installing root dependencies..."
npm install --legacy-peer-deps

Write-Host "Installing Client dependencies..."
cd Client
npm install --legacy-peer-deps

Write-Host "Building Client..."
npm run build

Write-Host "Installing Server dependencies..."
cd ../Server
npm install --legacy-peer-deps

Write-Host "Starting Server..."
npm run prod:run 