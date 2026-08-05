import { useWaitingScreen } from '../features/waiting-screen/hooks/useWaitingScreen';
import MobileLayout from '../features/waiting-screen/layouts/MobileLayout';
import BrightDesktopLayout from '../features/waiting-screen/layouts/BrightDesktopLayout';
import DarkDesktopLayout from '../features/waiting-screen/layouts/DarkDesktopLayout';

export default function WaitingScreen() {
  const hook = useWaitingScreen();
  if (hook.isMobile) return <MobileLayout {...hook} />;
  if (hook.view === 'bright') return <BrightDesktopLayout {...hook} />;
  return <DarkDesktopLayout {...hook} />;
}
