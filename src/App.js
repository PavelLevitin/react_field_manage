import React, { useState, useEffect } from 'react';
import './App.css';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { he } from 'date-fns/locale';
import * as XLSX from 'xlsx';

const initialContainers = Array.from({ length: 12 }, () => []);

const saveStateToLocalStorage = (key, state) => {
  localStorage.setItem(key, JSON.stringify(state));
};

const readStateFromLocalStorage = (key, fallback) => {
  const state = localStorage.getItem(key);
  return state ? JSON.parse(state) : fallback;
};

const App = () => {
  const [containers, setContainers] = useState(
    readStateFromLocalStorage('fieldState', initialContainers)
  );
  const [buttons, setButtons] = useState(
    readStateFromLocalStorage('buttonsState', [
      'ילדים א',
      'נערים א',
      'נערים ב',
      'ילדים ג',
      'שמנים ד',
      'שמנים א',
    ])
  );
  const [selectedDate, setSelectedDate] = useState(new Date()); // Set today's date as default

  useEffect(() => {
    saveStateToLocalStorage('fieldState', containers);
  }, [containers]);

  useEffect(() => {
    saveStateToLocalStorage('buttonsState', buttons);
  }, [buttons]);

  const onDragStart = (e, buttonLabel) => {
    e.dataTransfer.setData('buttonLabel', buttonLabel);
  };

  const onDrop = (e, index) => {
    const buttonLabel = e.dataTransfer.getData('buttonLabel');
    if (
      !containers[index].includes(buttonLabel) &&
      containers[index].filter(label => label === buttonLabel).length === 0 &&
      containers[index].length < 4
    ) {
      const newContainers = [...containers];
      newContainers[index].push(buttonLabel);
      setContainers(newContainers);
    }
  };

  const onDoubleClick = (containerIndex, buttonLabel) => {
    const newContainers = containers.map((container, index) =>
      index === containerIndex ? container.filter((label) => label !== buttonLabel) : container
    );
    setContainers(newContainers);
  };

  const allowDrop = (e) => {
    e.preventDefault();
  };

  const addButton = () => {
    const newButton = prompt('Enter the text for the new button:');
    if (newButton) {
      setButtons((prevButtons) => [...prevButtons, newButton]);
    }
  };

  const removeButton = () => {
    const buttonToRemove = prompt('Enter the text of the button to remove:');
    setButtons((prevButtons) =>
      prevButtons.filter((button) => button !== buttonToRemove)
    );
  };

  const saveDataToLocalStorage = () => {
    const dataToSave = {
      date: selectedDate,
      containers: containers,
      fieldNames: ['וסרמיל 1', 'וסרמיל 2', 'וסרמיל 3', 'וסרמיל 4'],
      timeFrames: ['16:00 -17:45', '18:00 - 19:45', '20:00 - 21:45'],
    };

    let existingData = JSON.parse(localStorage.getItem('scheduleData')) || [];
    existingData.push(dataToSave);
    localStorage.setItem('scheduleData', JSON.stringify(existingData));
  };

  const downloadExcel = () => {
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData')) || [];
    const formattedData = scheduleData.flatMap(({ date, containers, fieldNames, timeFrames }) =>
      containers.flatMap((container, index) =>
        container.map((team) => ({
          'קבוצות': team,
          'מגרשים': fieldNames[index % 4],
          'פריסת שעות': timeFrames[Math.floor(index / 4)],
          'תאריך': new Date(date).toLocaleDateString('he-IL'),
        }))
      )
    );

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');
    XLSX.writeFile(workbook, 'schedule.xlsx');
  };

  const clearAllData = () => {
    localStorage.removeItem('scheduleData');
    setContainers(initialContainers);
  };

  const fieldTitles = ['וסרמיל 1', 'וסרמיל 2', 'וסרמיל 3', 'וסרמיל 4'];

  return (
    <div className="app">
      <h1>ניהול זמני מגרש</h1>
      <LocalizationProvider dateAdapter={AdapterDateFns} locale={he}>
        <DatePicker
          label="בחר תאריך"
          value={selectedDate}
          onChange={(date) => setSelectedDate(date)}
          renderInput={(params) => <input {...params} />}
        />
      </LocalizationProvider>
      <div className="main-content">
        <div className="grid">
          {['16:00 -17:45', '18:00 - 19:45', '20:00 - 21:45'].map(
            (title, rowIndex) => (
              <React.Fragment key={rowIndex}>
                <h2>{title}</h2>
                <div className="row">
                  {containers
                    .slice(rowIndex * 4, rowIndex * 4 + 4)
                    .map((container, index) => (
                      <div key={index} className="field-container">
                        <h3>{fieldTitles[index]}</h3>
                        <div
                          className="responsive-component"
                          onDrop={(e) => onDrop(e, rowIndex * 4 + index)}
                          onDragOver={allowDrop}
                        >
                          {container.map((label, i) => (
                            <div
                              key={i}
                              className="dropped-button"
                              onDoubleClick={() =>
                                onDoubleClick(rowIndex * 4 + index, label)
                              }
                            >
                              {label}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </React.Fragment>
            )
          )}
        </div>

        <aside className="sidebar">
          {buttons.map((button, index) => (
            <button
              key={index}
              draggable
              onDragStart={(e) => onDragStart(e, button)}
              className="draggable-button"
            >
              {button}
            </button>
          ))}
          <button className="add-button" onClick={addButton}>
            הוסף קבוצה
          </button>
          <button className="remove-button" onClick={removeButton}>
            הסר קבוצה
          </button>
          <button className="set-button" onClick={saveDataToLocalStorage}>
            Set
          </button>
          <button className="download-button" onClick={downloadExcel}>
            download excel
          </button>
          <button className="clear-button" onClick={clearAllData}>
            Clear All
          </button>
        </aside>
      </div>
    </div>
  );
};

export default App;
