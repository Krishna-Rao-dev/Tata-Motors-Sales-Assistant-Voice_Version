import React from "react";
import { X } from "lucide-react";
import { SpecTable, ComparisonTable, CalculationTable } from "./TableComponents";
import CarCard from "./CarCard";

/**
 * ComponentPanel — renders the generative UI component on the right half
 * Receives the component data from the agentic flow response.
 */
export default function ComponentPanel({ component, onClose }) {
  if (!component) return null;

  const { name, content } = component;
  const isRequired = component.required === true;

  // Don't render if component is explicitly not required
  if (!isRequired || !name || !content) return null;

  const renderComponent = () => {
    switch (name) {
      case "spec_table":
        return (
          <SpecTable
            model={content.columns?.[1]?.label || "Model"}
            rows={
              content.rows?.map((row) => ({
                label: row.feature,
                value: row.value,
              })) || []
            }
          />
        );

      case "comparison_table": {
        const cars = content.columns
          ?.filter((c) => c.key !== "feature")
          .map((c) => c.label) || [];
        const rows =
          content.rows?.map((row) => {
            const values = content.columns
              ?.filter((c) => c.key !== "feature")
              .map((c) => row[c.key]);
            return {
              feature: row.feature,
              values: values || [],
              winner: null,
            };
          }) || [];
        return <ComparisonTable cars={cars} rows={rows} />;
      }

      case "show_calculation":
        return (
          <CalculationTable
            title={content.title}
            inputs={content.inputs || []}
            steps={
              content.steps?.map((s) => ({
                label: s.step,
                result: s.result,
              })) || []
            }
            total={
              content.result
                ? { label: content.result.label, value: content.result.value }
                : null
            }
          />
        );

      case "car_card":
        return <CarCard model={content.model} />;

      default:
        return (
          <div className="comp-panel-fallback">
            <p>Component: {name}</p>
            <pre>{JSON.stringify(content, null, 2)}</pre>
          </div>
        );
    }
  };

  return (
    <div className="comp-panel">
      {/* Close button */}
      <button
        className="comp-panel-close"
        onClick={onClose}
        aria-label="Close component panel"
      >
        <X size={18} />
      </button>

      {/* Component title */}
      <div className="comp-panel-header">
        <div className="comp-panel-badge">
          {name === "spec_table" && "Specifications"}
          {name === "comparison_table" && "Comparison"}
          {name === "show_calculation" && "Calculation"}
          {name === "car_card" && "Car Details"}
        </div>
      </div>

      {/* Rendered component */}
      <div className="comp-panel-body">{renderComponent()}</div>

      <style>{`
        .comp-panel {
          position: relative;
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          padding: 24px 20px;
          overflow-y: auto;
          background: linear-gradient(
            165deg,
            rgba(20, 16, 32, 0.98) 0%,
            rgba(12, 10, 20, 0.99) 50%,
            rgba(8, 6, 14, 1) 100%
          );
          animation: panelContentFadeIn 0.4s ease 0.2s both;
        }

        @keyframes panelContentFadeIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .comp-panel-close {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 10;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.25s ease;
          backdrop-filter: blur(8px);
        }

        .comp-panel-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }

        .comp-panel-header {
          margin-bottom: 20px;
          padding-right: 48px;
        }

        .comp-panel-badge {
          display: inline-block;
          padding: 4px 14px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          background: linear-gradient(
            135deg,
            rgba(139, 92, 246, 0.2),
            rgba(219, 93, 182, 0.15)
          );
          color: rgba(200, 180, 255, 0.9);
          border: 1px solid rgba(139, 92, 246, 0.25);
        }

        .comp-panel-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .comp-panel-fallback {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 16px;
          color: rgba(255, 255, 255, 0.6);
          font-family: monospace;
          font-size: 12px;
          overflow-x: auto;
        }

        .comp-panel-fallback pre {
          white-space: pre-wrap;
          word-break: break-all;
        }

        /* Custom scrollbar for the panel */
        .comp-panel::-webkit-scrollbar {
          width: 5px;
        }

        .comp-panel::-webkit-scrollbar-track {
          background: transparent;
        }

        .comp-panel::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 10px;
        }

        .comp-panel::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.5);
        }
      `}</style>
    </div>
  );
}
