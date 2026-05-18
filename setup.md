# Panarchy - Setup Guide

Welcome to the **Panarchy** project! This guide will walk you through setting up the site on your local machine for development and testing.

## Prerequisites

Before you begin, ensure you have the following installed on your system:
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js) or **bun** (if you prefer using the bun runtime, as indicated by `bun.lock`)

## 1. Installation

First, navigate to the project directory:

```bash
cd Panarchy
```

Then, install the project dependencies. If you are using `npm`:

```bash
npm install
```

*(Alternatively, if you are using `bun`, simply run `bun install`)*

## 2. Environment Variables

The project relies on **Supabase** for authentication and database services. You will need to configure your environment variables for the app to function properly.

Create a `.env` file in the root of your project (if one does not already exist) and populate it with your Supabase credentials:

```env
SUPABASE_URL="https://<YOUR_PROJECT_ID>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<YOUR_ANON_KEY>"
VITE_SUPABASE_PROJECT_ID="<YOUR_PROJECT_ID>"
VITE_SUPABASE_URL="https://<YOUR_PROJECT_ID>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<YOUR_ANON_KEY>"
```
> **Note**: Make sure to replace `<YOUR_PROJECT_ID>` and `<YOUR_ANON_KEY>` with your actual Supabase project values. Do not commit these sensitive keys to public version control!

## 3. Local Development

To start the local development server with hot-reloading:

```bash
npm run dev
```

The terminal will provide you with a local URL (usually `http://localhost:3000` or `5173`) where you can view your site in the browser.

## 4. Building for Production

When you are ready to deploy your site, you can create a highly optimized production build:

```bash
npm run build
```

This will compile your TypeScript and Vite assets into the `dist/` directory.

To preview the production build locally:

```bash
npm run preview
```

## 5. Helpful Commands

- **`npm run lint`**: Runs ESLint to check for code quality and potential errors.
- **`npm run format`**: Runs Prettier to format your codebase.
- **`npx tsc --noEmit`**: Runs the TypeScript compiler to check for type errors without generating output files.

---
*Happy coding!*
