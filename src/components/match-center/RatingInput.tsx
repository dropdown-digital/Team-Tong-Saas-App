export function RatingInput({
  name,
  value,
  onChange,
}: {
  name: string;
  value?: number;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="ballot-scale">
      <legend>
        How was their match?{" "}
        <strong>{value?.toFixed(1) || "Choose a rating"}</strong>
      </legend>
      <div>
        {Array.from({ length: 19 }, (_, i) => 1 + i * 0.5).map((score) => (
          <button
            key={score}
            type="button"
            aria-label={`Rate ${name} ${score.toFixed(1)} out of 10`}
            aria-pressed={value === score}
            onClick={() => onChange(score)}
          >
            {score.toFixed(1)}
          </button>
        ))}
      </div>
      <p>
        1 · Tough game <span>5 · Steady</span> 10 · Exceptional
      </p>
    </fieldset>
  );
}
