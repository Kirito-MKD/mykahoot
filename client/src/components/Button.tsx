import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { unlockAudio } from '../lib/sound';

type Variant = 'default' | 'primary' | 'gold' | 'green' | 'danger' | 'ghost' | 'team' | 'quiet';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconOnly?: boolean;
}

/** Объёмная кнопка: подложка снизу на 4px темнее, при нажатии уезжает вниз */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'default', size = 'md', icon, iconOnly, className, children, onClick, type = 'button', ...rest },
  ref,
) {
  const cls = [
    'btn',
    variant !== 'default' ? `btn-${variant}` : '',
    size !== 'md' ? `btn-${size}` : '',
    iconOnly ? 'btn-icon' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      onClick={(e) => {
        unlockAudio();
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});
