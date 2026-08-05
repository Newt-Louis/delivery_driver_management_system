import type { AppNotification } from '../types';

export default function AppNotifications({ notifications }: { notifications: AppNotification[] }) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-14 inset-x-0 z-40 px-3 pt-2 space-y-2 pointer-events-none">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-card-lg pointer-events-auto
            ${notification.type === 'called' ? 'bg-sky-600 text-white' : notification.type === 'upcoming' ? 'bg-amber-500 text-white' : 'bg-thiso-700 text-white'}`}
        >
          {notification.message}
        </div>
      ))}
    </div>
  );
}
