# Fixing "Cannot find module 'express'" Error

If you encounter this error when trying to run the Battleship game, follow these steps:

## Installation Steps

1. Make sure you've installed all dependencies first:
   ```
   npm install
   ```

2. If you still get the error, install Express and Socket.IO explicitly:
   ```
   npm install express socket.io
   ```

3. Then try running the server again:
   ```
   npm start
   ```

## What Happened?

This error occurs when the Node.js dependencies haven't been installed yet or weren't included in the repository.

The game requires several Node.js packages to run:
- express (web server)
- socket.io (real-time multiplayer)
- and other dependencies

These packages are listed in the `package.json` file, but need to be installed locally using npm.

## Full Installation Guide

For a complete installation guide, please see the README.md file. 