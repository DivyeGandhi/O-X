#!/bin/bash

# Install server dependencies
echo "Installing server dependencies..."
cd Server
npm install --legacy-peer-deps

# Install and build client
echo "Installing and building client..."
cd ../Client
npm install
npm run build

# Return to server directory
cd ../Server

# Start the server
echo "Starting server..."
cross-env NODE_ENV=production node server.js 