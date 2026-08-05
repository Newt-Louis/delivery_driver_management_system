import { DRIVER_GUIDE_STEPS } from '../constants';

export default function DriverGuideCard() {
  return (
    <div className="bg-thiso-800 rounded-2xl p-5 text-white/80 text-sm space-y-2.5">
      <div className="text-white font-black text-base mb-3">📋 Hướng dẫn</div>
      {DRIVER_GUIDE_STEPS.map(([step, text]) => (
        <div key={step} className="flex items-start gap-3">
          <span className="w-5 h-5 bg-white/20 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
            {step}
          </span>
          <span className="text-white/70 text-xs">{text}</span>
        </div>
      ))}
    </div>
  );
}
