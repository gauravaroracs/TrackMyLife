# Track My Life — Bird's Eye View

A beautiful life tracking application built with Next.js that helps you visualize your progress across different goals with interactive timeline rails.

## Features

- 🎯 **Interactive Timeline Rails** - Drag human markers to log your progress
- ⏰ **Live Countdown Timers** - See how much life is left until your 90th birthday
- 📊 **New Year Counter** - Countdown to the next New Year
- 📈 **Power of Habits Chart** - Visualize the 1% better per day principle
- 💾 **Local Storage** - Your progress is automatically saved
- 🎨 **Beautiful UI** - Modern design with Tailwind CSS

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Customization

Edit `src/app/page.tsx` to customize:
- Your birthdate (line 13: `BIRTHDATE`)
- Target age (line 14: `TARGET_AGE`)
- Track goals and sections

## Tech Stack

- [Next.js](https://nextjs.org) 16 - React framework
- [React](https://react.dev) 19 - UI library
- [TypeScript](https://www.typescriptlang.org) - Type safety
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Recharts](https://recharts.org) - Chart visualizations
- [Lucide React](https://lucide.dev) - Icons

## Deploy

The easiest way to deploy is using [Vercel](https://vercel.com):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/gauravaroracs/TrackMyLife)

## License

MIT
