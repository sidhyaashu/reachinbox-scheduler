import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground border border-input',
        peach: 'bg-[#ffedd5] text-[#c2410c] border border-[#fed7aa] font-semibold',
        mint: 'bg-[#e8f5e9] text-[#00873d] font-semibold',
        gray: 'bg-[#f1f5f9] text-[#64748b] font-medium border border-[#e2e8f0]',
        recipientPill: 'bg-[#e8f5e9] text-[#00873d] border border-[#c8e6c9] px-3 py-1 rounded-full text-xs font-medium',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
