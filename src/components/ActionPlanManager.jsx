import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Clock,
  AlertCircle,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Edit3,
  Target,
  TrendingUp,
  CheckCircle,
  Play,
  Pause,
  Eye,
  EyeOff,
  Save
} from 'lucide-react';
import COLORS from '../utils/colors';
import {
  getActionItems,
  saveActionItems,
  createActionItem,
  updateActionItem,
  deleteActionItem
} from '../storage/practiceProfileStorage';

/**
 * ActionPlanManager - Modal component for managing action items
 * Allows converting recommendations to actionable tasks with assignments and tracking
 */
export default function ActionPlanManager({
  isOpen,
  onClose,
  recommendations = [],
  staffList = [],
  onActionPlanUpdated
}) {
  const [actions, setActions] = useState([]);
  const [expandedActions, setExpandedActions] = useState({});
  const [editingAction, setEditingAction] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'in_progress', 'completed'
  const [showAddFromRecommendation, setShowAddFromRecommendation] = useState(false);

  // Load actions on mount
  useEffect(() => {
    if (isOpen) {
      loadActions();
    }
  }, [isOpen]);

  const loadActions = () => {
    const savedActions = getActionItems();
    setActions(savedActions);
  };

  const handleSaveActions = (updatedActions) => {
    saveActionItems(updatedActions);
    setActions(updatedActions);
    if (onActionPlanUpdated) {
      onActionPlanUpdated(updatedActions);
    }
  };

  const handleAddFromRecommendation = (recommendation, specificAction = null) => {
    const newAction = createActionItem(recommendation, specificAction);
    const updatedActions = [...actions, newAction];
    handleSaveActions(updatedActions);
    setShowAddFromRecommendation(false);
  };

  const handleAddAllFromRecommendation = (recommendation) => {
    // Add each action item from the recommendation as a separate action
    const newActions = recommendation.actions.map(action =>
      createActionItem(recommendation, action)
    );
    const updatedActions = [...actions, ...newActions];
    handleSaveActions(updatedActions);
    setShowAddFromRecommendation(false);
  };

  const handleUpdateAction = (actionId, updates) => {
    const updatedActions = actions.map(action => {
      if (action.id === actionId) {
        const updated = { ...action, ...updates };
        if (updates.status === 'completed' && !action.completedDate) {
          updated.completedDate = new Date().toISOString();
        }
        if (updates.status && updates.status !== 'completed') {
          updated.completedDate = null;
        }
        return updated;
      }
      return action;
    });
    handleSaveActions(updatedActions);
    setEditingAction(null);
  };

  const handleDeleteAction = (actionId) => {
    if (window.confirm('Are you sure you want to delete this action item?')) {
      const updatedActions = actions.filter(action => action.id !== actionId);
      handleSaveActions(updatedActions);
    }
  };

  const toggleExpanded = (actionId) => {
    setExpandedActions(prev => ({
      ...prev,
      [actionId]: !prev[actionId]
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#059669';
      case 'in_progress': return '#F59E0B';
      case 'pending': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'in_progress': return <Play className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const filteredActions = actions.filter(action => {
    if (filter === 'all') return true;
    return action.status === filter;
  });

  // Sort: priority first, then by due date
  const sortedActions = [...filteredActions].sort((a, b) => {
    if (a.type === 'priority' && b.type !== 'priority') return -1;
    if (a.type !== 'priority' && b.type === 'priority') return 1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return 0;
  });

  // Calculate summary stats
  const stats = {
    total: actions.length,
    pending: actions.filter(a => a.status === 'pending').length,
    inProgress: actions.filter(a => a.status === 'in_progress').length,
    completed: actions.filter(a => a.status === 'completed').length,
    totalPotential: actions.reduce((sum, a) => sum + (a.potentialValue || 0), 0),
    completedPotential: actions
      .filter(a => a.status === 'completed')
      .reduce((sum, a) => sum + (a.potentialValue || 0), 0)
  };

  // Get recommendations that haven't been added yet
  const availableRecommendations = recommendations.filter(rec => {
    const existingIds = actions.map(a => a.recommendationId);
    return !existingIds.includes(rec.id);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        style={{ border: `1px solid ${COLORS.lightGray}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: COLORS.lightGray }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.slainteBlue + '20' }}>
              <Target className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: COLORS.darkGray }}>
                Action Plan
              </h2>
              <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                Track and manage your health check recommendations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" style={{ color: COLORS.mediumGray }} />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 p-4 border-b" style={{ borderColor: COLORS.lightGray, backgroundColor: COLORS.backgroundGray }}>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: COLORS.slainteBlue }}>{stats.total}</p>
            <p className="text-xs" style={{ color: COLORS.mediumGray }}>Total Actions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{stats.inProgress}</p>
            <p className="text-xs" style={{ color: COLORS.mediumGray }}>In Progress</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#059669' }}>{stats.completed}</p>
            <p className="text-xs" style={{ color: COLORS.mediumGray }}>Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: COLORS.incomeColor }}>
              {formatCurrency(stats.completedPotential)}
            </p>
            <p className="text-xs" style={{ color: COLORS.mediumGray }}>
              of {formatCurrency(stats.totalPotential)} recovered
            </p>
          </div>
        </div>

        {/* Filter & Add Buttons */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: COLORS.lightGray }}>
          <div className="flex gap-2">
            {['all', 'pending', 'in_progress', 'completed'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === status ? 'text-white' : ''
                }`}
                style={{
                  backgroundColor: filter === status ? COLORS.slainteBlue : COLORS.backgroundGray,
                  color: filter === status ? 'white' : COLORS.mediumGray
                }}
              >
                {status === 'all' ? 'All' :
                 status === 'pending' ? 'Pending' :
                 status === 'in_progress' ? 'In Progress' : 'Completed'}
              </button>
            ))}
          </div>
          {availableRecommendations.length > 0 && (
            <button
              onClick={() => setShowAddFromRecommendation(!showAddFromRecommendation)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: COLORS.slainteBlue }}
            >
              <Plus className="h-4 w-4" />
              Add from Recommendations
            </button>
          )}
        </div>

        {/* Add from Recommendations Panel */}
        {showAddFromRecommendation && (
          <div className="p-4 border-b" style={{ borderColor: COLORS.lightGray, backgroundColor: '#F0F9FF' }}>
            <h3 className="font-semibold mb-3" style={{ color: COLORS.darkGray }}>
              Select Recommendations to Add:
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availableRecommendations.map(rec => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border"
                  style={{ borderColor: COLORS.lightGray }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: rec.type === 'priority' ? '#DC2626' : '#059669' }}
                    />
                    <div>
                      <p className="font-medium text-sm" style={{ color: COLORS.darkGray }}>
                        {rec.title}
                      </p>
                      <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                        {rec.category} • {rec.actions?.length || 0} action items • {formatCurrency(rec.potential)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddAllFromRecommendation(rec)}
                      className="px-3 py-1 text-xs rounded font-medium text-white"
                      style={{ backgroundColor: COLORS.slainteBlue }}
                    >
                      Add All ({rec.actions?.length || 1})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions List */}
        <div className="flex-1 overflow-y-auto p-4">
          {sortedActions.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 mx-auto mb-4" style={{ color: COLORS.lightGray }} />
              <p className="font-medium" style={{ color: COLORS.mediumGray }}>
                {filter === 'all' ? 'No action items yet' : `No ${filter.replace('_', ' ')} actions`}
              </p>
              <p className="text-sm mt-1" style={{ color: COLORS.lightGray }}>
                {filter === 'all' && 'Add recommendations from your health check to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedActions.map(action => (
                <ActionCard
                  key={action.id}
                  action={action}
                  isExpanded={expandedActions[action.id]}
                  isEditing={editingAction === action.id}
                  staffList={staffList}
                  onToggleExpand={() => toggleExpanded(action.id)}
                  onEdit={() => setEditingAction(action.id)}
                  onCancelEdit={() => setEditingAction(null)}
                  onUpdate={(updates) => handleUpdateAction(action.id, updates)}
                  onDelete={() => handleDeleteAction(action.id)}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: COLORS.lightGray }}>
          <p className="text-sm" style={{ color: COLORS.mediumGray }}>
            {actions.length} action{actions.length !== 1 ? 's' : ''} total
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: COLORS.slainteBlue }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ActionCard - Individual action item display/edit component
 */
function ActionCard({
  action,
  isExpanded,
  isEditing,
  staffList,
  onToggleExpand,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  formatCurrency,
  formatDate,
  getStatusColor,
  getStatusIcon
}) {
  const [editForm, setEditForm] = useState({
    assignedTo: action.assignedTo || '',
    dueDate: action.dueDate ? action.dueDate.split('T')[0] : '',
    status: action.status,
    notes: action.notes || '',
    showOnDashboard: action.showOnDashboard
  });

  // Check if overdue
  const isOverdue = action.dueDate &&
    new Date(action.dueDate) < new Date() &&
    action.status !== 'completed';

  const handleSave = () => {
    onUpdate({
      ...editForm,
      dueDate: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : null
    });
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${isOverdue ? 'border-red-300' : ''}`}
      style={{ borderColor: isOverdue ? '#FCA5A5' : COLORS.lightGray }}
    >
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 flex items-start justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start gap-3 flex-1 text-left">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-full text-white flex-shrink-0"
            style={{ backgroundColor: action.type === 'priority' ? '#DC2626' : '#059669' }}
          >
            {action.type === 'priority' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium truncate" style={{ color: COLORS.darkGray }}>
                {action.title}
              </h4>
              {isOverdue && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                  Overdue
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm" style={{ color: COLORS.mediumGray }}>
              <span>{action.category}</span>
              <span>•</span>
              <span className="flex items-center gap-1" style={{ color: getStatusColor(action.status) }}>
                {getStatusIcon(action.status)}
                {action.status.replace('_', ' ')}
              </span>
              {action.assignedTo && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {action.assignedTo}
                  </span>
                </>
              )}
              {action.dueDate && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(action.dueDate)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <p className="font-bold" style={{ color: COLORS.incomeColor }}>
              {formatCurrency(action.potentialValue)}
            </p>
            <p className="text-xs" style={{ color: COLORS.mediumGray }}>
              {action.effort} effort
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 flex-shrink-0 ml-2" style={{ color: COLORS.mediumGray }} />
          ) : (
            <ChevronDown className="h-5 w-5 flex-shrink-0 ml-2" style={{ color: COLORS.mediumGray }} />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: COLORS.lightGray, backgroundColor: COLORS.backgroundGray }}>
          {isEditing ? (
            /* Edit Form */
            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                    Assigned To
                  </label>
                  <select
                    value={editForm.assignedTo}
                    onChange={(e) => setEditForm({ ...editForm, assignedTo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: COLORS.lightGray }}
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((staff, idx) => (
                      <option key={idx} value={`${staff.firstName} ${staff.surname}`}>
                        {staff.firstName} {staff.surname} ({staff.staffType})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: COLORS.lightGray }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                  Status
                </label>
                <div className="flex gap-2">
                  {['pending', 'in_progress', 'completed'].map(status => (
                    <button
                      key={status}
                      onClick={() => setEditForm({ ...editForm, status })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2`}
                      style={{
                        backgroundColor: editForm.status === status ? getStatusColor(status) : COLORS.backgroundGray,
                        color: editForm.status === status ? 'white' : COLORS.mediumGray
                      }}
                    >
                      {status === 'pending' && <Clock className="h-4 w-4" />}
                      {status === 'in_progress' && <Play className="h-4 w-4" />}
                      {status === 'completed' && <CheckCircle className="h-4 w-4" />}
                      {status.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Add notes about this action..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  style={{ borderColor: COLORS.lightGray }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`dashboard-${action.id}`}
                  checked={editForm.showOnDashboard}
                  onChange={(e) => setEditForm({ ...editForm, showOnDashboard: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor={`dashboard-${action.id}`} className="text-sm" style={{ color: COLORS.mediumGray }}>
                  Show reminder on dashboard
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onCancelEdit}
                  className="px-4 py-2 rounded-lg text-sm font-medium border"
                  style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2"
                  style={{ backgroundColor: COLORS.slainteBlue }}
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="pt-4">
              {action.description && (
                <p className="text-sm mb-4 p-3 bg-white rounded border" style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}>
                  {action.description}
                </p>
              )}

              {action.notes && (
                <div className="mb-4">
                  <p className="text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>Notes:</p>
                  <p className="text-sm p-3 bg-white rounded border" style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}>
                    {action.notes}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm" style={{ color: COLORS.mediumGray }}>
                  <span>Created: {formatDate(action.createdDate)}</span>
                  {action.completedDate && (
                    <span className="text-green-600">
                      Completed: {formatDate(action.completedDate)}
                    </span>
                  )}
                  {action.showOnDashboard && action.status !== 'completed' && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Eye className="h-3 w-3" />
                      Dashboard reminder
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onEdit}
                    className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 border"
                    style={{ borderColor: COLORS.lightGray, color: COLORS.slainteBlue }}
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={onDelete}
                    className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 text-red-600 border border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
