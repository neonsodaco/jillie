import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, active, type Project, type Update } from '../db';
import { NewProjectSheet } from '../components/NewProjectSheet';
import { IconPlus } from '../components/icons';
import { greeting, todayWords } from '../lib/dates';
import { labelMap, progress } from '../lib/numbering';
import { buildFeed } from '../lib/feed';
import { recentWins, winsLine } from '../lib/encourage';
import { buildBackup, shareBackup, recordBackupDone, shouldNudgeBackup, snoozeBackupNudge } from '../lib/backup';
import { ProgressBar, Sheet, SheetItem, colourClass } from '../components/ui';
import { IconHelp, IconDots, IconArchive, IconShare, IconList } from '../components/icons';
import { useUndo } from '../lib/undo';

const NAME = 'Jillian';

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useUndo();
  const [menuOpen, setMenuOpen] = useState(false);
  const [nudgeHidden, setNudgeHidden] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedExpanded, setFeedExpanded] = useState(false);

  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const updates = useLiveQuery(() => db.updates.toArray(), []) ?? [];

  const activeProjects = active(projects);
  const projectsById = useMemo(() => new Map<string, Project>(projects.map((p) => [p.id, p])), [projects]);

  const labels = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of activeProjects) {
      const pt = active(tasks).filter((t) => t.projectId === p.id);
      for (const [id, label] of labelMap(pt)) m.set(id, label);
    }
    return m;
  }, [activeProjects, tasks]);

  const latestUpdate = useMemo(() => {
    const m = new Map<string, Update>();
    for (const u of updates) {
      const prev = m.get(u.taskId);
      if (!prev || u.createdAt > prev.createdAt) m.set(u.taskId, u);
    }
    return m;
  }, [updates]);

  const feed = useMemo(
    () => buildFeed(tasks, projectsById, labels, latestUpdate),
    [tasks, projectsById, labels, latestUpdate]
  );

  // one flat list in urgency order: up to 8 shown, the top two highlighted
  const flatFeed = useMemo(
    () => feed.flatMap((g) => g.items.map((item) => ({ ...item, heading: g.heading }))),
    [feed]
  );
  const visibleFeed = feedExpanded ? flatFeed : flatFeed.slice(0, 8);
  const hiddenCount = flatFeed.length - visibleFeed.length;

  const showNudge = !nudgeHidden && shouldNudgeBackup(activeProjects.length > 0);

  async function saveBackup() {
    setMenuOpen(false);
    try {
      const file = await buildBackup();
      const how = await shareBackup(file);
      recordBackupDone();
      setNudgeHidden(true);
      toast(how === 'shared' ? 'Backup shared — pick Save to Drive.' : 'Backup saved to your downloads.');
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') toast('That backup did not save — try again.');
    }
  }

  return (
    <div className="screen">
      <header className="topbar">
        <div className="spacer" />
        <Link to="/help" className="iconbtn" aria-label="Help — how this works">
          <IconHelp />
        </Link>
        <button className="iconbtn" aria-label="More options" onClick={() => setMenuOpen(true)}>
          <IconDots />
        </button>
      </header>

      <div className="greeting">
        <h1>{greeting(NAME)}</h1>
        <div className="date">{todayWords()}</div>
        {recentWins(tasks) > 0 && <div className="wins">{winsLine(recentWins(tasks))}</div>}
      </div>

      {flatFeed.length === 0 ? (
        <div className="card nothing-today">
          <div className="big">Nothing needs you today, {NAME}.</div>
          Lovely.
        </div>
      ) : (
        <>
          {visibleFeed.map((item, i) => {
            const { task, project, label, why, overdue, heading } = item;
            const showHeading = i === 0 || heading !== visibleFeed[i - 1].heading;
            const isTop = i < 2;
            return (
              <section key={task.id}>
                {showHeading && <div className="feed-head">{heading}</div>}
                {isTop ? (
                  <button
                    className={`hero-pick card ${colourClass(project.colour)}`}
                    onClick={() => navigate(`/task/${task.id}`)}
                  >
                    <span className="hname">
                      {label && <span className="stepno">{label}</span>}
                      {task.name}
                    </span>
                    <span className={`hwhy${overdue ? ' overdue' : ''}`}>
                      {project.name} · {why}
                    </span>
                  </button>
                ) : (
                  <button
                    className={`feed-item card ${colourClass(project.colour)}`}
                    onClick={() => navigate(`/task/${task.id}`)}
                  >
                    <span className="dot" aria-hidden />
                    {label && <span className="stepno">{label}</span>}
                    <span className="body">
                      <span className="name">{task.name}</span>
                      <span className={`why${overdue ? ' overdue' : ''}`}>
                        {project.name} · {why}
                      </span>
                    </span>
                  </button>
                )}
              </section>
            );
          })}
          {hiddenCount > 0 && (
            <button className="btn btn-tint btn-block show-more" onClick={() => setFeedExpanded(true)}>
              Show more ({hiddenCount} more)
            </button>
          )}
        </>
      )}

      {activeProjects.length > 0 && (
        <>
          <div className="feed-head">Your projects</div>
          <div className="chip-row">
            {activeProjects.map((p) => {
              const pt = active(tasks).filter((t) => t.projectId === p.id);
              const { done, total } = progress(pt);
              return (
                <button
                  key={p.id}
                  className={`proj-chip ${colourClass(p.colour)}`}
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <div className="pname">{p.name}</div>
                  <ProgressBar done={done} total={total} />
                  <div className="progress-words">
                    {total === 0 ? 'No tasks yet' : `${done} of ${total} done`}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {activeProjects.length === 0 && flatFeed.length === 0 && (
        <div className="empty-note">
          <div className="big">No projects yet, {NAME}.</div>
          What's first? Start one below.
        </div>
      )}

      <button className="btn btn-tint btn-block new-proj-inline" onClick={() => setCreating(true)}>
        <IconPlus size={16} /> New project
      </button>

      {creating && (
        <NewProjectSheet
          onClose={() => setCreating(false)}
          onCreate={(name, colour) => {
            // close first, then save — the popup never lingers
            setCreating(false);
            const id = uid();
            db.projects
              .add({ id, name, colour, archivedAt: null, deletedAt: null, createdAt: Date.now() })
              .then(() => navigate(`/project/${id}`))
              .catch(() => toast("That didn't save — try again."));
          }}
        />
      )}

      {showNudge && (
        <div className="card nudge">
          <div className="body">
            <strong>It's been a while since your last backup.</strong>
            <span>Want to save one? Takes two taps.</span>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => {
              snoozeBackupNudge();
              setNudgeHidden(true);
            }}
          >
            Not now
          </button>
          <button className="btn btn-primary" onClick={saveBackup}>
            Save
          </button>
        </div>
      )}

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} label="More options">
          <SheetItem
            icon={<IconArchive />}
            label="Archive — things you've put away"
            onClick={() => {
              setMenuOpen(false);
              navigate('/archive');
            }}
          />
          <SheetItem icon={<IconShare />} label="Save a backup" onClick={saveBackup} />
          <SheetItem
            icon={<IconList />}
            label="How this works"
            onClick={() => {
              setMenuOpen(false);
              navigate('/help');
            }}
          />
        </Sheet>
      )}
    </div>
  );
}
