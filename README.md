# Ludo Game

A modern implementation of the classic Ludo board game built with TypeScript and Vite. This project features a decoupled architecture with a core game engine and support for both 2D (Canvas) and 3D (Three.js) rendering systems.

## 🚀 Features

*   **Dual Rendering Systems**: Switch between a classic 2D Canvas view and an immersive 3D experience.
*   **Decoupled Architecture**: Game logic (`engine2d`) is completely separate from presentation (`renderer2d`, `renderer3d`).
*   **Event-Driven**: Uses a custom `EventBus` for communication between components.
*   **Cross-Platform Ready**: configured with Capacitor for mobile deployment.
*   **Type-Safe**: Built entirely in TypeScript for robust and maintainable code.

## 🛠️ Tech Stack

*   **Language**: TypeScript
*   **Build Tool**: [Vite](https://vitejs.dev/)
*   **3D Rendering**: [Three.js](https://threejs.org/)
*   **Mobile Engine**: [Capacitor](https://capacitorjs.com/)

## 📂 Project Structure

```
src/
├── engine2d/       # Core game logic, rules, and state management
├── renderer2d/     # 2D Canvas-based renderer
├── renderer3d/     # 3D Three.js-based renderer
├── ui/             # UI components (HUD, Menus, etc.)
├── styles/         # Global styles and themes
└── main.ts         # Application entry point
```

## 🏁 Getting Started

### Prerequisites

*   Node.js (v14 or higher)
*   npm

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/tishbian-meshach/ludo-game.git
    cd ludo
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

### Building for Production

To build the application for production:

```bash
npm run build
```

## 📱 Mobile Development

This project is set up with Capacitor. To sync with native projects:

```bash
npx cap sync
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[MIT](LICENSE)
