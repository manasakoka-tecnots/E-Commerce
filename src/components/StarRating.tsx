"use client";

type StarRatingProps = {
  rating: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
};

const sizeMap = { sm: 14, md: 20, lg: 24 };

function StarIcon({
  filled,
  half,
  pixelSize,
  onClick,
  onMouseEnter,
  className,
}: {
  filled: boolean;
  half?: boolean;
  pixelSize: number;
  onClick?: () => void;
  onMouseEnter?: () => void;
  className?: string;
}) {
  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={className}
      style={{ cursor: onClick ? "pointer" : "default", flexShrink: 0 }}
    >
      {half ? (
        <>
          <defs>
            <clipPath id={`half-left-${pixelSize}`}>
              <rect x="0" y="0" width="12" height="24" />
            </clipPath>
            <clipPath id={`half-right-${pixelSize}`}>
              <rect x="12" y="0" width="12" height="24" />
            </clipPath>
          </defs>
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="#FBBF24"
            clipPath={`url(#half-left-${pixelSize})`}
          />
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="#D1D5DB"
            clipPath={`url(#half-right-${pixelSize})`}
          />
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="none"
            stroke="#D1D5DB"
            strokeWidth="0.5"
          />
        </>
      ) : (
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={filled ? "#FBBF24" : "#D1D5DB"}
        />
      )}
    </svg>
  );
}

export default function StarRating({
  rating,
  size = "md",
  interactive = false,
  onChange,
}: StarRatingProps) {
  const pixelSize = sizeMap[size];

  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = rating >= star;
        const half = !filled && rating >= star - 0.5;
        return (
          <StarIcon
            key={star}
            filled={filled}
            half={half}
            pixelSize={pixelSize}
            onClick={interactive && onChange ? () => onChange(star) : undefined}
            className={interactive ? "hover:scale-110 transition-transform" : undefined}
          />
        );
      })}
    </div>
  );
}
