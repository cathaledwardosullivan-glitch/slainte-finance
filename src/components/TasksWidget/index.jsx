import React, { useState, useEffect } from 'react';
import { useTasks } from '../../context/TasksContext';
import TasksPanel from './TasksPanel';
import FinancialTasksModal from './FinancialTasksModal';
import GMSTasksModal from './GMSTasksModal';
import { CheckSquare, Minus, Settings } from 'lucide-react';
import COLORS from '../../utils/colors';

// Yellow/gold color scheme for Tasks widget
const TASKS_COLORS = {
  primary: COLORS.warning,      // Darker gold for better contrast
  primaryDark: COLORS.warningDark,  // Hover state
  headerText: COLORS.textPrimary,   // Dark text on yellow background
  pillBg: COLORS.highlightYellow,  // Use the standard yellow
  pillText: COLORS.textPrimary      // Dark text on pill
};

/**
 * TasksWidget - Floating task management widget
 * Positioned on the right side, mirrors Finn widget on left
 */
const TasksWidget = () => {
  const {
    isOpen,
    openWidget,
    closeWidget,
    stats,
    isLoading,
    refreshTasks
  } = useTasks();

  const [showFinancialTasksModal, setShowFinancialTasksModal] = useState(false);
  const [showGMSTasksModal, setShowGMSTasksModal] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null);

  const handleTasksChanged = () => {
    refreshTasks();
  };

  // Listen for tour events and Finn task modal events
  useEffect(() => {
    const handleOpenWidget = () => openWidget();
    const handleCloseWidget = () => closeWidget();
    const handleOpenManageTasks = () => setShowFinancialTasksModal(true);
    const handleCloseManageTasks = () => setShowFinancialTasksModal(false);

    // Finn-triggered modal opens (with optional editTaskId)
    const handleOpenFinancialModal = (e) => {
      setEditTaskId(e.detail?.editTaskId || null);
      setShowFinancialTasksModal(true);
    };
    const handleOpenGMSModal = (e) => {
      setEditTaskId(e.detail?.editTaskId || null);
      setShowGMSTasksModal(true);
    };

    window.addEventListener('tour:openTasksWidget', handleOpenWidget);
    window.addEventListener('tour:closeTasksWidget', handleCloseWidget);
    window.addEventListener('tour:openManageTasksModal', handleOpenManageTasks);
    window.addEventListener('tour:closeManageTasksModal', handleCloseManageTasks);
    window.addEventListener('tasks:openFinancialModal', handleOpenFinancialModal);
    window.addEventListener('tasks:openGMSModal', handleOpenGMSModal);

    return () => {
      window.removeEventListener('tour:openTasksWidget', handleOpenWidget);
      window.removeEventListener('tour:closeTasksWidget', handleCloseWidget);
      window.removeEventListener('tour:openManageTasksModal', handleOpenManageTasks);
      window.removeEventListener('tour:closeManageTasksModal', handleCloseManageTasks);
      window.removeEventListener('tasks:openFinancialModal', handleOpenFinancialModal);
      window.removeEventListener('tasks:openGMSModal', handleOpenGMSModal);
    };
  }, [openWidget, closeWidget]);

  // Handle editing a task from the widget - opens the appropriate modal
  const handleEditTask = (task) => {
    if (task._source === 'gms' || task.type === 'gms') {
      setShowGMSTasksModal(true);
    } else {
      setShowFinancialTasksModal(true);
    }
  };

  // Collapsed pill state
  if (!isOpen) {
    return (
      <div
        style={{
          position: 'fixed',
          top: '5rem',
          right: '1.5rem',
          zIndex: 50
        }}
        data-tour-id="tasks-button"
      >
        <button
          onClick={openWidget}
          style={{
            backgroundColor: TASKS_COLORS.pillBg,
            color: TASKS_COLORS.pillText,
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            border: 'none',
            cursor: 'pointer',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = TASKS_COLORS.primary;
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = TASKS_COLORS.pillBg;
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <CheckSquare style={{ height: '1.5rem', width: '1.5rem' }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tasks</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Action Items</div>
          </div>

          {/* Badge for overdue tasks */}
          {stats.overdue > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '20px',
                height: '20px',
                backgroundColor: COLORS.expenseColor,
                color: COLORS.white,
                borderRadius: '9999px',
                border: '2px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0 4px'
              }}
            >
              {stats.overdue}
            </div>
          )}
        </button>
      </div>
    );
  }

  // Expanded widget
  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: '5rem',
          right: '1.5rem',
          bottom: '5.5rem', // Leave space for settings button area
          zIndex: 50,
          backgroundColor: COLORS.white,
          borderRadius: '0.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: `1px solid ${COLORS.borderLight}`,
          width: 'min(400px, calc(100vw - 3rem))',
          maxHeight: 'calc(100vh - 7rem)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        data-tour-id="tasks-widget"
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: TASKS_COLORS.pillBg,
            color: TASKS_COLORS.headerText,
            padding: '0.875rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2rem',
                height: '2rem',
                backgroundColor: TASKS_COLORS.primary,
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CheckSquare style={{ height: '1rem', width: '1rem' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Tasks</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {stats.pending + stats.inProgress} active
                {stats.overdue > 0 && (
                  <span style={{ color: COLORS.expenseColor, marginLeft: '0.5rem', fontWeight: 600 }}>
                    • {stats.overdue} overdue
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {/* Minimize button */}
            <button
              onClick={closeWidget}
              title="Minimize"
              style={{
                color: TASKS_COLORS.headerText,
                padding: '0.375rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '0.375rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Minus style={{ height: '1.125rem', width: '1.125rem' }} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TasksPanel
            onManageFinancialTasks={() => setShowFinancialTasksModal(true)}
            onManageGMSTasks={() => setShowGMSTasksModal(true)}
            onEditTask={handleEditTask}
          />
        </div>
      </div>

      {/* Financial Tasks Modal */}
      <FinancialTasksModal
        isOpen={showFinancialTasksModal}
        onClose={() => { setShowFinancialTasksModal(false); setEditTaskId(null); }}
        onTasksChanged={handleTasksChanged}
        autoEditTaskId={editTaskId}
      />

      {/* GMS Tasks Modal */}
      <GMSTasksModal
        isOpen={showGMSTasksModal}
        onClose={() => { setShowGMSTasksModal(false); setEditTaskId(null); }}
        onTasksChanged={handleTasksChanged}
        autoEditTaskId={editTaskId}
      />
    </>
  );
};

export default TasksWidget;
