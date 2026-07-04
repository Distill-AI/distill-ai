interface ChevronDownIconProps {
  open: boolean;
}

export function ChevronDownIcon({ open }: ChevronDownIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={`h-3 w-3 text-muted transition-transform ${open ? '' : 'rotate-180'}`}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 4l4 4 4-4" />
    </svg>
  );
}
