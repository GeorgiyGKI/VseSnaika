import React from "react";

import { voiceCategories, voiceOptions } from "@/lib/constants";

type VoiceSelectorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const VoiceSelector = ({ value, onChange, disabled = false }: VoiceSelectorProps) => {
  return (
    <div className="voice-selector-options">
      {Object.entries(voiceCategories).map(([category, keys]) => (
        <div key={category} className="flex flex-1 flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#3d485e]">
            {category === "female" ? "Женский" : "Мужской"}
          </p>
          {keys.map((key) => {
            const option = voiceOptions[key as keyof typeof voiceOptions];
            const isSelected = value === key;
            return (
              <button
                key={key}
                type="button"
                className={`voice-selector-option ${
                  isSelected ? "voice-selector-option-selected" : "voice-selector-option-default"
                } ${disabled ? "voice-selector-option-disabled" : ""}`}
                onClick={() => onChange(key)}
                disabled={disabled}
              >
                <div className="text-left">
                  <p className="font-semibold text-[#212a3b]">{option.name}</p>
                  <p className="text-sm text-[#3d485e]">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default VoiceSelector;
