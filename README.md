# Rover UI

A full-stack web application for autonomous rover control and monitoring, built as part of a capstone project. This platform provides real-time telemetry, autonomous navigation, manual control, and pothole detection capabilities through a modern web interface communicating with ROS2-based rovers.

## 🎓 About

This project is part of a capstone initiative to develop an autonomous rover system for infrastructure inspection. The web interface serves as the mission control center, enabling operators to plan routes, monitor rover status, and analyze collected data in real-time.

**Project Wiki:** [https://github.com/ByteSizedRobotics/rover-ui/wiki](https://github.com/ByteSizedRobotics/rover-ui/wiki)

## ✨ Features

- **🔐 User Authentication** - Secure login and registration system
- **🤖 Rover Management** - Monitor and manage multiple rovers
- **🗺️ Autonomous Navigation** - Plan and execute waypoint-based missions
- **🎮 Manual Control** - Real-time joystick control with live camera feeds
- **📡 Live Telemetry** - GPS, IMU, battery, and sensor data visualization
- **🚨 Pothole Detection** - AI-powered infrastructure analysis and tracking
- **📊 Path History** - Review past missions and collected data
- **📹 Dual Camera Support** - CSI and USB camera streams via WebRTC
- **🔍 LiDAR Visualization** - Real-time obstacle detection and mapping

## 🛠️ Technologies

- **Frontend:** [SvelteKit 5](https://kit.svelte.dev/docs) (Runes), [TailwindCSS](https://tailwindcss.com/), [DaisyUI](https://daisyui.com/)
- **Backend:** [Node.js](https://nodejs.org/), [PostgreSQL](https://www.postgresql.org/), [Drizzle ORM](https://orm.drizzle.team/)
- **Robotics:** [ROS2 Humble](https://docs.ros.org/en/humble/), WebRTC, rosbridge
- **Mapping:** [Leaflet](https://leafletjs.com/)
- **Deployment:** [Docker](https://www.docker.com/), Docker Compose

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/get-started) & Docker Compose
- [PostgreSQL](https://www.postgresql.org/) (or use Docker setup)

### Using Docker Compose (Recommended)

The easiest way to run the entire stack with database and sample data:

```bash
docker compose up
```

Navigate to **[http://localhost:3000](http://localhost:3000)** and register a new user account.

To stop:
```bash
docker compose down          # Stop services
docker compose down -v       # Stop and remove volumes
```

### Local Development

1. **Start the database:**
   ```bash
   docker compose up -d postgres
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file:
   ```env
   DATABASE_URL="postgres://root:mysecretpassword@localhost:5432/local"
   ```

4. **Start the dev server:**
   ```bash
   npm run dev
   ```

5. **Navigate to the URL printed in terminal** (typically **[http://localhost:5173](http://localhost:5173)**)

## 📚 Useful Commands

### Development
```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Check code quality
npm run format           # Format code with Prettier
```

### Database
```bash
npx drizzle-kit studio   # Open Drizzle Studio database viewer
npm run db:push          # Push schema changes
npm run db:migrate       # Run migrations
```

### Testing
```bash
npm run test             # Run all tests
npm run test:unit        # Run unit tests
npm run test:e2e         # Run E2E tests with Playwright
```

### Docker
```bash
docker compose up -d     # Start in detached mode
docker compose logs -f   # Follow logs
docker compose down -v   # Stop and remove everything
```

## 🤝 ROS2 Integration

The application communicates with rover hardware through ROS2 Humble. Key integration points:

- **rosbridge WebSocket** - Real-time bidirectional communication
- **WebRTC** - Low-latency camera streaming
- **Topics:** GPS (`/fix`), IMU (`/imu/raw`), LiDAR (`/scan`), commands (`/command`), etc.

Configure the rover connection in `src/lib/ros2Config.ts`.

**ROS2 Documentation:** [https://docs.ros.org/en/humble/](https://docs.ros.org/en/humble/)

## 📖 Documentation

- **Project Wiki:** [github.com/ByteSizedRobotics/rover-ui/wiki](https://github.com/ByteSizedRobotics/rover-ui/wiki)
- **Docker Hub:** [hub.docker.com/r/bytesizedrobotics/rover-ui](https://hub.docker.com/r/bytesizedrobotics/rover-ui)
- **Database Schema:** `drizzle/schema.sql`

## 🏗️ Project Structure

```
src/
├── lib/
│   ├── components/       # Reusable Svelte components
│   ├── server/          # Backend logic and database
│   ├── ros2CommandCentre.ts  # ROS2 WebSocket client
│   └── ros2Config.ts    # ROS2 connection settings
├── routes/              # SvelteKit pages and API routes
│   ├── api/            # REST API endpoints
│   ├── rovers/         # Rover management pages
│   ├── manual-ctrl/    # Manual control interface
│   └── map/            # Mission planning
└── app.html            # HTML template
```

## 🔧 Building & Deployment

### Build Docker Image
```bash
docker build --build-arg DATABASE_URL="postgres://root:mysecretpassword@localhost:5432/local" \
  -t bytesizedrobotics/rover-ui .
```

### Run Docker Image
```bash
docker run -e DATABASE_URL="postgres://..." \
  -e ORIGIN=http://localhost:3000 \
  --network rover-ui_default \
  -p 3000:3000 \
  bytesizedrobotics/rover-ui
```

**Note:** The `ORIGIN` environment variable is required for server-side functionality.

## 📦 Automated Releases

GitHub Actions automatically builds and publishes Docker images to Docker Hub when a new release is published.

## 📄 License

Developed for CEG4912/4913 (4th year Computer Engineering Capstone Project)

## 👥 Contributors

Built by ByteSized Robotics capstone team.
