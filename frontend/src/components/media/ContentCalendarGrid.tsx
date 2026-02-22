import { useMemo } from 'react';

interface CalendarEntry {
  id: string;
  title: string;
  scheduled_date: string;
  platform_color?: string;
  color?: string;
  status?: string;
}

interface Props {
  entries: CalendarEntry[];
  scheduledRequests: CalendarEntry[];
  onDayClick: (date: string) => void;
  onEntryClick: (entry: CalendarEntry) => void;
  currentMonth: Date;
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ContentCalendarGrid({ entries, scheduledRequests, onDayClick, onEntryClick, currentMonth }: Props) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const { days, startDay } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();

    const days: { date: string; day: number; items: CalendarEntry[] }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayItems = [
        ...entries.filter(e => e.scheduled_date?.startsWith(dateStr)),
        ...scheduledRequests.filter(r => r.scheduled_date?.startsWith(dateStr)),
      ];
      days.push({ date: dateStr, day: d, items: dayItems });
    }

    return { days, startDay };
  }, [entries, scheduledRequests, currentMonth]);

  const emptyCells = Array.from({ length: startDay }, (_, i) => i);

  return (
    <div>
      <div className="grid grid-cols-7 gap-px bg-muted-gray/30 rounded-t-lg">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-gray py-2 bg-charcoal-black">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-muted-gray/30 rounded-b-lg">
        {emptyCells.map(i => (
          <div key={`empty-${i}`} className="min-h-[80px] bg-charcoal-black/50" />
        ))}
        {days.map(({ date, day, items }) => {
          const isToday = date === todayStr;
          return (
            <div
              key={date}
              className={`min-h-[80px] p-1.5 bg-charcoal-black cursor-pointer hover:bg-muted-gray/20 transition-colors ${
                isToday ? 'ring-1 ring-accent-yellow ring-inset' : ''
              }`}
              onClick={() => onDayClick(date)}
            >
              <div className={`text-xs mb-1 ${isToday ? 'text-accent-yellow font-bold' : 'text-bone-white/70'}`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="text-[10px] leading-tight truncate rounded px-1 py-0.5 cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: (item.platform_color || item.color || '#6366f1') + '33', color: item.platform_color || item.color || '#6366f1' }}
                    onClick={(e) => { e.stopPropagation(); onEntryClick(item); }}
                    title={item.title}
                  >
                    {item.title}
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-muted-gray">+{items.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
