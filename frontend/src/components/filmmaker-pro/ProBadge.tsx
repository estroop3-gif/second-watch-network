/**
 * ProBadge — Small "PRO" badge for Filmmaker Pro subscribers.
 * Displayed in People Directory, Collab Board, profile cards, etc.
 */

interface ProBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

const ProBadge = ({ className = '', size = 'sm' }: ProBadgeProps) => {
  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-sm tracking-wider
        bg-gradient-to-r from-amber-500 to-yellow-400 text-charcoal-black
        ${sizeClasses} ${className}`}
    >
      PRO
    </span>
  );
};

export default ProBadge;
