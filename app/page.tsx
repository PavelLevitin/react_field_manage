'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const BASE_PATH = '/fields';
const FIELD_TITLES = ['וסרמיל 1', 'וסרמיל 2', 'וסרמיל 3', 'וסרמיל 4'];
const TIME_SLOTS = ['16:00 - 17:45', '18:00 - 19:45', '20:00 - 21:45'];
const INITIAL_TEAMS = ['ילדים א', 'נערים א', 'נערים ב', 'ילדים ג', 'שמנים ד', 'שמנים א'];
const INITIAL_CONTAINERS: string[][] = Array.from({ length: 12 }, () => []);

async function fetchTeams(): Promise<string[]> {
  const res = await fetch(`${BASE_PATH}/api/teams`);
  const data = await res.json();
  return Array.isArray(data.teams) ? data.teams : INITIAL_TEAMS;
}

async function fetchSchedule(date: string): Promise<string[][]> {
  const res = await fetch(`${BASE_PATH}/api/schedule?date=${date}`);
  const data = await res.json();
  return Array.isArray(data.containers) ? data.containers : INITIAL_CONTAINERS;
}

function saveSchedule(date: string, containers: string[][]) {
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

export default function Home() {
  const [containers, setContainers] = useState<string[][]>(INITIAL_CONTAINERS);
  const [teams, setTeams] = useState<string[]>(INITIAL_TEAMS);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mounted, setMounted] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(208);
  const [manageOpen, setManageOpen] = useState(false);
  const [newTeamInput, setNewTeamInput] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
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

  // Initial load: fetch the team roster and the current date's schedule together.
  useEffect(() => {
    (async () => {
      try {
        const [teamsResult, scheduleResult] = await Promise.all([
          fetchTeams(),
          fetchSchedule(selectedDate),
        ]);
        setTeams(teamsResult);
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

  const placeTeamInSlot = (team: string, index: number) => {
    if (!team || containers[index].includes(team) || containers[index].length >= 4) return;
    const next = containers.map(c => [...c]);
    next[index].push(team);
    setContainers(next);
    saveSchedule(selectedDate, next);
  };

  const onDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const team = e.dataTransfer.getData('team');
    placeTeamInSlot(team, index);
  };

  const removeFromSlot = (containerIndex: number, team: string) => {
    const next = containers.map((c, i) => (i === containerIndex ? c.filter(t => t !== team) : c));
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
    setContainers(prev => prev.map(slot => slot.filter(t => t !== name)));
  };

  const renameTeam = async () => {
    if (!editingTeam) return;
    const { original, value } = editingTeam;
    const newName = value.trim();
    if (!newName || newName === original) { setEditingTeam(null); return; }
    setEditingTeam(null);
    const nextTeams = await teamsAction({ action: 'rename', original, name: newName });
    setTeams(nextTeams);
    setContainers(prev => prev.map(slot => slot.map(t => (t === original ? newName : t))));
  };

  const buildGridRows = () => {
    const gridRows: string[][] = [['', ...FIELD_TITLES]];
    TIME_SLOTS.forEach((time, rowIndex) => {
      gridRows.push([time, '', '', '', '']);
      const slots = FIELD_TITLES.map((_, colIndex) => containers[rowIndex * 4 + colIndex]);
      const maxTeams = Math.max(...slots.map(s => s.length), 0);
      for (let i = 0; i < maxTeams; i++) {
        gridRows.push(['', ...slots.map(s => s[i] ?? '')]);
      }
    });
    return gridRows;
  };

  const downloadExcel = () => {
    const [y, m, d] = selectedDate.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    const gridRows = [['תאריך:', formattedDate], [], ...buildGridRows()];
    const ws = XLSX.utils.aoa_to_sheet(gridRows);

    const border = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };

    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        ws[addr].s = { border };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
    XLSX.writeFile(wb, 'schedule.xlsx');
  };

  const downloadPDF = async () => {
    const gridRows = buildGridRows();

    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;left:-9999px;direction:rtl;font-family:Arial,sans-serif;background:white;padding:20px;width:700px;';

    const tableRows = gridRows.map((row, i) => {
      const isHeader = i === 0;
      const isTimeSlot = i > 0 && row[1] === '' && row[0] !== '';
      const bg = isHeader ? '#6d28d9' : isTimeSlot ? '#ede9fe' : i % 2 === 0 ? '#f9f9f9' : 'white';
      const color = isHeader ? 'white' : '#1f2937';
      const fontWeight = isHeader || isTimeSlot ? 'bold' : 'normal';
      const cells = row.map(cell =>
        `<td style="border:1px solid #ccc;padding:7px 10px;text-align:center;font-weight:${fontWeight};color:${color};">${cell}</td>`
      ).join('');
      return `<tr style="background:${bg};">${cells}</tr>`;
    }).join('');

    const [y, m, d] = selectedDate.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    div.innerHTML = `
      <h2 style="margin-bottom:12px;font-size:15px;">לוח זמנים - ${formattedDate}</h2>
      <table style="border-collapse:collapse;width:100%;font-size:12px;">${tableRows}</table>
    `;

    document.body.appendChild(div);
    const canvas = await html2canvas(div, { scale: 2 });
    document.body.removeChild(div);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, imgWidth, imgHeight);
    doc.save('schedule.pdf');
  };

  const clearAll = () => {
    setContainers(INITIAL_CONTAINERS);
    saveSchedule(selectedDate, INITIAL_CONTAINERS);
    setClearConfirmOpen(false);
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
          {TIME_SLOTS.map((time, rowIndex) => (
            <section key={rowIndex}>
              <h2 className="text-lg font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-200">
                {time}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
                {FIELD_TITLES.map((title, colIndex) => {
                  const slotIndex = rowIndex * 4 + colIndex;
                  return (
                    <div key={colIndex} className="flex flex-col items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-600">{title}</h3>
                      <div
                        onDrop={e => onDrop(e, slotIndex)}
                        onDragOver={e => e.preventDefault()}
                        onClick={() => handleDoubleTap(`slot-${slotIndex}`, () => {
                          if (!selectedTeam) return;
                          placeTeamInSlot(selectedTeam, slotIndex);
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
                        {containers[slotIndex]?.map((team, i) => (
                          <div
                            key={i}
                            onClick={e => {
                              e.stopPropagation();
                              handleDoubleTap(`remove-${slotIndex}-${team}`, () => removeFromSlot(slotIndex, team));
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
                  );
                })}
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
            onClick={() => setClearConfirmOpen(true)}
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

      {/* Clear All Confirmation Modal */}
      {clearConfirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setClearConfirmOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[85vw] sm:w-72 p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">⚠️</div>
              <h2 className="text-base font-bold text-gray-800">נקה את כל המגרשים?</h2>
              <p className="text-sm text-gray-500">פעולה זו תסיר את כל הקבוצות מהמגרשים. לא ניתן לבטל.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearAll}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                נקה הכל
              </button>
              <button
                onClick={() => setClearConfirmOpen(false)}
                className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
