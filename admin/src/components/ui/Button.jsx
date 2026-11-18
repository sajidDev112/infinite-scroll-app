import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/utils.js';

const VARIANTS = {
  primary:
    'bg-accent-500 text-white hover:bg-accent-600 shadow-[0_8px_24px_-10px_rgba(99,102,241,0.8)] disabled:shadow-none',
  secondary: 'bg-ink-750 text-ink-100 border border-ink-600/80 hover:bg-ink-700 hover:border-ink-500',
  ghost: 'text-ink-200 hover:bg-ink-750 hover:text-white',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
  'danger-ghost': 'text-rose-300 hover:bg-rose-500/10 hover:text-rose-200',
};
const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'size-9 rounded-lg justify-center',
  'icon-sm': 'size-8 rounded-lg justify-center',
};

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon: Icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center font-medium whitespace-nowrap transition-all duration-150 select-none',
        'disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
});
