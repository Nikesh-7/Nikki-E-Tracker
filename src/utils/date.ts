export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

export function formatDate(
  dateInput: string | Date,
  format: DateFormat = 'YYYY-MM-DD',
  includeTime: boolean = false
): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  let datePart = '';
  switch (format) {
    case 'DD/MM/YYYY':
      datePart = `${day}/${month}/${year}`;
      break;
    case 'MM/DD/YYYY':
      datePart = `${month}/${day}/${year}`;
      break;
    case 'YYYY-MM-DD':
    default:
      datePart = `${year}-${month}-${day}`;
      break;
  }

  if (includeTime) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${datePart} ${hours}:${minutes}`;
  }

  return datePart;
}

export function toISODateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toISODateTimeString(date: Date = new Date()): string {
  return date.toISOString();
}

export function getMonthYearLabel(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

export interface CalendarDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function getCalendarGrid(year: number, month: number, weekStartsOn: 0 | 1 = 0): CalendarDay[] {
  const days: CalendarDay[] = [];
  const todayStr = toISODateString(new Date());

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let startPadding = firstDayOfMonth.getDay() - weekStartsOn;
  if (startPadding < 0) startPadding += 7;

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startPadding - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDay - i);
    const dateStr = toISODateString(d);
    days.push({
      date: d,
      dateStr,
      dayNumber: d.getDate(),
      isCurrentMonth: false,
      isToday: dateStr === todayStr
    });
  }

  // Current month days
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    const d = new Date(year, month, i);
    const dateStr = toISODateString(d);
    days.push({
      date: d,
      dateStr,
      dayNumber: i,
      isCurrentMonth: true,
      isToday: dateStr === todayStr
    });
  }

  // Next month leading days (fill up to complete weeks, e.g. 35 or 42 cells)
  const remainingCells = 7 - (days.length % 7);
  if (remainingCells < 7) {
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = toISODateString(d);
      days.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr
      });
    }
  }

  return days;
}
