import { useState } from 'react';
import { type ColourKey } from '../db';
import { Sheet, ColourPicker, FieldLabel } from './ui';

/** Two questions only: name and colour. Used from Today and Projects. */
export function NewProjectSheet({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (name: string, colour: ColourKey) => void;
}) {
  const [name, setName] = useState('');
  const [colour, setColour] = useState<ColourKey>('terracotta');
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
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onCreate(name.trim(), colour)}
        />
      </div>
      <div className="field">
        <FieldLabel text="Colour" help="Every project gets its own colour, so you can spot it at a glance everywhere in the app." />
        <ColourPicker value={colour} onChange={setColour} />
      </div>
      <button className="btn btn-primary btn-block" disabled={!name.trim()} onClick={() => onCreate(name.trim(), colour)}>
        Create project
      </button>
    </Sheet>
  );
}
