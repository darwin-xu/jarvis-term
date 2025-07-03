# SSH Terminal Tool - React + TypeScript

A modern web-based SSH terminal application built with React, TypeScript, and Node.js. Features a clean, responsive interface with an integrated AI assistant for command help and automation.

## Features

- **Web-based SSH Terminal**: Connect to remote servers through your browser
- **AI Assistant**: Integrated AI helper with command execution capabilities
- **Modern React UI**: Built with React 18 and TypeScript for type safety
- **Real-time Communication**: WebSocket-based terminal communication
- **Session Management**: Automatic session cleanup and reconnection
- **Command Logging**: Track and log terminal commands
- **Responsive Design**: Works on desktop and mobile devices

## Architecture

The project is now organized with a clear separation of concerns:

```
├── server/                 # Node.js backend server
│   └── index.js           # Express server with WebSocket support
├── src/                   # React frontend source
│   ├── components/        # React components
│   │   ├── Login.tsx      # Authentication component
│   │   ├── Terminal.tsx   # Terminal component
│   │   ├── AIAssistant.tsx # AI assistant panel
│   │   └── ConfigModal.tsx # Configuration modal
│   ├── hooks/             # Custom React hooks
│   │   ├── useAuth.ts     # Authentication hook
│   │   └── useTerminal.ts # Terminal management hook
│   ├── services/          # Business logic services
│   │   ├── authService.ts # Authentication service
│   │   └── terminalService.ts # Terminal communication service
│   ├── styles/            # CSS stylesheets
│   │   ├── main.css       # Main application styles
│   │   └── ai-assistant.css # AI assistant styles
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts       # Application types
│   ├── App.tsx            # Main React application
│   └── main.tsx           # Application entry point
├── dist/                  # Built React application (generated)
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build configuration
└── .env                   # Environment variables
```

## Development

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
VITE_SSH_HOST=your-server-host
VITE_SSH_USER=your-username
VITE_SSH_PASS=your-password
VITE_SSH_PORT=22
```

### Development Server

Run both the frontend and backend in development mode:

```bash
# Start both client and server in parallel
npm run dev

# Or start them separately:
npm run client  # React dev server (localhost:5173)
npm run server  # Node.js server (localhost:3000)
```

### Production Build

```bash
# Build the React application
npm run build

# Start the production server
npm run server
```

## Usage

1. **Authentication**: Enter your application password to access the terminal
2. **SSH Connection**: The terminal automatically connects using configured credentials
3. **AI Assistant**: Press `Cmd+I` (or `Ctrl+I`) to open the AI assistant
4. **Command Execution**: Use prefixes like `/cmd`, `/command`, `/exec`, or `/run` in the AI chat to execute terminal commands
5. **Configuration**: Click the gear icon in the AI assistant to configure settings

## Technology Stack

### Frontend

- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Type-safe JavaScript with strict typing
- **Vite**: Fast build tool and development server
- **XTerm.js**: Full-featured terminal emulator for the web
- **CSS3**: Custom stylesheets with modern CSS features

### Backend

- **Node.js**: JavaScript runtime for the server
- **Express.js**: Web application framework
- **WebSocket**: Real-time bidirectional communication
- **SSH2**: SSH client for Node.js
- **UUID**: Session ID generation

## API Endpoints

- `POST /auth/login` - User authentication
- `POST /auth/logout` - User logout
- `GET /auth/check` - Check authentication status
- `POST /sessions/terminate` - Terminate SSH session
- `POST /api/command-log` - Log terminal commands
- `WS /terminal` - WebSocket connection for terminal communication

## Configuration

### Server Configuration

Set environment variables for the Node.js server:

- `APP_PASSWORD` - Application authentication password
- `SESSION_TIMEOUT_MIN` - Session timeout in minutes (default: 30)
- `PORT` - Server port (default: 3000)

### Client Configuration

Configure via the `.env` file or the in-app configuration modal:

- SSH connection details
- AI assistant settings
- Theme preferences

## Security

- Password-based authentication for web access
- SSH credentials are handled server-side
- Session management with automatic cleanup
- HTTPS recommended for production deployment

## Contributing

1. Follow the existing TypeScript and React patterns
2. Use descriptive variable and function names
3. Add comments for complex logic
4. Keep functions small and focused
5. Run `npm run format` before committing
6. Ensure all TypeScript errors are resolved

## Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build for production
- `npm run client` - Start React development server
- `npm run server` - Start Node.js server
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
