'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';

const FIELD_TITLES = ['וסרמיל 1', 'וסרמיל 2', 'וסרמיל 3', 'וסרמיל 4'];
const TIME_SLOTS = ['16:00 - 17:45', '18:00 - 19:45', '20:00 - 21:45'];
const INITIAL_TEAMS = ['ילדים א', 'נערים א', 'נערים ב', 'ילדים ג', 'שמנים ד', 'שמנים א'];
const INITIAL_CONTAINERS: string[][] = Array.from({ length: 12 }, () => []);

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
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
  const isResizing = useRef(false);

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

  useEffect(() => {
    setContainers(load('fieldState', INITIAL_CONTAINERS));
    setTeams(load('teamsState', INITIAL_TEAMS));
    setMounted(true);
  }, []);

  const onDragStart = (e: React.DragEvent, team: string) => {
    e.dataTransfer.setData('team', team);
  };

  const onDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const team = e.dataTransfer.getData('team');
    if (!team || containers[index].includes(team) || containers[index].length >= 4) return;
    const next = containers.map(c => [...c]);
    next[index].push(team);
    saveToStorage('fieldState', next);
    setContainers(next);
  };

  const removeFromSlot = (containerIndex: number, team: string) => {
    const next = containers.map((c, i) => (i === containerIndex ? c.filter(t => t !== team) : c));
    saveToStorage('fieldState', next);
    setContainers(next);
  };

  const addTeam = () => {
    const name = newTeamInput.trim();
    if (!name) return;
    const next = [...teams, name];
    saveToStorage('teamsState', next);
    setTeams(next);
    setNewTeamInput('');
  };

  const removeTeam = (name: string) => {
    const nextTeams = teams.filter(t => t !== name);
    const nextContainers = containers.map(slot => slot.filter(t => t !== name));
    saveToStorage('teamsState', nextTeams);
    saveToStorage('fieldState', nextContainers);
    setTeams(nextTeams);
    setContainers(nextContainers);
  };

  const renameTeam = () => {
    if (!editingTeam) return;
    const { original, value } = editingTeam;
    const newName = value.trim();
    if (!newName || newName === original) { setEditingTeam(null); return; }
    const nextTeams = teams.map(t => (t === original ? newName : t));
    const nextContainers = containers.map(slot => slot.map(t => (t === original ? newName : t)));
    saveToStorage('teamsState', nextTeams);
    saveToStorage('fieldState', nextContainers);
    setTeams(nextTeams);
    setContainers(nextContainers);
    setEditingTeam(null);
  };

  const downloadExcel = () => {
    const rows = containers.flatMap((slot, i) =>
      slot.map(team => ({
        'קבוצה': team,
        'מגרש': FIELD_TITLES[i % 4],
        'שעות': TIME_SLOTS[Math.floor(i / 4)],
        'תאריך': selectedDate,
      }))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
    XLSX.writeFile(wb, 'schedule.xlsx');
  };

  const clearAll = () => {
    saveToStorage('fieldState', INITIAL_CONTAINERS);
    setContainers(INITIAL_CONTAINERS);
    setClearConfirmOpen(false);
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Main grid area */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">ניהול זמני מגרש</h1>
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
              <div className="grid grid-cols-4 gap-6">
                {FIELD_TITLES.map((title, colIndex) => {
                  const slotIndex = rowIndex * 4 + colIndex;
                  return (
                    <div key={colIndex} className="flex flex-col items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-600">{title}</h3>
                      <div
                        onDrop={e => onDrop(e, slotIndex)}
                        onDragOver={e => e.preventDefault()}
                        className="w-full min-h-40 rounded-xl border-2 border-dashed border-gray-300 bg-white flex flex-col gap-1.5 p-2 transition-colors hover:border-blue-400 hover:bg-blue-50/30"
                        style={{
                          backgroundImage: "url('/soccer.png')",
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        {containers[slotIndex]?.map((team, i) => (
                          <div
                            key={i}
                            onDoubleClick={() => removeFromSlot(slotIndex, team)}
                            title="לחץ פעמיים להסרה"
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
      <aside style={{ width: sidebarWidth }} className="shrink-0 bg-white border-r border-gray-200 shadow-sm flex flex-col relative">
        {/* Resize handle */}
        <div
          onMouseDown={onResizeStart}
          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors z-10"
        />
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">קבוצות</h2>
        </div>

        {/* Teams list — scrollable, grows with content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 w-full">
          {teams.map((team, i) => (
            <div
              key={i}
              draggable
              onDragStart={e => onDragStart(e, team)}
              className="bg-blue-50 border border-blue-200 text-blue-900 font-semibold text-sm rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing hover:bg-blue-100 hover:border-blue-300 transition-colors text-center select-none whitespace-nowrap"
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
          <div className="bg-white rounded-2xl shadow-2xl w-80 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
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
          <div className="bg-white rounded-2xl shadow-2xl w-72 p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
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
