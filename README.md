# sumday

⏱️ Personal time tracker & focus trigger — minimalist React + TS app with daily reset and 8-hour tracking

## Features

### Core Timer
- **출근/외출/재개/퇴근** workflow for work day tracking
- Real-time focus time accumulation (excludes paused time)
- Persistent state across browser sessions, tabs, and sleep
- 8-hour work milestone detection (switches to "퇴근" after 8 hours of focus)

### Smart Work Flow
- **출근 (Start Work)**: Begin tracking focus time
- **외출 (Go Out)**: Pause timer temporarily  
- **재개 (Resume)**: Continue from where you left off
- **퇴근 (End Work)**: Stop for the day (after 8+ hours or manual)
- **Re-entry after 퇴근**: Maintains 8+ hour state until midnight

### Midnight Reset
- Automatic reset at 00:00 (local time)
- Saves current day's focus time to history
- Auto-logout if timer is running at midnight
- Clean slate for new day

### Notifications
- **5-minute warning** before midnight (only when timer is running)
- Audio beep alert
- Dismissible notification banner with X button

### Data Management
- **Local Storage**: All data stored locally in browser
- **7-day history**: Automatic cleanup of old records
- **Last Focus Time**: Shows most recent non-zero focus session
- **Persistent state**: Survives browser restarts and system sleep

## Technical Stack

- **React 18** with TypeScript
- **Vite** for development and build
- **CSS3** with backdrop filters and modern styling
- **No external dependencies** - pure React implementation

## Key Components

- `App.tsx` - Main timer logic and state management
- `TimeDisplay.tsx` - Focus time display and last session info
- `PrimaryButton.tsx` - Dynamic button (출근/외출/재개/퇴근)
- `MidnightBanner.tsx` - Midnight warning notification
- `PauseModal.tsx` - "외출" status indicator

## State Management

Uses React hooks for state with localStorage persistence:
- `focusedMs` - Current day's accumulated focus time
- `sinceStartMs` - Time since work started (includes breaks)
- `state` - Current timer state ('idle' | 'running' | 'paused')
- `history` - 7-day focus time history

## Background Image

Place your background image at `/public/workshop.png` for the glassmorphism effect.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Built with ❤️ as a personal productivity tracker & focus trigger
