## DokQ — Smart Queuing and Appointments for Healthcare

DokQ is an integrated platform for discovering healthcare facilities and managing appointments. It focuses on reducing wait times, improving clinic efficiency, and giving patients a simple, modern experience on web and mobile.

### Highlights

- Simple and secure authentication (email or Google)
- Fast appointment booking and editing
- Patient dashboard with consult history and documents
- Facility discovery with filters and details
- Accessible UI, responsive across devices

---

## Quick start

### 1) Deploy with Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/4sightorg/dokq)

### 2) Run locally

Prerequisites: Node.js 18+, npm or pnpm

```shell
git clone https://github.com/4sightorg/dokq
cd dokq
npm install

# Configure environment (see below)
cp .env.example .env.local  # if you have an example file; otherwise create .env.local

# Development
npm run dev

# Production build + start
npm run build:all
npm run start
```

### 3) Docker (single container)

```shell
docker run -p 5173:5173 --name dokq \
  -e VITE_FIREBASE_API_KEY=your_api_key \
  -e VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com \
  -e VITE_FIREBASE_PROJECT_ID=your_project_id \
  -e VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com \
  -e VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890 \
  -e VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef \
  -e VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXX \
  ghcr.io/4sightorg/dokq:latest
```

### 4) Docker Compose

```shell
curl -fsSL https://raw.githubusercontent.com/4sightorg/dokq/refs/heads/main/docker-compose.yml -o docker-compose.yml
docker compose up
```

---

## Environment variables

Create an `.env.local` (used by Vite) with the following keys:

```ini
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

You can verify your environment locally:

```shell
npm run verify-env
```

---

## Project scripts

```text
npm run dev            # Start Vite dev server
npm run build          # Build frontend
npm run build:all      # Build frontend + API
npm run start          # Start API/server (production)
npm run test           # Run unit tests (Vitest)
npm run lint           # Lint + Prettier check
npm run lint:fix       # Autofix lint errors & format
```

---

## Tech stack

- React, TypeScript, Vite
- Node.js/Express for API
- Firebase (Auth, Firestore, Storage)
- ESLint, Prettier, Vitest
- Vercel / Docker for deployment

---

## Contributing

1. Fork and clone the repository
2. Create a branch using conventional commits (e.g., `feat:`, `fix:`)
3. Make changes with linting and tests passing
4. Open a pull request with a clear description and screenshots when relevant

---

## AI usage disclosure

Generative AI was used for:

- Code review and validation
- Debugging and test ideation
- Summarizing framework/API documentation

---

## Acknowledgements

Special thanks to the contributors and maintainers. We also acknowledge the authors of the open‑source tools used in this project and the m3-Markdown-Badges project for the technology badges.

---

## License

This project is currently distributed without a public license. For usage or redistribution inquiries, please contact the maintainers.
