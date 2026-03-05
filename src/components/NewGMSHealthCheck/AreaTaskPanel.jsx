import React, { useState, useCallback, useMemo } from 'react';
import { CheckCircle2, Circle, AlertTriangle, Plus, Check, X, Target, User, Calendar } from 'lucide-react';
import COLORS from '../../utils/colors';
import { getActionItems, createActionItem, addActionItem } from '../../storage/practiceProfileStorage';
import { usePracticeProfile } from '../../hooks/usePracticeProfile';

/**
 * AreaTaskPanel - Shows actionable tasks for a single GMS area
 * Tasks come from the generateRecommendations() function, filtered per area.
 * Users can add tasks to the Tasks widget via the "Add Task" button with assignment modal.
 */
const AreaTaskPanel = ({ areaId, recommendations, canAnalyze, healthCheckData }) => {
  const [actionItems, setActionItems] = useState(() => getActionItems());
  const [taskDialogOpen, setTaskDialogOpen] = useState(null); // { recommendation, action }
  const [taskForm, setTaskForm] = useState({ assignedTo: '', dueDate: '' });
  const { profile } = usePracticeProfile();

  // Build assignee list from practice profile (same as existing Health Check)
  const assigneeList = useMemo(() => {
    const list = [];

    // Partners
    if (profile?.gps?.partners) {
      profile.gps.partners.forEach(partner => {
        list.push({ name: partner.name, role: 'Partner' });
      });
    }

    // Salaried GPs
    if (profile?.gps?.salaried) {
      profile.gps.salaried.forEach(gp => {
        list.push({ name: gp.name, role: 'Salaried GP' });
      });
    }

    // Staff from health check data
    if (healthCheckData?.staffDetails) {
      healthCheckData.staffDetails.forEach(staff => {
        list.push({
          name: `${staff.firstName} ${staff.surname}`.trim(),
          role: staff.staffType === 'nurse' ? 'Nurse' :
                staff.staffType === 'practiceManager' ? 'Practice Manager' :
                staff.staffType === 'secretary' ? 'Secretary' : staff.staffType
        });
      });
    }

    // Staff from practice profile (fallback)
    if (profile?.staff && !healthCheckData?.staffDetails?.length) {
      profile.staff.forEach(staff => {
        const name = staff.name || `${staff.firstName || ''} ${staff.surname || ''}`.trim();
        list.push({ name, role: staff.role || 'Staff' });
      });
    }

    return list;
  }, [profile, healthCheckData]);

  // Check if a specific action within a recommendation is already a task
  const isAlreadyTask = useCallback((recommendation, action) => {
    const actionTitle = action?.action || recommendation.title;
    return actionItems.some(item =>
      item.recommendationId === recommendation.id &&
      item.title === actionTitle
    );
  }, [actionItems]);

  // Open the task assignment modal
  const openTaskDialog = useCallback((recommendation, action) => {
    setTaskDialogOpen({ recommendation, action });
    setTaskForm({ assignedTo: '', dueDate: '' });
  }, []);

  // Create the task with assignment details
  const handleCreateTask = useCallback(() => {
    if (!taskDialogOpen) return;

    const { recommendation, action } = taskDialogOpen;
    const newAction = createActionItem(recommendation, action);

    // Apply form values
    newAction.assignedTo = taskForm.assignedTo || null;
    newAction.dueDate = taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null;

    addActionItem(newAction);
    setActionItems(getActionItems());
    // Notify Tasks widget to refresh (AreaTaskPanel is outside TasksProvider)
    window.dispatchEvent(new Event('tasks:refresh'));
    setTaskDialogOpen(null);
    setTaskForm({ assignedTo: '', dueDate: '' });
  }, [taskDialogOpen, taskForm]);

  if (!canAnalyze || !recommendations || recommendations.length === 0) {
    if (!canAnalyze) return null;
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: '#F0FDF4',
        borderRadius: '0.5rem',
        border: '1px solid #BBF7D0',
        fontSize: '0.875rem',
        color: '#166534',
        textAlign: 'center'
      }}>
        <CheckCircle2 style={{ width: '1.25rem', height: '1.25rem', margin: '0 auto 0.5rem' }} />
        No issues found in this area — you're on track.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {recommendations.map((rec, i) => {
          const actions = rec.actions || [];

          return (
            <div
              key={i}
              style={{
                padding: '1rem',
                backgroundColor: rec.type === 'priority' ? '#FEF2F2' : '#F0FDF4',
                borderRadius: '0.5rem',
                border: `1px solid ${rec.type === 'priority' ? '#FECACA' : '#BBF7D0'}`
              }}
            >
              {/* Recommendation header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: actions.length > 0 || rec.capacityGrantEligible ? '0.75rem' : 0 }}>
                <div style={{ flexShrink: 0, marginTop: '0.1rem' }}>
                  {rec.type === 'priority' ? (
                    <AlertTriangle style={{ width: '1rem', height: '1rem', color: COLORS.expenseColor }} />
                  ) : (
                    <Circle style={{ width: '1rem', height: '1rem', color: '#059669' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: COLORS.darkGray }}>
                    {rec.title}
                  </p>
                  {rec.summary && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: COLORS.mediumGray }}>
                      {rec.summary}
                    </p>
                  )}
                </div>
                {rec.potential > 0 && (
                  <span style={{
                    flexShrink: 0,
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: COLORS.incomeColor,
                    whiteSpace: 'nowrap'
                  }}>
                    +{'\u20AC'}{rec.potential.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Individual actions with "Add Task" buttons */}
              {actions.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  paddingLeft: '1.75rem'
                }}>
                  {actions.map((action, j) => {
                    const alreadyAdded = isAlreadyTask(rec, action);

                    return (
                      <div
                        key={j}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: COLORS.backgroundGray,
                          borderRadius: '0.375rem',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, color: COLORS.darkGray }}>
                          <span>{action.action}</span>
                          {action.value > 0 && (
                            <span style={{ marginLeft: '0.5rem', fontWeight: 600, color: COLORS.incomeColor }}>
                              ({'\u20AC'}{action.value.toLocaleString()})
                            </span>
                          )}
                        </div>

                        {/* Effort badge */}
                        {action.effort && (
                          <span style={{
                            flexShrink: 0,
                            padding: '0.125rem 0.5rem',
                            backgroundColor: action.effort === 'Low' ? '#F0FDF4' : action.effort === 'Medium' ? '#FFF7ED' : '#FEF2F2',
                            color: action.effort === 'Low' ? '#166534' : action.effort === 'Medium' ? '#9A3412' : '#991B1B',
                            borderRadius: '0.25rem',
                            fontSize: '0.7rem',
                            fontWeight: 500
                          }}>
                            {action.effort}
                          </span>
                        )}

                        {/* Add Task / Already Added button */}
                        {alreadyAdded ? (
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            flexShrink: 0,
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#F0FDF4',
                            color: '#166534',
                            borderRadius: '0.25rem',
                            fontSize: '0.7rem',
                            fontWeight: 500
                          }}>
                            <Check size={12} />
                            Added
                          </span>
                        ) : (
                          <button
                            onClick={() => openTaskDialog(rec, action)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              flexShrink: 0,
                              padding: '0.25rem 0.5rem',
                              backgroundColor: COLORS.slainteBlue,
                              color: COLORS.white,
                              border: 'none',
                              borderRadius: '0.25rem',
                              fontSize: '0.7rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'opacity 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                          >
                            <Plus size={12} />
                            Add Task
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Task Assignment Modal */}
      {taskDialogOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          backgroundColor: 'rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: '0.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '28rem',
            border: `1px solid ${COLORS.lightGray}`
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              borderBottom: `1px solid ${COLORS.lightGray}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  backgroundColor: taskDialogOpen.recommendation.type === 'priority' ? '#FEE2E2' : '#ECFDF5'
                }}>
                  <Target style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    color: taskDialogOpen.recommendation.type === 'priority' ? '#DC2626' : '#059669'
                  }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 600, fontSize: '0.9375rem', color: COLORS.darkGray }}>
                    Set as Task
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: COLORS.mediumGray }}>
                    {taskDialogOpen.recommendation.category}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTaskDialogOpen(null)}
                style={{
                  padding: '0.25rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderRadius: '0.25rem'
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem', color: COLORS.mediumGray }} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Task Description */}
              <div style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                backgroundColor: COLORS.backgroundGray
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: COLORS.darkGray }}>
                  {taskDialogOpen.action.action}
                </p>
                {taskDialogOpen.action.value > 0 && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: COLORS.incomeColor }}>
                    Potential value: {'\u20AC'}{taskDialogOpen.action.value.toLocaleString()}/yr
                  </p>
                )}
              </div>

              {/* Assign To */}
              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  marginBottom: '0.5rem',
                  color: COLORS.darkGray
                }}>
                  <User style={{ width: '1rem', height: '1rem' }} />
                  Assign to
                </label>
                <select
                  value={taskForm.assignedTo}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: `1px solid ${COLORS.lightGray}`,
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: COLORS.darkGray,
                    backgroundColor: COLORS.white,
                    outline: 'none'
                  }}
                >
                  <option value="">Select team member...</option>
                  {assigneeList.map((person, idx) => (
                    <option key={idx} value={person.name}>
                      {person.name} ({person.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  marginBottom: '0.5rem',
                  color: COLORS.darkGray
                }}>
                  <Calendar style={{ width: '1rem', height: '1rem' }} />
                  Review/Completion Date
                </label>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: `1px solid ${COLORS.lightGray}`,
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: COLORS.darkGray,
                    backgroundColor: COLORS.white,
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              padding: '1rem',
              borderTop: `1px solid ${COLORS.lightGray}`
            }}>
              <button
                onClick={() => setTaskDialogOpen(null)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  border: `1px solid ${COLORS.lightGray}`,
                  backgroundColor: COLORS.white,
                  color: COLORS.mediumGray,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  border: 'none',
                  backgroundColor: COLORS.slainteBlue,
                  color: COLORS.white,
                  cursor: 'pointer'
                }}
              >
                <Plus style={{ width: '1rem', height: '1rem' }} />
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AreaTaskPanel;
