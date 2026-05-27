import { useMemo, useState } from 'react';
import { useSolarOps } from '../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, PageHeader, Panel, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '../../shared/ui/primitives';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { titleize } from '../../shared/utils/format';

export function CalendarPage() {
  const { state } = useSolarOps();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return state.calendarEvents;
    return state.calendarEvents.filter((event) => new Date(event.startAt).toDateString() === selectedDate.toDateString());
  }, [selectedDate, state.calendarEvents]);

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description="Survey and installation scheduling. Survey scheduling is created from Deals." />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel title="Schedule picker">
          <DateCalendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="rounded-lg border" />
        </Panel>
        <Panel title="Survey and installation events">
          {state.calendarEvents.length ? (
            selectedEvents.length ? (
              <TableWrap>
                <Table>
                  <TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Type</TableHead><TableHead>Start</TableHead><TableHead>Location</TableHead></TableRow></TableHeader>
                  <TableBody>{selectedEvents.map((event) => <TableRow key={event.id}><TableCell className="font-medium">{event.title}</TableCell><TableCell><Badge tone="info">{titleize(event.type)}</Badge></TableCell><TableCell>{new Date(event.startAt).toLocaleString()}</TableCell><TableCell>{event.location}</TableCell></TableRow>)}</TableBody>
                </Table>
              </TableWrap>
            ) : <EmptyState text="No events on the selected date." />
          ) : <EmptyState text="No calendar events yet. Schedule a survey from a deal." />}
        </Panel>
      </div>
    </div>
  );
}
