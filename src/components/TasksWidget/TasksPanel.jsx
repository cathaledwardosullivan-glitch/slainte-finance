import React from 'react';
import { useTasks } from '../../context/TasksContext';
import TaskSection from './TaskSection';
import TaskItem from './TaskItem';
import {
  Activity,
  DollarSign,
  ChevronRight,
  Loader2
} from 'lucide-react';
import COLORS from '../../utils/colors';
import { getTypeColor } from '../../utils/taskUtils';

/**
 * TasksPanel - Main panel content for the Tasks widget
 * Shows collapsible sections for GMS and Financial tasks
 */
const TasksPanel = ({ onManageFinancialTasks, onManageGMSTasks, onEditTask }) => {
  const {
    isLoading,
    gmsExpanded,
    financialExpanded,
    toggleGmsSection,
    toggleFinancialSection,
    getGMSTasks,
    getFinancialTasksList
  } = useTasks();

  const gmsTasks = getGMSTasks();
  const financialTasks = getFinancialTasksList();

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}
      >
        <Loader2
          style={{
            width: '2rem',
            height: '2rem',
            color: COLORS.slainteBlue,
            animation: 'spin 1s linear infinite'
          }}
        />
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const gmsColor = getTypeColor('gms');
  const financialColor = getTypeColor('financial');

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* GMS Tasks Section */}
      <TaskSection
        title="GMS Tasks"
        icon={Activity}
        count={gmsTasks.length}
        expanded={gmsExpanded}
        onToggle={toggleGmsSection}
        color={gmsColor}
        onManage={onManageGMSTasks}
        manageLabel="Manage Tasks"
      >
        {gmsTasks.length === 0 ? (
          <EmptyState type="gms" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {gmsTasks.slice(0, 5).map(task => (
              <TaskItem key={task.id} task={task} onEdit={onEditTask} />
            ))}
            {gmsTasks.length > 5 && (
              <button
                onClick={onManageGMSTasks}
                style={{
                  padding: '0.5rem',
                  textAlign: 'center',
                  color: COLORS.slainteBlue,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                View all {gmsTasks.length} tasks →
              </button>
            )}
          </div>
        )}
      </TaskSection>

      {/* Financial Tasks Section */}
      <TaskSection
        title="Financial Tasks"
        icon={DollarSign}
        count={financialTasks.length}
        expanded={financialExpanded}
        onToggle={toggleFinancialSection}
        color={financialColor}
        onManage={onManageFinancialTasks}
        manageLabel="Manage Tasks"
      >
        {financialTasks.length === 0 ? (
          <EmptyState type="financial" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {financialTasks.slice(0, 5).map(task => (
              <TaskItem key={task.id} task={task} onEdit={onEditTask} />
            ))}
            {financialTasks.length > 5 && (
              <button
                onClick={onManageFinancialTasks}
                style={{
                  padding: '0.5rem',
                  textAlign: 'center',
                  color: COLORS.slainteBlue,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                View all {financialTasks.length} tasks →
              </button>
            )}
          </div>
        )}
      </TaskSection>

      {/* Show message when both sections are empty */}
      {gmsTasks.length === 0 && financialTasks.length === 0 && (
        <div
          style={{
            padding: '2rem 1rem',
            textAlign: 'center',
            color: COLORS.textSecondary
          }}
        >
          <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            No active tasks
          </p>
          <p style={{ fontSize: '0.75rem' }}>
            Tasks from GMS recommendations and financial action items will appear here.
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * EmptyState - Shown when a section has no tasks
 */
const EmptyState = ({ type }) => {
  return (
    <div
      style={{
        padding: '1rem',
        textAlign: 'center',
        color: COLORS.textSecondary,
        fontSize: '0.8125rem'
      }}
    >
      {type === 'gms' ? (
        <p>No active GMS tasks. Run a health check to get recommendations.</p>
      ) : (
        <p>No active financial tasks.</p>
      )}
    </div>
  );
};

export default TasksPanel;
