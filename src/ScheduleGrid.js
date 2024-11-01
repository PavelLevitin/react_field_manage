import React from 'react';
import DroppableContainer from './DroppableContainer';

const rows = [
  { time: '16:00 -17:45', id: 'row1' },
  { time: '18:00 - 19:45', id: 'row2' },
  { time: '20:00 - 21:45', id: 'row3' },
];

function ScheduleGrid() {
  return (
    <div className="schedule-grid">
      {rows.map((row) => (
        <div key={row.id} className="row">
          <h2>{row.time}</h2>
          <div className="row-content">
            {Array.from({ length: 4 }).map((_, index) => (
              <DroppableContainer key={`${row.id}-${index}`} id={`${row.id}-${index}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ScheduleGrid;
