'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const BASE_PATH = '/fields';
const TIME_SLOTS = ['16:00 - 17:45', '18:00 - 19:45', '20:00 - 21:45'];
const INITIAL_TEAMS = ['ילדים א', 'נערים א', 'נערים ב', 'ילדים ג', 'שמנים ד', 'שמנים א'];
const INITIAL_FIELDS = ['וסרמיל 1', 'וסרמיל 2', 'וסרמיל 3', 'וסרמיל 4'];

// Tailwind needs literal class names in source to include them in the build,
// so desktop column counts are looked up rather than interpolated.
const FIELD_COLS_CLASS: Record<number, string> = {
  1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5', 6: 'sm:grid-cols-6', 7: 'sm:grid-cols-7', 8: 'sm:grid-cols-8',
};

type DateSchedule = Record<string, string[][]>;

function emptyFieldSlots(): string[][] {
  return Array.from({ length: TIME_SLOTS.length }, () => []);
}

const INITIAL_CONTAINERS: DateSchedule = Object.fromEntries(INITIAL_FIELDS.map(f => [f, emptyFieldSlots()]));

async function fetchTeams(): Promise<string[]> {
  const res = await fetch(`${BASE_PATH}/api/teams`);
  const data = await res.json();
  return Array.isArray(data.teams) ? data.teams : INITIAL_TEAMS;
}

async function fetchFields(): Promise<string[]> {
  const res = await fetch(`${BASE_PATH}/api/fields`);
  const data = await res.json();
  return Array.isArray(data.fields) ? data.fields : INITIAL_FIELDS;
}

async function fetchSchedule(date: string): Promise<DateSchedule> {
  const res = await fetch(`${BASE_PATH}/api/schedule?date=${date}`);
  const data = await res.json();
  return data.containers && typeof data.containers === 'object' ? data.containers : {};
}

async function fetchAllSchedules(): Promise<Record<string, DateSchedule>> {
  const res = await fetch(`${BASE_PATH}/api/schedules`);
  const data = await res.json();
  return data.schedules && typeof data.schedules === 'object' ? data.schedules : {};
}

function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

