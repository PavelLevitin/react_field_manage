'use client';

import { useState, useEffect, useCallback } from 'react';

const BASE_PATH = '/fields';
const TIME_SLOTS = ['16:00 - 17:45', '18:00 - 19:45', '20:00 - 21:45'];
const REFRESH_INTERVAL = 30_000; // 30 seconds

type DateSchedule = Record<string, string[][]>;
type ViewMode = 'today' | 'choose' | 'weekly';

function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

function getWeekDay(date: string): string {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return days[new Date(date).getDay()];
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekDays(): string[] {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function formatShortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

// Daily view table - used for today & choose modes
function ScheduleTable({ schedule, fields }: { schedule: DateSchedule; fields: string[] }) {
  return (
    <div className="flex-1 min-h-0 overflow-auto sm:overflow-hidden">
      {/* Mobile: card layout */}
      <div className="sm:hidden flex flex-col gap-3">
        {TIME_SLOTS.map((time, slotIdx) => (
          <div key={slotIdx} className="rounded-lg overflow-hidden" style={{ border: '1px solid #333' }}>
            <div className="px-3 py-2 text-sm font-bold text-center" style={{ backgroundColor: '#1a1a1a', color: '#fcb900' }}>
              {time}
            </div>
            <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: '#333' }}>
              {fields.map(field => {
                const teams = schedule[field]?.[slotIdx] ?? [];
                return (
                  <div key={field} className="p-2 flex flex-col gap-1" style={{ backgroundColor: '#111' }}>
                    <div className="text-xs font-bold text-center rounded px-1 py-0.5" style={{ backgroundColor: '#cf2e2e', color: '#fff' }}>
                      {field}
                    </div>
                    {teams.map((team, i) => (
                      <div
                        key={i}
                        className="text-xs font-semibold text-center rounded px-1 py-0.5"
                        style={{ backgroundColor: '#32373c', color: '#fff' }}
                      >
                        {team}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table layout */}
      <table className="hidden sm:table w-full h-full border-collapse text-center">
        <thead>
          <tr>
            <th className="p-2 text-base font-bold border min-w-[130px]" style={{ color: '#fff', borderColor: '#333', backgroundColor: '#1a1a1a' }}>
              שעה
            </th>
            {fields.map(field => (
              <th key={field} className="p-2 text-base font-bold border min-w-[150px]" style={{ color: '#fff', borderColor: '#333', backgroundColor: '#cf2e2e' }}>
                {field}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map((time, slotIdx) => (
            <tr key={slotIdx} style={{ height: `${100 / TIME_SLOTS.length}%` }}>
              <td className="p-2 text-sm font-semibold border whitespace-nowrap" style={{ color: '#fcb900', borderColor: '#333', backgroundColor: '#1a1a1a' }}>
                {time}
              </td>
              {fields.map(field => {
                const teams = schedule[field]?.[slotIdx] ?? [];
                return (
                  <td key={field} className="p-2 border align-middle" style={{ borderColor: '#333', backgroundColor: '#111' }}>
                    <div className="flex flex-col gap-1.5">
                      {teams.map((team, i) => (
                        <span
                          key={i}
                          className="inline-block text-sm font-semibold rounded-lg px-2 py-1"
                          style={{ backgroundColor: '#32373c', color: '#fff' }}
                        >
                          {team}
                        </span>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const VIEW_LABELS: Record<ViewMode, string> = {
  today: 'היום',
  choose: 'בחר יום',
  weekly: 'שבועי',
};

const VIEW_TITLES: Record<ViewMode, string> = {
  today: 'לוח אימונים - היום',
  choose: 'לוח אימונים - יום נבחר',
  weekly: 'לוח אימונים שבועי',
};

export default function BroadcastPage() {
  const [schedules, setSchedules] = useState<Record<string, DateSchedule>>({});
  const [fields, setFields] = useState<string[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [chosenDate, setChosenDate] = useState(getToday);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [schedRes, fieldsRes] = await Promise.all([
        fetch(`${BASE_PATH}/api/schedules`),
        fetch(`${BASE_PATH}/api/fields`),
      ]);
      const schedData = await schedRes.json();
      const fieldsData = await fieldsRes.json();
      if (schedData.schedules) setSchedules(schedData.schedules);
      if (Array.isArray(fieldsData.fields)) setFields(fieldsData.fields);
      setLastUpdate(new Date().toLocaleTimeString('he-IL'));
    } catch {
      // silently retry on next interval
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const closePage = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    window.close();
    window.history.back();
  };

  const today = getToday();
  const weekDays = getWeekDays();

  const displayDate = viewMode === 'today' ? today : chosenDate;
  const displaySchedule = schedules[displayDate];
  const hasDisplayData = displaySchedule && Object.values(displaySchedule).some(slots => slots.some(s => s.length > 0));

  return (
    <div className="h-dvh max-h-dvh flex flex-col text-white p-2 sm:p-4 overflow-hidden" style={{ backgroundColor: '#000' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 mb-2 shrink-0">
        {/* Title - centered on desktop, top on mobile */}
        <h1 className="text-lg sm:text-2xl font-bold sm:absolute sm:left-1/2 sm:-translate-x-1/2 order-1" style={{ color: '#fff' }}>{VIEW_TITLES[viewMode]}</h1>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center order-2 sm:ml-auto">
          {/* Toggle */}
          <div className="flex items-center rounded-full p-0.5 sm:p-1" style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
            {(['today', 'choose', 'weekly'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300"
                style={viewMode === mode
                  ? { backgroundColor: '#cf2e2e', color: '#fff', boxShadow: '0 4px 15px rgba(207,46,46,0.3)' }
                  : { color: '#abb8c3' }
                }
              >
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>

          {viewMode === 'choose' && (
            <input
              type="date"
              value={chosenDate}
              onChange={e => setChosenDate(e.target.value)}
              className="rounded-full px-3 py-1.5 text-xs sm:text-sm text-white focus:outline-none [color-scheme:dark]"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
            />
          )}

          <div className="hidden sm:block text-sm" style={{ color: '#abb8c3' }}>
            עדכון אחרון: {lastUpdate}
          </div>

          {/* Fullscreen toggle - hidden on mobile */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full transition-all text-base"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#abb8c3' }}
            title={isFullscreen ? 'צא ממסך מלא' : 'מסך מלא'}
          >
            {isFullscreen ? '⊡' : '⛶'}
          </button>

          {/* Close button */}
          <button
            onClick={closePage}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-all text-base sm:text-lg"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#abb8c3' }}
            title="סגור"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Sub-header */}
      {(viewMode === 'today' || viewMode === 'choose') && (
        <h2 className="text-base sm:text-lg font-bold mb-1 sm:mb-2 pb-1 shrink-0" style={{ color: '#cf2e2e', borderBottom: '1px solid #333' }}>
          {viewMode === 'today' ? 'היום' : `יום ${getWeekDay(displayDate)}`} - {formatDate(displayDate)}
        </h2>
      )}
      {viewMode === 'weekly' && (
        <h2 className="text-base sm:text-lg font-bold mb-1 sm:mb-2 pb-1 shrink-0" style={{ color: '#cf2e2e', borderBottom: '1px solid #333' }}>
          {formatDate(weekDays[0])} - {formatDate(weekDays[5])}
        </h2>
      )}

      {/* Content */}
      {(viewMode === 'today' || viewMode === 'choose') && (
        <>
          {hasDisplayData ? (
            <ScheduleTable schedule={displaySchedule} fields={fields} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-lg sm:text-2xl text-center" style={{ color: '#abb8c3' }}>
                אין אימונים מתוזמנים ל{formatDate(displayDate)}
              </p>
            </div>
          )}
        </>
      )}

      {viewMode === 'weekly' && (
        <div className="flex-1 min-h-0 overflow-auto sm:overflow-hidden">
          {/* Mobile: stacked day cards */}
          <div className="sm:hidden flex flex-col gap-3">
            {weekDays.map(date => {
              const daySchedule = schedules[date];
              const hasData = daySchedule && Object.values(daySchedule).some(slots => slots.some(s => s.length > 0));
              if (!hasData) return null;

              return (
                <div key={date} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${date === today ? '#cf2e2e' : '#333'}` }}>
                  <div
                    className="px-3 py-2 text-sm font-bold text-center"
                    style={{ backgroundColor: date === today ? '#cf2e2e' : '#8b1a1a', color: '#fff' }}
                  >
                    יום {getWeekDay(date)} - {formatShortDate(date)}
                  </div>
                  {TIME_SLOTS.map((time, slotIdx) => {
                    const slotEntries = fields
                      .map(field => ({ field, teams: daySchedule?.[field]?.[slotIdx] ?? [] }))
                      .filter(e => e.teams.length > 0);
                    if (slotEntries.length === 0) return null;

                    return (
                      <div key={slotIdx} style={{ borderTop: '1px solid #333' }}>
                        <div className="px-3 py-1 text-xs font-semibold" style={{ backgroundColor: '#1a1a1a', color: '#fcb900' }}>
                          {time}
                        </div>
                        <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: '#333' }}>
                          {slotEntries.map(({ field, teams }) => (
                            <div key={field} className="p-1.5 flex flex-col gap-0.5" style={{ backgroundColor: '#111' }}>
                              <div className="text-[10px] font-bold text-center rounded px-1 py-0.5" style={{ backgroundColor: '#cf2e2e', color: '#fff' }}>
                                {field}
                              </div>
                              {teams.map((team, i) => (
                                <div key={i} className="text-xs font-semibold text-center rounded px-1 py-0.5" style={{ backgroundColor: '#32373c', color: '#fff' }}>
                                  {team}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Desktop: table layout */}
          <table className="hidden sm:table w-full h-full border-collapse text-center">
            <thead>
              <tr>
                <th className="p-2 text-base font-bold border min-w-[110px]" style={{ color: '#fff', borderColor: '#333', backgroundColor: '#1a1a1a' }}>
                  שעה
                </th>
                {weekDays.map(date => (
                  <th
                    key={date}
                    className="p-2 text-base font-bold border min-w-[130px]"
                    style={{
                      borderColor: '#333',
                      backgroundColor: date === today ? '#cf2e2e' : '#8b1a1a',
                      color: '#fff',
                    }}
                  >
                    <div>{getWeekDay(date)}</div>
                    <div className="text-sm font-normal" style={{ color: date === today ? '#fff' : '#ffcaca' }}>{formatShortDate(date)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((time, slotIdx) => (
                <tr key={slotIdx} style={{ height: `${100 / TIME_SLOTS.length}%` }}>
                  <td className="p-2 text-sm font-semibold border whitespace-nowrap" style={{ color: '#fcb900', borderColor: '#333', backgroundColor: '#1a1a1a' }}>
                    {time}
                  </td>
                  {weekDays.map(date => {
                    const daySchedule = schedules[date];
                    const cellEntries = fields
                      .map(field => ({
                        field,
                        teams: daySchedule?.[field]?.[slotIdx] ?? [],
                      }))
                      .filter(e => e.teams.length > 0);

                    return (
                      <td
                        key={date}
                        className="p-2 border align-middle"
                        style={{
                          borderColor: '#333',
                          backgroundColor: date === today ? '#1a0a0a' : '#111',
                        }}
                      >
                        <div className="flex flex-col gap-1">
                          {cellEntries.map(({ field, teams }) => (
                            <div key={field}>
                              <div
                                className="text-xs font-bold rounded px-1.5 py-0.5 mb-0.5 inline-block"
                                style={{ backgroundColor: '#cf2e2e', color: '#fff' }}
                              >
                                {field}
                              </div>
                              <div className="flex flex-wrap gap-1 justify-center">
                                {teams.map((team, i) => (
                                  <span
                                    key={i}
                                    className="inline-block text-sm font-semibold rounded px-2 py-0.5"
                                    style={{ backgroundColor: '#32373c', color: '#fff' }}
                                  >
                                    {team}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
