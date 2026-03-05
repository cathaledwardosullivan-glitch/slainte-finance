import React, { useState, useRef, useEffect } from 'react';
import { useTasks } from '../../context/TasksContext';
import {
  Check,
  Play,
  Trash2,
  Clock,
  AlertCircle,
  MoreVertical,
  Edit3
} from 'lucide-react';
import COLORS from '../../utils/colors';
import {
  getPriorityColor,
  getStatusColor,
  formatDate,
  formatCurrency,
  isTaskOverdue,
  isTaskDueSoon
} from '../../utils/taskUtils';
import ConfirmDialog from './ConfirmDialog';

/**
 * TaskItem - Individual task card in the widget
 */
const TaskItem = ({ task, onEdit }) => {
  const { completeTask, startTask, deleteTask, highlightedTaskId } = useTasks();
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null });
  const isHighlighted = highlightedTaskId === task.id;
  const cardRef = useRef(null);

  // Scroll into view when highlighted
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  const priorityColor = getPriorityColor(task.priority);
  const statusColor = getStatusColor(task.status);
  const overdue = isTaskOverdue(task);
  const dueSoon = isTaskDueSoon(task);

  const handleComplete = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    setConfirmDialog({ isOpen: true, type: 'complete' });
  };

  const handleConfirmComplete = () => {
    completeTask(task.id);
    setConfirmDialog({ isOpen: false, type: null });
  };

  const handleStart = (e) => {
    e.stopPropagation();
    startTask(task.id);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    setConfirmDialog({ isOpen: true, type: 'delete' });
  };

  const handleConfirmDelete = () => {
    setIsDeleting(true);
    deleteTask(task.id);
    setConfirmDialog({ isOpen: false, type: null });
  };

  const handleCancelDialog = () => {
    setConfirmDialog({ isOpen: false, type: null });
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onEdit) {
      onEdit(task);
    }
  };

  const handleNavigate = (e) => {
    e.stopPropagation();
    const link = task.actionLink;
    if (!link) return;

    if (link.startsWith('settings:')) {
      const section = link.split(':')[1];
      window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { section } }));
    } else if (link === 'upload') {
      window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { section: 'data' } }));
    } else if (link === 'transactions') {
      window.dispatchEvent(new CustomEvent('task:openTransactions'));
    } else if (link === 'refinement' || link === 'export') {
      window.dispatchEvent(new CustomEvent('tour:openReportsModal'));
    } else if (link === 'gms-health-check') {
      window.dispatchEvent(new CustomEvent('tour:switchToHealthCheck'));
    }
  };

  return (
    <div
      ref={cardRef}
      style={{
        backgroundColor: isHighlighted ? 'rgba(74, 144, 226, 0.08)' : COLORS.white,
        border: `1px solid ${isHighlighted ? COLORS.slainteBlue : overdue ? COLORS.expenseColor : COLORS.lightGray}`,
        borderRadius: '0.5rem',
        padding: '0.75rem',
        position: 'relative',
        transition: 'all 0.3s ease',
        opacity: isDeleting ? 0.5 : 1,
        boxShadow: isHighlighted ? `0 0 0 2px rgba(74, 144, 226, 0.3)` : 'none'
      }}
    >
      {/* Header row: Title + Actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        {/* Action button based on status */}
        {task.status === 'pending' && (
          <button
            onClick={handleStart}
            title="Start task"
            style={{
              padding: '0.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: COLORS.mediumGray,
              borderRadius: '0.25rem',
              flexShrink: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Play style={{ width: '1rem', height: '1rem' }} />
          </button>
        )}

        {task.status === 'in_progress' && (
          <button
            onClick={handleComplete}
            title="Mark complete"
            style={{
              padding: '0.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: COLORS.incomeColor,
              borderRadius: '0.25rem',
              flexShrink: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Check style={{ width: '1rem', height: '1rem' }} />
          </button>
        )}

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={task.actionLink && task.status !== 'completed' ? handleNavigate : undefined}
            style={{
              fontWeight: 500,
              fontSize: '0.8125rem',
              color: task.actionLink && task.status !== 'completed' ? COLORS.slainteBlue : COLORS.darkGray,
              lineHeight: 1.3,
              cursor: task.actionLink && task.status !== 'completed' ? 'pointer' : 'default',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {task.title}
          </div>
        </div>

        {/* Menu button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            style={{
              padding: '0.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: COLORS.mediumGray,
              borderRadius: '0.25rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <MoreVertical style={{ width: '1rem', height: '1rem' }} />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 10
                }}
                onClick={() => setShowMenu(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  backgroundColor: COLORS.white,
                  border: `1px solid ${COLORS.lightGray}`,
                  borderRadius: '0.375rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  zIndex: 20,
                  minWidth: '120px',
                  overflow: 'hidden'
                }}
              >
                {onEdit && (
                  <button
                    onClick={handleEdit}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      color: COLORS.darkGray,
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Edit3 style={{ width: '0.875rem', height: '0.875rem', color: COLORS.slainteBlue }} />
                    Edit
                  </button>
                )}
                {task.status !== 'completed' && (
                  <button
                    onClick={handleComplete}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      color: COLORS.darkGray,
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Check style={{ width: '0.875rem', height: '0.875rem', color: COLORS.incomeColor }} />
                    Complete
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    color: COLORS.expenseColor,
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Trash2 style={{ width: '0.875rem', height: '0.875rem' }} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Meta row: Status, Priority, Due date */}
      <div
        style={{
          marginTop: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}
      >
        {/* Status badge */}
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 500,
            padding: '0.125rem 0.375rem',
            borderRadius: '0.25rem',
            backgroundColor: statusColor.bg,
            color: statusColor.text,
            textTransform: 'capitalize'
          }}
        >
          {task.status.replace('_', ' ')}
        </span>

        {/* Priority badge */}
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 500,
            padding: '0.125rem 0.375rem',
            borderRadius: '0.25rem',
            backgroundColor: priorityColor.bg,
            color: priorityColor.text,
            textTransform: 'capitalize'
          }}
        >
          {task.priority}
        </span>

        {/* Due date */}
        {task.dueDate && (
          <span
            style={{
              fontSize: '0.6875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: overdue ? COLORS.expenseColor : dueSoon ? '#D97706' : COLORS.mediumGray
            }}
          >
            {overdue ? (
              <AlertCircle style={{ width: '0.75rem', height: '0.75rem' }} />
            ) : (
              <Clock style={{ width: '0.75rem', height: '0.75rem' }} />
            )}
            {formatDate(task.dueDate)}
          </span>
        )}

        {/* Potential value for GMS tasks */}
        {task.potentialValue > 0 && (
          <span
            style={{
              fontSize: '0.6875rem',
              color: COLORS.incomeColor,
              fontWeight: 500
            }}
          >
            {formatCurrency(task.potentialValue)}
          </span>
        )}
      </div>

      {/* Description preview if present */}
      {task.description && (
        <div
          style={{
            marginTop: '0.375rem',
            fontSize: '0.75rem',
            color: COLORS.mediumGray,
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}
        >
          {task.description}
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen && confirmDialog.type === 'complete'}
        onConfirm={handleConfirmComplete}
        onCancel={handleCancelDialog}
        title="Confirm Completion"
        message="Are you sure you want to mark this task as complete?"
        confirmText="Complete"
        confirmStyle="primary"
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen && confirmDialog.type === 'delete'}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDialog}
        title="Confirm Delete"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        confirmStyle="danger"
      />
    </div>
  );
};

export default TaskItem;
