import React, { useState, useEffect } from 'react';
import './App.css';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { he } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { Button, ButtonGroup, Container } from 'react-bootstrap';

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
  const [selectedDate, setSelectedDate] = useState(new Date());

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

        <Container className="sidebar p-2 bg-light border">
          {buttons.map((button, index) => (
            <Button
              key={index}
              draggable
              onDragStart={(e) => onDragStart(e, button)}
              className="draggable-button my-2"
              variant="outline-secondary"
            >
              {button}
            </Button>
          ))}
          <ButtonGroup vertical>
            <Button className="add-button my-2" onClick={addButton} variant="primary">
              הוסף קבוצה
            </Button>
            <Button className="remove-button my-2" onClick={removeButton} variant="danger">
              הסר קבוצה
            </Button>
            <Button className="set-button my-2" onClick={saveDataToLocalStorage} variant="success">
              Set
            </Button>
            <Button className="download-button my-2" onClick={downloadExcel} variant="info">
              download excel
            </Button>
            <Button className="clear-button my-2" onClick={clearAllData} variant="warning">
              Clear All
            </Button>
          </ButtonGroup>
        </Container>
      </div>
    </div>
  );
};


export default App;
