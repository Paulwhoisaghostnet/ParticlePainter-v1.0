import * as Slider from "@radix-ui/react-slider";

export function SliderRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  tooltip?: string;
}) {
  const { label, value, min, max, step, onChange, tooltip } = props;

  return (
    <div className="row" title={tooltip}>
      <div style={{ display: "grid", gap: 6 }}>
        <div className="small">{label}</div>
        <Slider.Root
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => onChange(v[0] ?? value)}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            userSelect: "none",
            touchAction: "none",
            height: 16
          }}
        >
          <Slider.Track
            style={{
              position: "relative",
              flexGrow: 1,
              height: 4,
              borderRadius: 999,
              background: "rgba(255,255,255,0.10)"
            }}
          >
            <Slider.Range
              style={{
                position: "absolute",
                height: "100%",
                borderRadius: 999,
                background: "rgba(124,58,237,0.65)"
              }}
            />
          </Slider.Track>
          <Slider.Thumb
            style={{
              display: "block",
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(0,0,0,0.25)"
            }}
          />
        </Slider.Root>
      </div>

      <input
        type="number"
        className="input inputSm"
        style={{ width: 60, textAlign: 'right', fontFamily: 'monospace' }}
        value={parseFloat(value.toFixed(3))}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) onChange(val);
        }}
        onKeyDown={(e) => e.stopPropagation()} // Prevent triggering global shortcuts
      />
    </div>
  );
}
