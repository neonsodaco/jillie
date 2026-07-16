import { useState } from 'react';
import { type ColourKey } from '../db';
import { Sheet, ColourPicker, FieldLabel } from './ui';

/** Two questions only: name and colour. Used from Today and Projects. */
export function NewProjectSheet({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (name: string, colour: ColourKey, customColour: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [colour, setColour] = useState<ColourKey>('terracotta');
  const [customColour, setCustomColour] = useState<string | null>(null);
  return (
    <Sheet onClose={onClose} label="New project">
      <h2>New project</h2>
      <div className="field">
        <FieldLabel text="Project name" help="What are you working on? 'Laundry reno', 'Front garden' — whatever you'd call it." />
        <input
          type="text"
          value={name}
          placeholder="e.g. Laundry reno"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onCreate(name.trim(), colour, customColour)}
        />
      </div>
      <div className="field">
        <FieldLabel
          text="Colour"
          help="Every project gets its own colour, so you can spot it at a glance everywhere in the app. The rainbow swatch lets you pick any colour you like."
        />
        <ColourPicker
          value={colour}
          custom={customColour}
          onChange={(c, custom) => {
            setColour(c);
            setCustomColour(custom);
          }}
        />
      </div>
      <button
        className="btn btn-primary btn-block"
        disabled={!name.trim()}
        onClick={() => onCreate(name.trim(), colour, customColour)}
      >
        Create project
      </button>
    </Sheet>
  );
}