function saveSchedule(date: string, containers: DateSchedule) {
  fetch(`${BASE_PATH}/api/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, containers }),
  }).catch(() => {});
}

async function teamsAction(body: Record<string, string>): Promise<string[]> {
  const res = await fetch(`${BASE_PATH}/api/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Array.isArray(data.teams) ? data.teams : [];
}

async function fieldsAction(body: Record<string, string>): Promise<string[]> {
  const res = await fetch(`${BASE_PATH}/api/fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Array.isArray(data.fields) ? data.fields : [];
}

export default function Home() {
  const [containers, setContainers] = useState<DateSchedule>(INITIAL_CONTAINERS);
  const [teams, setTeams] = useState<string[]>(INITIAL_TEAMS);
  const [fields, setFields] = useState<string[]>(INITIAL_FIELDS);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mounted, setMounted] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(208);
  const [manageOpen, setManageOpen] = useState(false);
  const [newTeamInput, setNewTeamInput] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false);
  const [newFieldInput, setNewFieldInput] = useState('');
  const [confirmRemoveField, setConfirmRemoveField] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ original: string; value: string } | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearMode, setClearMode] = useState<'menu' | 'current' | 'specific' | 'all'>('menu');
  const [clearSpecificDate, setClearSpecificDate] = useState(selectedDate);
  const [clearAllConfirmText, setClearAllConfirmText] = useState('');
  const [editingTeam, setEditingTeam] = useState<{ original: string; value: string } | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const isResizing = useRef(false);
  const lastTap = useRef<{ key: string; time: number } | null>(null);
  const isFirstDateLoad = useRef(true);

  const handleDoubleTap = (key: string, action: () => void) => {
    const now = Date.now();
    if (lastTap.current && lastTap.current.key === key && now - lastTap.current.time < 350) {
      lastTap.current = null;
      action();
    } else {
      lastTap.current = { key, time: now };
    }
  };

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      // Sidebar is on the left (RTL layout), so width = mouseX
      const newWidth = e.clientX;
      setSidebarWidth(Math.min(Math.max(newWidth, 140), 500));
    };

    const onUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // Initial load: fetch the team roster, field list, and current date's schedule together.
  useEffect(() => {
    (async () => {
      try {
        const [teamsResult, fieldsResult, scheduleResult] = await Promise.all([
          fetchTeams(),
          fetchFields(),
          fetchSchedule(selectedDate),
        ]);
        setTeams(teamsResult);
        setFields(fieldsResult);
        setContainers(scheduleResult);
      } finally {
        setMounted(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch the schedule whenever the selected date changes (skip the initial mount, handled above).
  useEffect(() => {
    if (isFirstDateLoad.current) {
      isFirstDateLoad.current = false;
      return;
    }
    fetchSchedule(selectedDate).then(setContainers);
  }, [selectedDate]);

  const onDragStart = (e: React.DragEvent, team: string) => {
    e.dataTransfer.setData('team', team);
  };

  const placeTeamInSlot = (team: string, field: string, timeSlotIndex: number) => {
    const currentSlot = containers[field]?.[timeSlotIndex] ?? [];
    if (!team || currentSlot.includes(team) || currentSlot.length >= 4) return;
    const next: DateSchedule = {};
    for (const f of fields) {
      next[f] = (containers[f] ?? emptyFieldSlots()).map(slot => [...slot]);
    }
    next[field][timeSlotIndex] = [...next[field][timeSlotIndex], team];
    setContainers(next);
    saveSchedule(selectedDate, next);
  };

  const onDrop = (e: React.DragEvent, field: string, timeSlotIndex: number) => {
    e.preventDefault();
    const team = e.dataTransfer.getData('team');
    placeTeamInSlot(team, field, timeSlotIndex);
  };

  const removeFromSlot = (field: string, timeSlotIndex: number, team: string) => {
    const next: DateSchedule = {};
    for (const f of fields) {
      next[f] = (containers[f] ?? emptyFieldSlots()).map((slot, i) =>
        f === field && i === timeSlotIndex ? slot.filter(t => t !== team) : [...slot]
      );
    }
    setContainers(next);
    saveSchedule(selectedDate, next);
  };

  const addTeam = async () => {
    const name = newTeamInput.trim();
    if (!name) return;
    setNewTeamInput('');
    const nextTeams = await teamsAction({ action: 'add', name });
    setTeams(nextTeams);
  };

  const removeTeam = async (name: string) => {
    const nextTeams = await teamsAction({ action: 'remove', name });
    setTeams(nextTeams);
    setContainers(prev => Object.fromEntries(Object.entries(prev).map(([f, slots]) => [f, slots.map(slot => slot.filter(t => t !== name))])));
  };

  const renameTeam = async () => {
    if (!editingTeam) return;
    const { original, value } = editingTeam;
    const newName = value.trim();
    if (!newName || newName === original) { setEditingTeam(null); return; }
    setEditingTeam(null);
    const nextTeams = await teamsAction({ action: 'rename', original, name: newName });
    setTeams(nextTeams);
    setContainers(prev => Object.fromEntries(Object.entries(prev).map(([f, slots]) => [f, slots.map(slot => slot.map(t => (t === original ? newName : t)))])));
  };

  const addField = async () => {
    const name = newFieldInput.trim();
    if (!name) return;
    setNewFieldInput('');
    const nextFields = await fieldsAction({ action: 'add', name });
    setFields(nextFields);
  };

  const removeField = async (name: string) => {
    const nextFields = await fieldsAction({ action: 'remove', name });
    setFields(nextFields);
    setContainers(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const renameField = async () => {
    if (!editingField) return;
    const { original, value } = editingField;
    const newName = value.trim();
    if (!newName || newName === original) { setEditingField(null); return; }
    setEditingField(null);
    const nextFields = await fieldsAction({ action: 'rename', original, name: newName });
    setFields(nextFields);
    setContainers(prev => {
      if (!(original in prev)) return prev;
      const next = { ...prev };
      next[newName] = next[original];
      delete next[original];
      return next;
    });
  };

  const buildGridRows = (schedule: DateSchedule, fieldList: string[]) => {
    const gridRows: string[][] = [['', ...fieldList]];
    TIME_SLOTS.forEach((time, rowIndex) => {
      gridRows.push([time, ...fieldList.map(() => '')]);
      const slots = fieldList.map(f => schedule[f]?.[rowIndex] ?? []);
      const maxTeams = Math.max(...slots.map(s => s.length), 0);
      for (let i = 0; i < maxTeams; i++) {
        gridRows.push(['', ...slots.map(s => s[i] ?? '')]);
      }
    });
    return gridRows;
  };

  // Gathers every date that has at least one team assigned, oldest to newest.
  const getDatedSchedules = async (): Promise<[string, DateSchedule][]> => {
    const schedules = await fetchAllSchedules();
    return Object.entries(schedules)
      .filter(([, schedule]) => Object.values(schedule).some(slots => slots.some(s => s.length > 0)))
      .sort(([a], [b]) => a.localeCompare(b));
  };

  const downloadExcel = async () => {
    const datedSchedules = await getDatedSchedules();
    const wb = XLSX.utils.book_new();

    const border = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };

    datedSchedules.forEach(([date, schedule]) => {
      const gridRows = [['תאריך:', formatDate(date)], [], ...buildGridRows(schedule, fields)];
      const ws = XLSX.utils.aoa_to_sheet(gridRows);

      const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[addr]) ws[addr] = { t: 's', v: '' };
          ws[addr].s = { border };
        }
      }

      // Sheet names can't contain : \ / ? * [ ] and are capped at 31 chars.
      const sheetName = date.split('-').reverse().join('-');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, 'schedule.xlsx');
  };

  const downloadPDF = async () => {
    const datedSchedules = await getDatedSchedules();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let i = 0; i < datedSchedules.length; i++) {
      const [date, schedule] = datedSchedules[i];
      const gridRows = buildGridRows(schedule, fields);

      const div = document.createElement('div');
      div.style.cssText = 'position:absolute;left:-9999px;direction:rtl;font-family:Arial,sans-serif;background:white;padding:20px;width:700px;';

      const tableRows = gridRows.map((row, r) => {
        const isHeader = r === 0;
        const isTimeSlot = r > 0 && row[1] === '' && row[0] !== '';
        const bg = isHeader ? '#6d28d9' : isTimeSlot ? '#ede9fe' : r % 2 === 0 ? '#f9f9f9' : 'white';
        const color = isHeader ? 'white' : '#1f2937';
        const fontWeight = isHeader || isTimeSlot ? 'bold' : 'normal';
        const cells = row.map(cell =>
          `<td style="border:1px solid #ccc;padding:7px 10px;text-align:center;font-weight:${fontWeight};color:${color};">${cell}</td>`
        ).join('');
        return `<tr style="background:${bg};">${cells}</tr>`;
      }).join('');

      div.innerHTML = `
        <h2 style="margin-bottom:12px;font-size:15px;">לוח זמנים - ${formatDate(date)}</h2>
        <table style="border-collapse:collapse;width:100%;font-size:12px;">${tableRows}</table>
      `;

      document.body.appendChild(div);
      const canvas = await html2canvas(div, { scale: 2 });
      document.body.removeChild(div);

      if (i > 0) doc.addPage();
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, imgWidth, imgHeight);
    }

    doc.save('schedule.pdf');
  };

  const closeClearDialog = () => {
    setClearDialogOpen(false);
    setClearMode('menu');
    setClearAllConfirmText('');
  };

  const clearDate = (date: string) => {
    const next = Object.fromEntries(fields.map(f => [f, emptyFieldSlots()]));
    if (date === selectedDate) setContainers(next);
    saveSchedule(date, next);
    closeClearDialog();
  };

  const clearAllDates = async () => {
    await fetch(`${BASE_PATH}/api/schedules`, { method: 'DELETE' }).catch(() => {});
    setContainers(Object.fromEntries(fields.map(f => [f, emptyFieldSlots()])));
    closeClearDialog();
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-gray-50">
      {/* Main grid area */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 order-2 md:order-1">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ניהול זמני מגרש</h1>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="space-y-8">
          {TIME_SLOTS.map((time, timeSlotIndex) => (
            <section key={timeSlotIndex}>
              <h2 className="text-lg font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-200">
                {time}
              </h2>
              <div className={`grid grid-cols-2 ${FIELD_COLS_CLASS[fields.length] ?? 'sm:grid-cols-4'} gap-3 sm:gap-6`}>
                {fields.map(field => (
                  <div key={field} className="flex flex-col items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-600">{field}</h3>
                    <div
                      onDrop={e => onDrop(e, field, timeSlotIndex)}
                      onDragOver={e => e.preventDefault()}
                      onClick={() => handleDoubleTap(`slot-${field}-${timeSlotIndex}`, () => {
                        if (!selectedTeam) return;
                        placeTeamInSlot(selectedTeam, field, timeSlotIndex);
                        setSelectedTeam(null);
                      })}
                      style={{
                        backgroundImage: `url('${BASE_PATH}/soccer.png')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        touchAction: 'manipulation',
                      }}
                      className={`w-full min-h-32 sm:min-h-40 rounded-xl border-2 border-dashed flex flex-col gap-1.5 p-2 transition-colors hover:border-blue-400 hover:bg-blue-50/30 ${selectedTeam ? 'border-blue-400 bg-blue-50/30' : 'border-gray-300 bg-white'}`}
                    >
                      {(containers[field]?.[timeSlotIndex] ?? []).map((team, i) => (
                        <div
                          key={i}
                          onClick={e => {
                            e.stopPropagation();
                            handleDoubleTap(`remove-${field}-${timeSlotIndex}-${team}`, () => removeFromSlot(field, timeSlotIndex, team));
                          }}
                          title="לחץ פעמיים להסרה"
                          style={{ touchAction: 'manipulation' }}
                          className="bg-white/90 text-gray-800 text-xs font-bold rounded-lg px-2 py-1.5 text-center cursor-pointer shadow-sm hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          {team}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Scalable Sidebar */}
      <aside
        style={isDesktop ? { width: sidebarWidth } : undefined}
        className="w-full md:w-auto shrink-0 bg-white border-b md:border-b-0 md:border-r border-gray-200 shadow-sm flex flex-col relative h-auto md:h-full order-1 md:order-2"
      >
        {/* Resize handle (desktop only) */}
        <div
          onMouseDown={onResizeStart}
          className="hidden md:block absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors z-10"
        />
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">קבוצות</h2>
        </div>

        {/* Teams list — horizontal scroll on mobile, vertical on desktop */}
        <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto flex-1 gap-1.5 p-3 w-full">
          {teams.map((team, i) => (
            <div
              key={i}
              draggable={isDesktop}
              onDragStart={e => onDragStart(e, team)}
              onClick={() => setSelectedTeam(t => (t === team ? null : team))}
              style={{ touchAction: 'manipulation' }}
              className={`shrink-0 border font-semibold text-sm rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing transition-colors text-center select-none whitespace-nowrap ${
                selectedTeam === team
                  ? 'bg-red-500 border-red-600 text-white ring-2 ring-red-300'
                  : 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100 hover:border-blue-300'
              }`}
            >
              {team}
            </div>
          ))}
        </div>

        {/* Action buttons — pinned to bottom */}
        <div className="p-3 border-t border-gray-100 space-y-2">
          <button
            onClick={() => setManageOpen(true)}
            className="w-full text-sm py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors"
          >
            ניהול קבוצות
          </button>
          <button
            onClick={() => setManageFieldsOpen(true)}
            className="w-full text-sm py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
          >
            ניהול מגרשים
          </button>
          <button
            onClick={downloadExcel}
            className="w-full text-sm py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-medium transition-colors"
          >
            ייצוא Excel
          </button>
          <button
            onClick={downloadPDF}
            className="w-full text-sm py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
          >
            ייצוא PDF
          </button>
          <button
            onClick={() => { setClearSpecificDate(selectedDate); setClearDialogOpen(true); }}
            className="w-full text-sm py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-medium transition-colors"
          >
            נקה הכל
          </button>
        </div>
      </aside>

      {/* Manage Teams Modal */}
      {manageOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setManageOpen(false); setConfirmRemove(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] sm:w-96 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">ניהול קבוצות</h2>
              <button onClick={() => { setManageOpen(false); setConfirmRemove(null); }} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">✕</button>
            </div>

            {/* Teams list */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {teams.map((team, i) => (
                <div key={i} className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 gap-2">
                  {editingTeam?.original === team ? (
                    <>
                      <input
                        autoFocus
                        value={editingTeam.value}
                        onChange={e => setEditingTeam({ ...editingTeam, value: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') renameTeam(); if (e.key === 'Escape') setEditingTeam(null); }}
                        className="flex-1 text-sm border border-purple-300 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                      <button onClick={renameTeam} className="text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-md px-2 py-0.5 transition-colors">שמור</button>
                      <button onClick={() => setEditingTeam(null)} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md px-2 py-0.5 transition-colors">ביטול</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-gray-800 flex-1">{team}</span>
                      {confirmRemove === team ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { removeTeam(team); setConfirmRemove(null); }} className="text-xs bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-0.5 transition-colors">הסר</button>
                          <button onClick={() => setConfirmRemove(null)} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md px-2 py-0.5 transition-colors">ביטול</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setConfirmRemove(null); setEditingTeam({ original: team, value: team }); }}
                            className="text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-full w-6 h-6 flex items-center justify-center transition-colors text-sm"
                            title="ערוך שם"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => { setEditingTeam(null); setConfirmRemove(team); }}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full w-6 h-6 flex items-center justify-center transition-colors text-lg leading-none"
                            title="הסר קבוצה"
                          >
                            −
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new team */}
            <div className="px-5 py-4 border-t border-gray-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTeamInput}
                  onChange={e => setNewTeamInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTeam()}
                  placeholder="שם קבוצה חדשה..."
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  onClick={addTeam}
                  className="bg-purple-500 hover:bg-purple-600 text-white rounded-lg px-3 py-2 text-sm font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Fields Modal */}
      {manageFieldsOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setManageFieldsOpen(false); setConfirmRemoveField(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] sm:w-96 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">ניהול מגרשים</h2>
              <button onClick={() => { setManageFieldsOpen(false); setConfirmRemoveField(null); }} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">✕</button>
            </div>

            {/* Fields list */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {fields.map((field, i) => (
                <div key={i} className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 gap-2">
                  {editingField?.original === field ? (
                    <>
                      <input
                        autoFocus
                        value={editingField.value}
                        onChange={e => setEditingField({ ...editingField, value: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') renameField(); if (e.key === 'Escape') setEditingField(null); }}
                        className="flex-1 text-sm border border-indigo-300 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button onClick={renameField} className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-md px-2 py-0.5 transition-colors">שמור</button>
                      <button onClick={() => setEditingField(null)} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md px-2 py-0.5 transition-colors">ביטול</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-gray-800 flex-1">{field}</span>
                      {confirmRemoveField === field ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { removeField(field); setConfirmRemoveField(null); }} className="text-xs bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-0.5 transition-colors">הסר</button>
                          <button onClick={() => setConfirmRemoveField(null)} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md px-2 py-0.5 transition-colors">ביטול</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setConfirmRemoveField(null); setEditingField({ original: field, value: field }); }}
                            className="text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-full w-6 h-6 flex items-center justify-center transition-colors text-sm"
                            title="ערוך שם"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => { setEditingField(null); setConfirmRemoveField(field); }}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full w-6 h-6 flex items-center justify-center transition-colors text-lg leading-none"
                            title="הסר מגרש"
                          >
                            −
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new field */}
            <div className="px-5 py-4 border-t border-gray-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFieldInput}
                  onChange={e => setNewFieldInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addField()}
                  placeholder="שם מגרש חדש..."
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={addField}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Schedule Dialog */}
      {clearDialogOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closeClearDialog}>
          <div className="bg-white rounded-2xl shadow-2xl w-[85vw] sm:w-80 p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            {clearMode === 'menu' && (
              <>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">⚠️</div>
                  <h2 className="text-base font-bold text-gray-800">ניקוי לוח זמנים</h2>
                  <p className="text-sm text-gray-500">בחר מה לנקות</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setClearMode('current')}
                    className="py-2 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-800 text-sm font-semibold transition-colors"
                  >
                    נקה יום נוכחי ({formatDate(selectedDate)})
                  </button>
                  <button
                    onClick={() => setClearMode('specific')}
                    className="py-2 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-800 text-sm font-semibold transition-colors"
                  >
                    נקה תאריך ספציפי
                  </button>
                  <button
                    onClick={() => setClearMode('all')}
                    className="py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                  >
                    נקה את כל התאריכים
                  </button>
                  <button
                    onClick={closeClearDialog}
                    className="py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </>
            )}

            {clearMode === 'current' && (
              <>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">⚠️</div>
                  <h2 className="text-base font-bold text-gray-800">לנקות את {formatDate(selectedDate)}?</h2>
                  <p className="text-sm text-gray-500">פעולה זו תסיר את כל הקבוצות מהתאריך הזה. לא ניתן לבטל.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => clearDate(selectedDate)}
                    className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                  >
                    נקה
                  </button>
                  <button
                    onClick={() => setClearMode('menu')}
                    className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
                  >
                    חזרה
                  </button>
                </div>
              </>
            )}

            {clearMode === 'specific' && (
              <>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">⚠️</div>
                  <h2 className="text-base font-bold text-gray-800">נקה תאריך ספציפי</h2>
                  <p className="text-sm text-gray-500">פעולה זו תסיר את כל הקבוצות מהתאריך שנבחר. לא ניתן לבטל.</p>
                </div>
                <input
                  type="date"
                  value={clearSpecificDate}
                  onChange={e => setClearSpecificDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => clearDate(clearSpecificDate)}
                    className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                  >
                    נקה
                  </button>
                  <button
                    onClick={() => setClearMode('menu')}
                    className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
                  >
                    חזרה
                  </button>
                </div>
              </>
            )}

            {clearMode === 'all' && (
              <>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">⚠️</div>
                  <h2 className="text-base font-bold text-gray-800">נקה את כל התאריכים?</h2>
                  <p className="text-sm text-gray-500">פעולה זו תמחק לצמיתות את כל התאריכים ששמורים במערכת. לא ניתן לבטל.</p>
                  <p className="text-sm text-gray-500">כדי לאשר, הקלד/י <span className="font-bold">מחק הכל</span></p>
                </div>
                <input
                  type="text"
                  value={clearAllConfirmText}
                  onChange={e => setClearAllConfirmText(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={clearAllDates}
                    disabled={clearAllConfirmText.trim() !== 'מחק הכל'}
                    className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                  >
                    מחק הכל
                  </button>
                  <button
                    onClick={() => { setClearMode('menu'); setClearAllConfirmText(''); }}
                    className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
                  >
                    חזרה
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
