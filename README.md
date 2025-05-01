# Battleship 2.0

A modern, animated Battleship game with singleplayer and multiplayer modes, built with Node.js, Express, Socket.IO, and vanilla JavaScript.

## Features

- **Singleplayer**: Play against the computer with animated effects.
- **Multiplayer**: Challenge a friend in real-time using Socket.IO.
- **Modern UI**: Responsive design, water-themed transitions, and interactive effects.
- **Theme Switcher**: Toggle between light and dark modes.
- **Sound & Visual Effects**: Click sparks, water transitions, confetti, and more.
- **Drag & Drop**: Place ships intuitively on your board.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or newer recommended)
- npm (comes with Node.js)

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/yourusername/BattleShip-2.0.git
   cd BattleShip-2.0
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Start the server:**
   ```sh
   npm start
   ```
   or
   ```sh
   node server.js
   ```

4. **Open the game in your browser:**
   ```
   http://localhost:3000
   ```

## Project Structure

```
BattleShip-2.0/
  ├── public/
  │   ├── app.js
  │   ├── ClickSpark.js
  │   ├── WaterTransition.js
  │   ├── style.css
  │   ├── index.html
  │   ├── singleplayer.html
  │   ├── multiplayer.html
  │   └── images/
  ├── server.js
  ├── package.json
  └── .gitignore
```

- **public/**: Frontend assets (HTML, CSS, JS, images)
- **server.js**: Express + Socket.IO backend
- **package.json**: Project metadata and dependencies

## How to Play

1. **Single Player**: Click "Single Player" on the main menu. Drag and drop your ships, then start the game to play against the computer.
2. **Multiplayer**: Click "Multiplayer" and wait for another player to join. Place your ships and get ready for battle!

## Credits

- Based on [kubowania/battleships](https://github.com/kubowania/battleships) with major enhancements.
- UI/UX, animations, and multiplayer logic by [Your Name].

## License

MIT License

---

Enjoy the game!