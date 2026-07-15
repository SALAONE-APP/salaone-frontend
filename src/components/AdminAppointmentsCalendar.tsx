import { useState } from 'react';
import { APPOINTMENT_CLIENT_STATUS_CONFIG, getStableCalendarColor, CALENDAR_END_MINUTES } from '@/utils/adminCalendar';
import type { CalendarAppointment, CalendarColor, FreeSlot } from '@/utils/adminCalendar';
import type { Professional } from '@/service/professionalService';
import type { Appointment } from '@/service/appointmentService';
import './AdminAppointmentsCalendar.css';

const minutesToTime = (mins: number): string => {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
};

const formatDateBR = (date: Date | null): string => {
  if (!date) return '';
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getAppointmentClientInfo = (appointment: CalendarAppointment) => {
  const clientName = typeof (appointment as any).client === 'string'
    ? (appointment as any).client
    : appointment.client?.name || (appointment as any).clientName || 'Cliente';

  const dependentName = typeof (appointment as any).dependent === 'string'
    ? (appointment as any).dependent
    : appointment.dependent?.name || (appointment as any).dependentName || '';

  const isDependentAppointment = Boolean(
    appointment.dependentId ||
    dependentName ||
    (appointment as any).dependent?.id ||
    (appointment as any).dependent_id,
  );

  return { clientName, dependentName, isDependentAppointment };
};

interface AptModalState {
  appointment: CalendarAppointment;
  professional: Professional;
  calDate: Date | null;
  clientName: string;
  dependentName: string;
  isDependentAppointment: boolean;
  servicesNames: string;
}

interface Props {
  activeDateLabel: string;
  activeDateKey: string;
  appointmentDateFilter: Date | null;
  professionals: Professional[];
  professionalColors: Map<string, CalendarColor>;
  timeSlots: string[];
  appointmentsByProfessional: Map<string, CalendarAppointment[]>;
  freeSlotsByProfessional: Map<string, FreeSlot[]>;
  bodyHeight: number;
  slotHeight: number;
  minutesPerSlot: number;
  startMinutes: number;
  nowMinutes?: number | null;
  onFreeFitBooking: (professionalId: string, date: Date, startMinutes: number, durationMinutes: number) => void;
  getAppointmentStartDate: (appointment: Appointment) => Date | null;
}

export default function AdminAppointmentsCalendar({
  activeDateLabel,
  activeDateKey,
  appointmentDateFilter,
  professionals,
  professionalColors,
  timeSlots,
  appointmentsByProfessional,
  freeSlotsByProfessional,
  bodyHeight,
  slotHeight,
  minutesPerSlot,
  startMinutes,
  nowMinutes,
  onFreeFitBooking,
  getAppointmentStartDate,
}: Props) {
  const [aptModal, setAptModal] = useState<AptModalState | null>(null);
  const statusLegend = [
    APPOINTMENT_CLIENT_STATUS_CONFIG.no_show,
    APPOINTMENT_CLIENT_STATUS_CONFIG.no_plan,
    APPOINTMENT_CLIENT_STATUS_CONFIG.with_plan,
    APPOINTMENT_CLIENT_STATUS_CONFIG.overdue,
    APPOINTMENT_CLIENT_STATUS_CONFIG.in_progress,
    APPOINTMENT_CLIENT_STATUS_CONFIG.completed,
  ];

  const getAppointmentRangeMinutes = (appointment: CalendarAppointment) => {
    const [aptH, aptM] = String(appointment.startTime || '00:00').split(':').map(Number);
    const aptStart = (aptH ?? 0) * 60 + (aptM ?? 0);
    const aptDuration = Number(appointment.duration || 0);
    const aptEnd = aptStart + aptDuration;

    if (!Number.isFinite(aptStart) || !Number.isFinite(aptEnd) || aptDuration <= 0 || aptEnd <= aptStart) {
      return null;
    }
    return { startMinutes: aptStart, endMinutes: aptEnd };
  };

  const shouldShowFreeSlotBetweenAppointments = (freeSlot: FreeSlot, appointments: CalendarAppointment[]): boolean => {
    const freeStart = Number(freeSlot.startMinutes);
    const freeDuration = Number(freeSlot.durationMinutes);
    const freeEnd = freeStart + freeDuration;

    if (!Number.isFinite(freeStart) || !Number.isFinite(freeEnd) || freeDuration <= 0 || freeEnd <= freeStart) {
      return false;
    }

    const ranges = appointments.map(getAppointmentRangeMinutes).filter(Boolean).sort((a, b) => a!.startMinutes - b!.startMinutes) as { startMinutes: number; endMinutes: number }[];

    if (ranges.length < 2) return false;

    const hasAppointmentBefore = ranges.some((r) => r.endMinutes <= freeStart);
    const hasAppointmentAfter = ranges.some((r) => r.startMinutes >= freeEnd);
    const overlapsAppointment = ranges.some((r) => freeStart < r.endMinutes && freeEnd > r.startMinutes);

    return hasAppointmentBefore && hasAppointmentAfter && !overlapsAppointment;
  };

  return (
    <>
      <div className="calendar-grid-container" style={{ marginTop: '1.5rem' }}>
        <div className="calendar-active-day">
          <strong>{activeDateLabel || 'Dia não informado'}</strong>
          {!appointmentDateFilter && (
            <span>
              Exibindo o primeiro dia com agendamento. Use o filtro "Data Específica" para abrir outro dia.
            </span>
          )}
        </div>

        <div className="calendar-grid-scroll-shell">
          <div className="calendar-grid-inner" style={{ minWidth: `${64 + professionals.length * 180}px` }}>
            {/* Header */}
            <div
              className="calendar-grid-header"
              style={{ gridTemplateColumns: `64px repeat(${professionals.length}, minmax(180px, 1fr))` }}
            >
              <div className="calendar-grid-corner">Horário</div>
              {professionals.map((professional, professionalIndex) => {
                const professionalPhoto = (professional as any).photo || (professional as any).avatar || professional.photoUrl || '';
                const professionalInitial = String(professional.displayName || '').trim().charAt(0).toUpperCase() || '?';
                const professionalColor = professionalColors.get(professional.id) || getStableCalendarColor(professional, professionalIndex);

                return (
                  <div
                    key={professional.id}
                    className="calendar-grid-professional-header"
                    style={{
                      '--professional-accent': professionalColor.accent,
                      '--professional-tint': professionalColor.tintStrong,
                      '--professional-border': professionalColor.border,
                    } as React.CSSProperties}
                  >
                    {professionalPhoto ? (
                      <img
                        src={professionalPhoto}
                        alt={professional.displayName}
                        className="calendar-professional-photo"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.setAttribute('style', 'display:flex');
                        }}
                      />
                    ) : null}
                    <div
                      className="calendar-professional-photo-fallback"
                      style={{ display: professionalPhoto ? 'none' : 'flex' }}
                    >
                      {professionalInitial}
                    </div>
                    <span className="calendar-professional-name">{professional.displayName}</span>
                  </div>
                );
              })}
            </div>

            {/* Scroll area */}
            <div className="calendar-grid-scroll-area" style={{ '--calendar-body-height': `${bodyHeight}px` } as React.CSSProperties}>
              <div className="calendar-grid-body">
                {/* Time rows */}
                {timeSlots.map((timeSlot) => {
                  const [slotH, slotM] = timeSlot.split(':').map(Number);
                  const isHourMark = slotM === 0;
                  const isHalfMark = slotM === 30;
                  const isTenMark  = !isHourMark && !isHalfMark && (slotM ?? 0) % 10 === 0;
                  const timeLabelType = isHourMark ? 'time-hour' : isHalfMark ? 'time-half' : isTenMark ? 'time-ten' : 'time-five';

                  const slotDate = activeDateKey ? new Date(`${activeDateKey}T00:00:00`) : null;
                  const isPast = slotDate ? (() => {
                    const dt = new Date(slotDate);
                    dt.setHours(slotH ?? 0, slotM ?? 0, 0, 0);
                    return dt < new Date();
                  })() : false;

                  const timeLabel = isHourMark || isHalfMark
                    ? timeSlot
                    : isTenMark
                      ? `:${String(slotM).padStart(2, '0')}`
                      : '';

                  return (
                    <div
                      key={timeSlot}
                      className={`calendar-grid-row ${timeLabelType}${isPast ? ' past-slot' : ''}`}
                      style={{ gridTemplateColumns: `64px repeat(${professionals.length}, minmax(180px, 1fr))` }}
                    >
                      <div className={`calendar-time-cell ${timeLabelType}`}>{timeLabel}</div>
                      {professionals.map((professional) => {
                        const professionalColor = professionalColors.get(professional.id) || getStableCalendarColor(professional);
                        return (
                          <div
                            key={professional.id}
                            className="calendar-slot-cell"
                            style={{ '--professional-accent': professionalColor.accent, '--professional-tint': professionalColor.tint, '--professional-border': professionalColor.border } as React.CSSProperties}
                          />
                        );
                      })}
                    </div>
                  );
                })}

                {/* Linha do horário atual */}
                {nowMinutes != null && nowMinutes >= startMinutes && nowMinutes <= startMinutes + (timeSlots.length * minutesPerSlot) && (
                  <div
                    className="calendar-current-time"
                    style={{
                      top: `${((nowMinutes - startMinutes) / minutesPerSlot) * slotHeight}px`,
                      left: '64px',
                    }}
                  />
                )}

                {/* Appointments layer */}
                <div
                  className="calendar-appointments-layer"
                  style={{ gridTemplateColumns: `64px repeat(${professionals.length}, minmax(180px, 1fr))`, height: `${bodyHeight}px` }}
                >
                  <div className="calendar-appointments-layer-spacer" />

                  {professionals.map((professional) => {
                    const professionalApts = appointmentsByProfessional.get(professional.id) || [];
                    const rawFreeSlots = freeSlotsByProfessional.get(professional.id) || [];
                    const professionalFreeSlots = rawFreeSlots.filter((fs) => shouldShowFreeSlotBetweenAppointments(fs, professionalApts));

                    const calDate = activeDateKey ? new Date(`${activeDateKey}T00:00:00`) : null;
                    const regularApts = professionalApts.filter((a) => !a.isFitAppointment);
                    const fitApts = professionalApts.filter((a) => a.isFitAppointment);

                    const aptOverlapsRegular = (apt: CalendarAppointment): boolean => {
                      const [fh, fm] = String(apt.startTime || '00:00').split(':').map(Number);
                      const fStart = (fh ?? 0) * 60 + (fm ?? 0);
                      const fEnd = fStart + Number(apt.duration || 0);
                      return regularApts.some((r) => {
                        const [rh, rm] = String(r.startTime || '00:00').split(':').map(Number);
                        const rStart = (rh ?? 0) * 60 + (rm ?? 0);
                        const rEnd = rStart + Number(r.duration || 0);
                        return fStart < rEnd && fEnd > rStart;
                      });
                    };

                    const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>) => {
                      if (!calDate) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relativeY = e.clientY - rect.top;
                      const rawMinutes = startMinutes + Math.floor(relativeY / slotHeight) * minutesPerSlot;
                      const clickedMinutes = Math.max(
                        startMinutes,
                        Math.min(CALENDAR_END_MINUTES - minutesPerSlot, rawMinutes),
                      );

                      const clickedDate = new Date(calDate);
                      clickedDate.setHours(Math.floor(clickedMinutes / 60), clickedMinutes % 60, 0, 0);
                      if (clickedDate < new Date()) return;

                      const professionalApts = appointmentsByProfessional.get(professional.id) ?? [];
                      const nextAptStart = professionalApts
                        .map((apt) => {
                          const [h, m] = String(apt.startTime ?? '00:00').split(':').map(Number);
                          return (h ?? 0) * 60 + (m ?? 0);
                        })
                        .filter((s) => s > clickedMinutes)
                        .sort((a, b) => a - b)[0];

                      const maxAvail = nextAptStart != null
                        ? nextAptStart - clickedMinutes
                        : CALENDAR_END_MINUTES - clickedMinutes;
                      const duration = Math.max(5, Math.min(maxAvail, 60));

                      onFreeFitBooking(professional.id, calDate, clickedMinutes, duration);
                    };

                    return (
                      <div key={professional.id} className="calendar-appointments-column" style={{ cursor: 'pointer' }} onClick={handleColumnClick}>
                        {/* Free fit slots */}
                        {professionalFreeSlots.map((freeSlot, freeIdx) => {
                          const freeTop = ((freeSlot.startMinutes - startMinutes) / minutesPerSlot) * slotHeight;
                          const freeHeight = (freeSlot.durationMinutes / minutesPerSlot) * slotHeight;

                          const isFreeFitPast = calDate ? (() => {
                            const dt = new Date(calDate);
                            dt.setHours(Math.floor(freeSlot.startMinutes / 60), freeSlot.startMinutes % 60, 0, 0);
                            return dt < new Date();
                          })() : false;

                          return (
                            <div
                              key={`free-${freeIdx}`}
                              className={`calendar-free-fit${isFreeFitPast ? ' past-free-fit' : ''}`}
                              style={{ top: `${freeTop}px`, height: `${freeHeight}px` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isFreeFitPast || !calDate) return;
                                onFreeFitBooking(professional.id, calDate, freeSlot.startMinutes, freeSlot.durationMinutes);
                              }}
                            >
                              Agenda livre &bull; {freeSlot.durationMinutes} min
                            </div>
                          );
                        })}

                        {/* Fit appointments */}
                        {fitApts.map((appointment) => {
                          const [aptH, aptM] = appointment.startTime.split(':').map(Number);
                          const aptMinutes = (aptH ?? 0) * 60 + (aptM ?? 0);
                          if (!Number.isFinite(aptMinutes)) return null;

                          const eventTop = ((aptMinutes - startMinutes) / minutesPerSlot) * slotHeight;
                          const eventHeight = Math.max(14, (appointment.duration / minutesPerSlot) * slotHeight);

                          const aptDate = getAppointmentStartDate(appointment);
                          const isAptPast = aptDate ? aptDate < new Date() : false;

                          const servicesNames = Array.isArray(appointment.services)
                            ? appointment.services.map((s) => (s as any).serviceName || (s as any).name).join(', ')
                            : '-';
                          const { clientName, dependentName, isDependentAppointment } = getAppointmentClientInfo(appointment);
                          const displayClientName = isDependentAppointment && dependentName ? dependentName : clientName;

                          const hasOverlap = aptOverlapsRegular(appointment);

                          return (
                            <div
                              key={appointment.id}
                              className={`calendar-appointment-card fit-appointment${hasOverlap ? ' fit-overlapping' : ''}${isAptPast ? ' past-appointment' : ''}${isDependentAppointment ? ' dependent-appointment' : ''}`}
                              style={{
                                top: `${eventTop}px`,
                                height: `${eventHeight}px`,
                                left: '4px',
                                right: hasOverlap ? '0' : '4px',
                                zIndex: 2,
                                backgroundColor: appointment.color.cardBg,
                                color: appointment.color.cardText,
                                borderColor: appointment.color.border,
                                borderLeftColor: appointment.color.accent,
                                boxShadow: `0 4px 14px rgba(0,0,0,0.24), inset 0 1px 0 ${appointment.color.border}`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isAptPast) setAptModal({ appointment, professional, calDate, clientName, dependentName, isDependentAppointment, servicesNames });
                              }}
                            >
                              {eventHeight <= 28 ? (
                                <div className="apt-inline-summary">
                                  <span className="apt-time">{appointment.startTime}</span>
                                  {isDependentAppointment && <span className="apt-dependent-dot" title="Agendamento de dependente">Dep.</span>}
                                  <span className="apt-client">{displayClientName}</span>
                                </div>
                              ) : (
                                <>
                                  <div className="apt-time">{appointment.startTime} • {appointment.duration} min</div>
                                  <div className="apt-client-line">
                                    <span className="apt-client">{displayClientName}</span>
                                    {isDependentAppointment && <span className="apt-dependent-badge">Dependente</span>}
                                  </div>
                                  {isDependentAppointment && dependentName && eventHeight >= 56 && (
                                    <div className="apt-holder">Titular: {clientName}</div>
                                  )}
                                </>
                              )}
                              {eventHeight >= 42 && <div className="apt-service">{servicesNames}</div>}
                              {eventHeight >= 70 && appointment.visibleNotes && <div className="apt-observation">📝 {appointment.visibleNotes}</div>}
                            </div>
                          );
                        })}

                        {/* Regular appointments */}
                        {regularApts.map((appointment) => {
                          const [aptH, aptM] = appointment.startTime.split(':').map(Number);
                          const aptMinutes = (aptH ?? 0) * 60 + (aptM ?? 0);
                          if (!Number.isFinite(aptMinutes)) return null;

                          const eventTop = ((aptMinutes - startMinutes) / minutesPerSlot) * slotHeight;
                          const eventHeight = Math.max(14, (appointment.duration / minutesPerSlot) * slotHeight);

                          const aptDate = getAppointmentStartDate(appointment);
                          const isAptPast = aptDate ? aptDate < new Date() : false;

                          const servicesNames = Array.isArray(appointment.services)
                            ? appointment.services.map((s) => (s as any).serviceName || (s as any).name).join(', ')
                            : '-';
                          const { clientName, dependentName, isDependentAppointment } = getAppointmentClientInfo(appointment);
                          const displayClientName = isDependentAppointment && dependentName ? dependentName : clientName;

                          return (
                            <div
                              key={appointment.id}
                              className={`calendar-appointment-card${isAptPast ? ' past-appointment' : ''}${isDependentAppointment ? ' dependent-appointment' : ''}`}
                              style={{
                                top: `${eventTop}px`,
                                height: `${eventHeight}px`,
                                zIndex: 3,
                                backgroundColor: appointment.color.cardBg,
                                color: appointment.color.cardText,
                                borderColor: appointment.color.border,
                                borderLeftColor: appointment.color.accent,
                                boxShadow: `0 4px 14px rgba(0,0,0,0.24), inset 0 1px 0 ${appointment.color.border}`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isAptPast) setAptModal({ appointment, professional, calDate, clientName, dependentName, isDependentAppointment, servicesNames });
                              }}
                            >
                              {eventHeight <= 28 ? (
                                <div className="apt-inline-summary">
                                  <span className="apt-time">{appointment.startTime}</span>
                                  {isDependentAppointment && <span className="apt-dependent-dot" title="Agendamento de dependente">Dep.</span>}
                                  <span className="apt-client">{displayClientName}</span>
                                </div>
                              ) : (
                                <>
                                  <div className="apt-time">{appointment.startTime} • {appointment.duration} min</div>
                                  <div className="apt-client-line">
                                    <span className="apt-client">{displayClientName}</span>
                                    {isDependentAppointment && <span className="apt-dependent-badge">Dependente</span>}
                                  </div>
                                  {isDependentAppointment && dependentName && eventHeight >= 56 && (
                                    <div className="apt-holder">Titular: {clientName}</div>
                                  )}
                                </>
                              )}
                              {eventHeight >= 42 && <div className="apt-service">{servicesNames}</div>}
                              {eventHeight >= 70 && appointment.visibleNotes && <div className="apt-observation">📝 {appointment.visibleNotes}</div>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {aptModal && (() => {
        const { appointment, professional, calDate, clientName, dependentName, isDependentAppointment, servicesNames } = aptModal;
        const aptEndMinutes = (() => {
          const [h, m] = String(appointment.startTime || '00:00').split(':').map(Number);
          return (h ?? 0) * 60 + (m ?? 0) + Number(appointment.duration || 0);
        })();

        return (
          <div className="apt-detail-overlay" onClick={() => setAptModal(null)}>
            <div
              className={`apt-detail-modal${appointment.isFitAppointment ? ' apt-detail-fit' : ''}${isDependentAppointment ? ' apt-detail-dependent' : ''}`}
              style={{ '--apt-accent': appointment.color?.accent || '#d4af37' } as React.CSSProperties}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="apt-detail-header">
                <div className="apt-detail-header-left">
                  {appointment.isFitAppointment && <span className="apt-detail-fit-badge">Agenda</span>}
                  {isDependentAppointment && <span className="apt-detail-dependent-badge">Dependente</span>}
                  <h3 className="apt-detail-title">Detalhes do Agendamento</h3>
                </div>
                <button className="apt-detail-close" onClick={() => setAptModal(null)} aria-label="Fechar">×</button>
              </div>

              {appointment.isFitAppointment && (
                <div className="apt-detail-fit-notice">Agendamento criado pela agenda</div>
              )}

              <div className="apt-detail-body">
                <div className="apt-detail-status-card">
                  <span
                    className="apt-detail-status-dot"
                    style={{ background: appointment.clientStatus.color.accent }}
                  />
                  <div>
                    <span className="apt-detail-status-label">Status do cliente</span>
                    <strong>{appointment.clientStatus.label}</strong>
                    <span>{appointment.clientStatus.description}</span>
                  </div>
                </div>
                <div className="apt-detail-row">
                  <span className="apt-detail-label">Cliente</span>
                  <span className="apt-detail-value">{isDependentAppointment && dependentName ? dependentName : clientName}</span>
                </div>
                {isDependentAppointment && (
                  <div className="apt-detail-row">
                    <span className="apt-detail-label">Titular</span>
                    <span className="apt-detail-value">{clientName}</span>
                  </div>
                )}
                <div className="apt-detail-row">
                  <span className="apt-detail-label">Profissional</span>
                  <span className="apt-detail-value">{professional.displayName}</span>
                </div>
                <div className="apt-detail-row">
                  <span className="apt-detail-label">Serviço</span>
                  <span className="apt-detail-value">{servicesNames || '—'}</span>
                </div>
                <div className="apt-detail-row">
                  <span className="apt-detail-label">Data</span>
                  <span className="apt-detail-value">{calDate ? formatDateBR(calDate) : '—'}</span>
                </div>
                <div className="apt-detail-row">
                  <span className="apt-detail-label">Horário</span>
                  <span className="apt-detail-value">{appointment.startTime} – {minutesToTime(aptEndMinutes)}</span>
                </div>
                <div className="apt-detail-row">
                  <span className="apt-detail-label">Duração</span>
                  <span className="apt-detail-value">{appointment.duration} min</span>
                </div>
                {appointment.visibleNotes && (
                  <div className="apt-detail-row apt-detail-notes-row">
                    <span className="apt-detail-label">Observação</span>
                    <span className="apt-detail-value apt-detail-notes">{appointment.visibleNotes}</span>
                  </div>
                )}
              </div>

              <div className="apt-detail-footer">
                <details className="apt-detail-legend">
                  <summary>Legenda de cores</summary>
                  <div className="apt-detail-legend-list">
                    {statusLegend.map((item) => (
                      <div key={item.key} className="apt-detail-legend-item">
                        <span
                          className="apt-detail-legend-swatch"
                          style={{
                            background: item.color.cardBg,
                            borderColor: item.color.border,
                            borderLeftColor: item.color.accent,
                          }}
                        />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </details>
                <button className="apt-detail-btn-close" onClick={() => setAptModal(null)}>Fechar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
