import React from 'react';
import { OrderStatus } from '@/types/order';
import { ORDER_STATUS_CONFIG, ORDER_TIMELINE_STEPS } from '@/utils/constants';
import { Check, Clock, AlertCircle } from 'lucide-react';

interface StepperProps {
  currentStatus: OrderStatus;
}

export const Stepper: React.FC<StepperProps> = ({ currentStatus }) => {
  if (currentStatus === 'cancelled') {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-3">
        <AlertCircle className="w-6 h-6 shrink-0 text-rose-600" />
        <div>
          <p className="font-semibold text-sm">Pesanan Dibatalkan</p>
          <p className="text-xs text-rose-600">Pesanan ini tidak dapat dilacak lagi.</p>
        </div>
      </div>
    );
  }

  const currentStepIndex = ORDER_STATUS_CONFIG[currentStatus]?.stepIndex ?? 0;

  return (
    <div className="w-full py-4">
      {/* Desktop Horizontal View */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Background Connecting Line */}
        <div className="absolute top-5 left-8 right-8 h-1 bg-slate-100 -z-0 rounded-full" />
        {/* Active Connecting Line */}
        <div
          className="absolute top-5 left-8 h-1 bg-teal-500 -z-0 rounded-full transition-all duration-500"
          style={{
            width: `${(currentStepIndex / (ORDER_TIMELINE_STEPS.length - 1)) * 90}%`,
          }}
        />

        {ORDER_TIMELINE_STEPS.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <div key={step.key} className="flex flex-col items-center z-10 w-24 text-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                  isCompleted
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 ring-4 ring-white'
                    : isCurrent
                    ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse shadow-md shadow-amber-500/30'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : isCurrent ? (
                  <Clock className="w-5 h-5" />
                ) : (
                  idx + 1
                )}
              </div>
              <p
                className={`mt-2.5 text-xs font-semibold leading-tight ${
                  isCurrent
                    ? 'text-amber-600 font-bold'
                    : isCompleted
                    ? 'text-teal-700'
                    : 'text-slate-400'
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Mobile Vertical View */}
      <div className="md:hidden space-y-4 relative pl-4 border-l-2 border-slate-100 ml-3">
        {ORDER_TIMELINE_STEPS.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <div key={step.key} className="relative flex items-start gap-3.5">
              <div
                className={`absolute -left-[27px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isCompleted
                    ? 'bg-teal-600 text-white'
                    : isCurrent
                    ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <div>
                <p
                  className={`text-sm font-semibold ${
                    isCurrent
                      ? 'text-amber-600 font-bold'
                      : isCompleted
                      ? 'text-teal-800'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-xs text-amber-600 font-medium mt-0.5">
                    {ORDER_STATUS_CONFIG[currentStatus]?.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
