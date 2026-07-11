import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, active } from '../db';
import { labelMap } from '../lib/numbering';
import { guidePicks, getTodayEnergy, setTodayEnergy, clearTodayEnergy, type Energy } from '../lib/guide';
import { colourClass } from '../components/ui';
import { IconHeart } from '../components/icons';

/**
 * Guide Me: she says how she's feeling, the app picks what fits.
 * Built for the low days — something small that still counts.
 */

const ENERGY_CARDS: { level: Energy; title: string; blurb: string }[] = [
  { level: 'low', title: 'Taking it gently', blurb: 'Not much in the tank today — something light.' },
  { level: 'medium', title: 'Somewhere in the middle', blurb: 'Up for a normal sort of day.' },
  { level: 'high', title: 'Full of beans', blurb: 'Ready to get stuck into anything.' }
];

const HEADINGS: Record<Energy, { lead: string; sub: string }> = {
  low: {
    lead: 'Gentle day, then.',
    sub: "Here's something small that still counts. One is plenty — the rest will keep."
  },
  medium: { lead: "Here's what fits today.", sub: 'The most useful things first, nothing too heavy.' },
  high: { lead: "Plenty of energy — let's use it.", sub: 'The big and important things first.' }
};

const BASE_COUNT = 8; // two most-important + six more
const MORE_STEP = 6;

export default function GuideMe() {
  const navigate = useNavigate();
  const [energy, setEnergy] = useState<Energy | null>(() => getTodayEnergy());
  const [shown, setShown] = useState(BASE_COUNT);

  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const labels = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of active(projects)) {
      for (const [id, label] of labelMap(active(tasks).filter((t) => t.projectId === p.id))) m.set(id, label);
    }
    return m;
  }, [projects, tasks]);

  const picks = useMemo(
    () => (energy ? guidePicks(tasks, projectsById, energy) : []),
    [tasks, projectsById, energy]
  );

  function choose(level: Energy) {
    setTodayEnergy(level);
    setEnergy(level);
    setShown(BASE_COUNT);
  }
  function changeMind() {
    clearTodayEnergy();
    setEnergy(null);
    setShown(BASE_COUNT);
  }

  if (!energy) {
    return (
      <div className="screen">
        <header className="topbar">
          <h1 className="topbar-title">Guide Me</h1>
          <div className="spacer" />
        </header>
        <div className="greeting">
          <h1>How are you feeling today, Jillian?</h1>
          <div className="date">Be honest — the list will fit around you, not the other way round.</div>
        </div>
        {ENERGY_CARDS.map((c) => (
          <button key={c.level} className={`energy-card card energy-${c.level}`} onClick={() => choose(c.level)}>
            <span className="ebadge" aria-hidden>
              <IconHeart size={20} />
            </span>
            <span className="ebody">
              <span className="etitle">{c.title}</span>
              <span className="eblurb">{c.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  const heading = HEADINGS[energy];
  const heroes = picks.slice(0, 2);
  const rest = picks.slice(2, shown);
  const remaining = picks.length - Math.min(shown, picks.length);

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="topbar-title">Guide Me</h1>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={changeMind}>
          Feeling different?
        </button>
      </header>

      <div className="greeting">
        <h1>{heading.lead}</h1>
        <div className="date">{heading.sub}</div>
      </div>

      {heroes.length === 0 && (
        <div className="card nothing-today">
          <div className="big">
            {energy === 'low'
              ? 'Nothing gentle on the list right now.'
              : 'Nothing on the list fits just now.'}
          </div>
          {energy === 'low'
            ? 'That might be your answer for today — rest is allowed. Or mark a small task as Gentle and it will show up here.'
            : 'Add a task or two and Guide Me will sort them for you.'}
        </div>
      )}

      {heroes.length > 0 && (
        <>
          <div className="feed-head">{heroes.length === 1 ? 'Start with this' : 'Most important — pick either'}</div>
          {heroes.map(({ task, project, why, overdue }) => (
            <button
              key={task.id}
              className={`hero-pick card ${colourClass(project.colour)}`}
              onClick={() => navigate(`/task/${task.id}`)}
            >
              <span className="hname">
                {labels.get(task.id) && <span className="stepno">{labels.get(task.id)}</span>}
                {task.name || 'Untitled task'}
              </span>
              <span className={`hwhy${overdue ? ' overdue' : ''}`}>
                {project.name} · {why}
              </span>
            </button>
          ))}
        </>
      )}

      {rest.length > 0 && (
        <>
          <div className="feed-head">Also fits today</div>
          {rest.map(({ task, project, why, overdue }) => (
            <button
              key={task.id}
              className={`feed-item card ${colourClass(project.colour)}`}
              onClick={() => navigate(`/task/${task.id}`)}
            >
              <span className="dot" aria-hidden />
              {labels.get(task.id) && <span className="stepno">{labels.get(task.id)}</span>}
              <span className="body">
                <span className="name">{task.name || 'Untitled task'}</span>
                <span className={`why${overdue ? ' overdue' : ''}`}>
                  {project.name} · {why}
                </span>
              </span>
            </button>
          ))}
        </>
      )}

      {remaining > 0 && (
        <button className="btn btn-tint btn-block show-more" onClick={() => setShown((s) => s + MORE_STEP)}>
          Show more ({remaining} more fit today)
        </button>
      )}

      {heroes.length > 0 && energy === 'low' && (
        <p className="gentle-note">
          Whatever you finish today counts double on a low day. Even one tick is a good day's work.
        </p>
      )}
    </div>
  );
}
