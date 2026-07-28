type ActivityIllustrationProps = {
  type: "sitting" | "standing" | "walking" | "manual" | "caregiving" | "varied";
  selected?: boolean;
};

function Person({ x = 0, shirt = "#2B6CBF" }: { x?: number; shirt?: string }) {
  return (
    <g className="registration-illustration-person" transform={`translate(${x} 0)`}>
      <circle cx="62" cy="25" r="10" fill="#B97150" />
      <path d="M51 37q12-7 23 1l-2 28H53z" fill={shirt} />
      <path d="M56 64 50 86M69 64l10 22" stroke="#1D3E66" strokeWidth="7" strokeLinecap="round" />
      <path d="M54 44 38 56M71 44l18 10" stroke="#B97150" strokeWidth="7" strokeLinecap="round" />
    </g>
  );
}

export function RegistrationActivityIllustration({ type, selected = false }: ActivityIllustrationProps) {
  const className = `h-full w-full ${selected ? "registration-illustration-selected" : ""}`;

  if (type === "sitting") {
    return (
      <svg className={className} viewBox="0 0 160 90" aria-hidden="true">
        <rect width="160" height="90" fill="#E6F2FF" />
        <rect x="91" y="48" width="57" height="6" rx="2" fill="#3E78BA" />
        <rect x="119" y="21" width="25" height="25" rx="2" fill="#1D3E66" />
        <rect x="122" y="24" width="19" height="16" fill="#8BC5FF" />
        <path d="M42 66h34v5H42m6 0v17m26-17v17" stroke="#3E5F84" strokeWidth="4" />
        <Person />
      </svg>
    );
  }

  if (type === "standing") {
    return (
      <svg className={className} viewBox="0 0 160 90" aria-hidden="true">
        <rect width="160" height="90" fill="#ECF5FF" />
        <rect x="93" y="51" width="58" height="7" rx="2" fill="#4C84C1" />
        <rect x="105" y="38" width="25" height="13" rx="2" fill="#9ED3FF" />
        <Person shirt="#3C74B7" />
      </svg>
    );
  }

  if (type === "walking") {
    return (
      <svg className={className} viewBox="0 0 160 90" aria-hidden="true">
        <rect width="160" height="90" fill="#E9F2FF" />
        <path d="M0 77h160" stroke="#9EBDE1" strokeWidth="3" strokeDasharray="10 6" />
        <g transform="rotate(-5 70 55)">
          <Person x={12} shirt="#3E6FAA" />
        </g>
      </svg>
    );
  }

  if (type === "manual") {
    return (
      <svg className={className} viewBox="0 0 160 90" aria-hidden="true">
        <rect width="160" height="90" fill="#EAF4FF" />
        <Person x={-12} shirt="#3B6699" />
        <rect x="80" y="42" width="43" height="34" rx="3" fill="#5A92D1" />
        <path d="M80 55h43" stroke="#2D5F98" strokeWidth="3" />
      </svg>
    );
  }

  if (type === "caregiving") {
    return (
      <svg className={className} viewBox="0 0 160 90" aria-hidden="true">
        <rect width="160" height="90" fill="#E8F3FF" />
        <Person x={-8} shirt="#497FB9" />
        <path d="m95 42 12 40m-20-8 34-10" stroke="#35689F" strokeWidth="5" strokeLinecap="round" />
        <path d="M112 64q10 3 19 0l-3 18h-13z" fill="#9ED2FF" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 160 90" aria-hidden="true">
      <rect width="160" height="90" fill="#E9F2FF" />
      <circle cx="31" cy="25" r="16" fill="#BFD9F7" />
      <path d="M23 25h16m-8-8v16" stroke="#2F5E99" strokeWidth="4" />
      <circle cx="129" cy="25" r="16" fill="#9CCAF5" />
      <path d="M121 25h16" stroke="#3E74B2" strokeWidth="4" />
      <Person x={18} shirt="#4C7EB7" />
    </svg>
  );
}