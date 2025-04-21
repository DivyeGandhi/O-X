#!/bin/bash

# Install dependencies
echo "Installing root dependencies..."
npm install --legacy-peer-deps

echo "Installing Client dependencies..."
cd Client
npm install --legacy-peer-deps

echo "Building Client..."
npm run build

echo "Installing Server dependencies..."
cd ../Server
npm install --legacy-peer-deps

echo "Starting Server..."
npm run prod:run 