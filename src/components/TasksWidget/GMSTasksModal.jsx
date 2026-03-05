import React, { useState, useEffect } from 'react';
import {
  X,
  Target,
  Edit3,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Plus,
  ChevronRight,
  Trash2
} from 'lucide-react';
import COLORS from '../../utils/colors';
import {
  get as getPracticeProfile,
  getActionItems,
  updateActionItem,
  deleteActionItem,
  addActionItem
} from '../../storage/practiceProfileStorage';
import ConfirmDialog from './ConfirmDialog';

/**
 * GMSTasksModal - Extracted from PaymentAnalysis.jsx
 * Modal for viewing and managing all GMS action items
 */
const GMSTasksModal = ({ isOpen, onClose, onTasksChanged }) => {
  const [allActionItems, setAllActionItems] = useState([]);
  const [editingAction, setEditingAction] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showCustomTaskForm, setShowCustomTaskForm] = useState(false);
  const [editForm, setEditForm] = useState({
    assignedTo: '',
    dueDate: '',
    status: 'pending'
  });
  const [addTaskForm, setAddTaskForm] = useState({
    title: '',
    category: 'manual',
    type: 'growth',
    potentialValue: 0,
    effort: 'medium',
    assignedTo: '',
    dueDate: ''
  });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null, actionId: null });

  // Load tasks on open
  useEffect(() => {
    if (isOpen) {
      setAllActionItems(getActionItems());
    }
  }, [isOpen]);

  // Get assignee list from practice profile
  const getAssigneeList = () => {
    const profile = getPracticeProfile();
    if (!profile) return [];

    const assignees = [];

    // Add GP partners
    if (profile.gps?.partners) {
      profile.gps.partners.forEach(p => {
        if (p.name) assignees.push({ name: p.name, role: 'Partner' });
      });
    }

    // Add salaried GPs
    if (profile.gps?.salaried) {
      profile.gps.salaried.forEach(g => {
        if (g.name) assignees.push({ name: g.name, role: 'Salaried GP' });
      });
    }

    // Add staff
    if (profile.staff) {
      profile.staff.forEach(s => {
        const name = s.name || `${s.firstName || ''} ${s.surname || ''}`.trim();
        if (name) assignees.push({ name, role: s.role || 'Staff' });
      });
    }

    // Add health check staff details if available
    if (profile.healthCheckData?.staffDetails) {
      profile.healthCheckData.staffDetails.forEach(s => {
        const name = `${s.firstName || ''} ${s.surname || ''}`.trim();
        if (name) {
          const role = s.staffType === 'nurse' ? 'Nurse' :
                       s.staffType === 'practiceManager' ? 'Practice Manager' :
                       s.staffType || 'Staff';
          assignees.push({ name, role });
        }
      });
    }

    return assignees;
  };

  // Handle editing an action
  const handleEditAction = (action) => {
    setEditingAction(action);
    setEditForm({
      assignedTo: action.assignedTo || '',
      dueDate: action.dueDate || '',
      status: action.status || 'pending'
    });
  };

  // Save action edit
  const handleSaveActionEdit = () => {
    if (!editingAction) return;

    const updates = {
      assignedTo: editForm.assignedTo || null,
      dueDate: editForm.dueDate || null,
      status: editForm.status
    };

    if (editForm.status === 'completed' && editingAction.status !== 'completed') {
      updates.completedDate = new Date().toISOString();
    }

    updateActionItem(editingAction.id, updates);
    setAllActionItems(getActionItems());
    setEditingAction(null);
    setEditForm({ assignedTo: '', dueDate: '', status: 'pending' });

    if (onTasksChanged) onTasksChanged();
  };

  // Quick status update - show confirmation for complete
  const handleQuickStatusUpdate = (actionId, newStatus) => {
    if (newStatus === 'completed') {
      setConfirmDialog({ isOpen: true, type: 'complete', actionId });
    } else {
      const updates = { status: newStatus };
      updateActionItem(actionId, updates);
      setAllActionItems(getActionItems());
      if (onTasksChanged) onTasksChanged();
    }
  };

  const handleConfirmComplete = () => {
    const updates = { status: 'completed', completedDate: new Date().toISOString() };
    updateActionItem(confirmDialog.actionId, updates);
    setAllActionItems(getActionItems());
    setConfirmDialog({ isOpen: false, type: null, actionId: null });
    if (onTasksChanged) onTasksChanged();
  };

  // Delete an action - show confirmation
  const handleDeleteAction = (actionId) => {
    setConfirmDialog({ isOpen: true, type: 'delete', actionId });
  };

  const handleConfirmDelete = () => {
    deleteActionItem(confirmDialog.actionId);
    setAllActionItems(getActionItems());
    setEditingAction(null);
    setConfirmDialog({ isOpen: false, type: null, actionId: null });
    if (onTasksChanged) onTasksChanged();
  };

  const handleCancelDialog = () => {
    setConfirmDialog({ isOpen: false, type: null, actionId: null });
  };

  // Create a new GMS action item
  const handleAddTask = (taskData) => {
    const newTask = {
      id: `action-${Date.now()}`,
      title: taskData.title,
      description: taskData.description || '',
      category: taskData.category || 'manual',
      type: taskData.type || 'growth',
      status: 'pending',
      assignedTo: taskData.assignedTo || null,
      dueDate: taskData.dueDate || null,
      potentialValue: taskData.potentialValue || 0,
      effort: taskData.effort || 'medium',
      showOnDashboard: true,
      createdDate: new Date().toISOString(),
      notes: taskData.notes || ''
    };

    addActionItem(newTask);
    setAllActionItems(getActionItems());
    setShowAddTask(false);
    setShowCustomTaskForm(false);
    setAddTaskForm({
      title: '',
      category: 'manual',
      type: 'growth',
      potentialValue: 0,
      effort: 'medium',
      assignedTo: '',
      dueDate: ''
    });

    if (onTasksChanged) onTasksChanged();
  };

  // Preset GMS tasks for quick add
  const presetGMSTasks = [
    { title: 'Review incomplete vaccinations', category: 'vaccinations', type: 'priority', potentialValue: 500, effort: 'medium' },
    { title: 'Follow up on overdue cervical screening', category: 'screening', type: 'priority', potentialValue: 300, effort: 'medium' },
    { title: 'Complete pending chronic disease reviews', category: 'chronic-disease', type: 'growth', potentialValue: 400, effort: 'high' },
    { title: 'Review practice list for GMS eligibility', category: 'registration', type: 'growth', potentialValue: 250, effort: 'low' },
    { title: 'Audit diabetic patient retinal screening', category: 'screening', type: 'growth', potentialValue: 200, effort: 'medium' },
    { title: 'Update patient contact details for recalls', category: 'admin', type: 'growth', potentialValue: 100, effort: 'low' },
  ];

  if (!isOpen) return null;

  // Calculate stats
  const stats = {
    total: allActionItems.length,
    pending: allActionItems.filter(a => a.status === 'pending').length,
    inProgress: allActionItems.filter(a => a.status === 'in_progress').length,
    completed: allActionItems.filter(a => a.status === 'completed').length,
    totalValue: allActionItems.reduce((sum, a) => sum + (a.potentialValue || 0), 0),
    recoveredValue: allActionItems.filter(a => a.status === 'completed').reduce((sum, a) => sum + (a.potentialValue || 0), 0)
  };

  return (
    <>
      {/* Main Modal - View All Tasks */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ border: `1px solid ${COLORS.lightGray}`, maxHeight: 'calc(100vh - 2rem)' }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: COLORS.lightGray }}>
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
              <h3 className="font-semibold" style={{ color: COLORS.darkGray }}>GMS Action Plan - All Tasks</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAddTaskForm({
                    title: '',
                    category: 'manual',
                    type: 'growth',
                    potentialValue: 0,
                    effort: 'medium',
                    assignedTo: '',
                    dueDate: ''
                  });
                  setShowAddTask(true);
                }}
                className="px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 border"
                style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
              >
                <Plus className="h-4 w-4" /> Add
              </button>
              <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
                <X className="h-5 w-5" style={{ color: COLORS.mediumGray }} />
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="p-4 border-b" style={{ borderColor: COLORS.lightGray, backgroundColor: '#F9FAFB' }}>
            <div className="grid grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>{stats.total}</p>
                <p className="text-xs" style={{ color: COLORS.mediumGray }}>Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: '#6B7280' }}>{stats.pending}</p>
                <p className="text-xs" style={{ color: COLORS.mediumGray }}>Pending</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: COLORS.slainteBlue }}>{stats.inProgress}</p>
                <p className="text-xs" style={{ color: COLORS.mediumGray }}>In Progress</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: COLORS.incomeColor }}>{stats.completed}</p>
                <p className="text-xs" style={{ color: COLORS.mediumGray }}>Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: COLORS.incomeColor }}>
                  {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(stats.recoveredValue)}
                </p>
                <p className="text-xs" style={{ color: COLORS.mediumGray }}>Recovered</p>
              </div>
            </div>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto p-4">
            {allActionItems.length === 0 ? (
              <div className="text-center py-8" style={{ color: COLORS.mediumGray }}>
                <Target className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No GMS tasks yet</p>
                <p className="text-sm mt-1">Run a GMS Health Check to generate recommendations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allActionItems.map(action => {
                  const isOverdue = action.dueDate && new Date(action.dueDate) < new Date() && action.status !== 'completed';
                  return (
                    <div
                      key={action.id}
                      className={`p-4 rounded-lg border ${isOverdue ? 'bg-red-50 border-red-200' : action.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}
                      style={{ borderColor: isOverdue ? '#FCA5A5' : action.status === 'completed' ? '#A7F3D0' : COLORS.lightGray }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className="flex items-center justify-center w-8 h-8 rounded-full text-white flex-shrink-0"
                            style={{
                              backgroundColor: action.status === 'completed' ? '#059669' : action.type === 'priority' ? '#DC2626' : '#3B82F6'
                            }}
                          >
                            {action.status === 'completed' ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : action.type === 'priority' ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <TrendingUp className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p
                              className={`font-medium text-sm ${action.status === 'completed' ? 'line-through opacity-60' : ''}`}
                              style={{ color: COLORS.darkGray }}
                            >
                              {action.title}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: COLORS.mediumGray }}>
                              <span>{action.category}</span>
                              {action.assignedTo && (
                                <>
                                  <span>•</span>
                                  <span>{action.assignedTo}</span>
                                </>
                              )}
                              {action.dueDate && (
                                <>
                                  <span>•</span>
                                  <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                    {new Date(action.dueDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                                    {isOverdue && ' (Overdue)'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <p
                            className="font-bold text-sm"
                            style={{ color: action.status === 'completed' ? COLORS.mediumGray : COLORS.incomeColor }}
                          >
                            {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(action.potentialValue || 0)}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-3">
                          <button
                            onClick={() => handleEditAction(action)}
                            className="p-1.5 rounded hover:bg-blue-100"
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" style={{ color: COLORS.slainteBlue }} />
                          </button>
                          {action.status !== 'completed' && (
                            <button
                              onClick={() => handleQuickStatusUpdate(action.id, 'completed')}
                              className="p-1.5 rounded hover:bg-green-100"
                              title="Mark as complete"
                            >
                              <CheckCircle className="h-4 w-4" style={{ color: '#059669' }} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAction(action.id)}
                            className="p-1.5 rounded hover:bg-red-100"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" style={{ color: COLORS.expenseColor }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: COLORS.lightGray }}>
            <p className="text-sm" style={{ color: COLORS.mediumGray }}>
              {stats.completed} of {stats.total} tasks completed
              {stats.totalValue > 0 && (
                <span> • Potential value: {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(stats.totalValue)}</span>
              )}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: COLORS.slainteBlue }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Edit Action Modal */}
      {editingAction && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" style={{ border: `1px solid ${COLORS.lightGray}` }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: COLORS.lightGray }}>
              <h3 className="font-semibold" style={{ color: COLORS.darkGray }}>Edit Action</h3>
              <button onClick={() => setEditingAction(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="h-5 w-5" style={{ color: COLORS.mediumGray }} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Action</label>
                <p className="text-sm p-2 bg-gray-50 rounded-lg" style={{ color: COLORS.darkGray }}>
                  {editingAction.title}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  style={{ borderColor: COLORS.lightGray }}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Assign To</label>
                <select
                  value={editForm.assignedTo}
                  onChange={(e) => setEditForm({ ...editForm, assignedTo: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  style={{ borderColor: COLORS.lightGray }}
                >
                  <option value="">Unassigned</option>
                  {getAssigneeList().map((person, idx) => (
                    <option key={idx} value={person.name}>{person.name} ({person.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Due Date</label>
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  style={{ borderColor: COLORS.lightGray }}
                />
              </div>
              {editingAction.potentialValue > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Potential Value</label>
                  <p className="text-sm font-bold" style={{ color: COLORS.incomeColor }}>
                    {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(editingAction.potentialValue)}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-between p-4 border-t" style={{ borderColor: COLORS.lightGray }}>
              <button
                onClick={() => handleDeleteAction(editingAction.id)}
                className="px-4 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingAction(null)}
                  className="px-4 py-2 text-sm rounded-lg border"
                  style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveActionEdit}
                  className="px-4 py-2 text-sm rounded-lg text-white"
                  style={{ backgroundColor: COLORS.slainteBlue }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add GMS Task Modal */}
      {showAddTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }}
        >
          <div
            style={{
              backgroundColor: COLORS.white,
              borderRadius: '0.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '100%',
              maxWidth: '32rem',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              border: `1px solid ${COLORS.lightGray}`
            }}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: COLORS.lightGray }}>
              <h3 className="font-semibold" style={{ color: COLORS.darkGray }}>
                {showCustomTaskForm ? 'Create Custom GMS Task' : 'Add GMS Task'}
              </h3>
              <button
                onClick={() => {
                  setShowAddTask(false);
                  setShowCustomTaskForm(false);
                }}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="h-5 w-5" style={{ color: COLORS.mediumGray }} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 0 }}>
              {!showCustomTaskForm ? (
                <>
                  {/* Quick Add - Preset Tasks */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: COLORS.darkGray }}>Select a task to add:</label>
                    <div className="grid grid-cols-1 gap-2">
                      {presetGMSTasks.map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            // Populate the form with preset values and show the edit form
                            setAddTaskForm({
                              title: preset.title,
                              category: preset.category,
                              type: preset.type,
                              potentialValue: preset.potentialValue,
                              effort: preset.effort,
                              assignedTo: '',
                              dueDate: ''
                            });
                            setShowCustomTaskForm(true);
                          }}
                          className="flex items-center gap-3 p-3 rounded-lg border text-left hover:bg-gray-50 transition-colors"
                          style={{ borderColor: COLORS.lightGray }}
                        >
                          <div
                            className="flex items-center justify-center w-8 h-8 rounded-full text-white flex-shrink-0"
                            style={{ backgroundColor: preset.type === 'priority' ? '#DC2626' : '#3B82F6' }}
                          >
                            {preset.type === 'priority' ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <TrendingUp className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm" style={{ color: COLORS.darkGray }}>{preset.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs" style={{ color: COLORS.mediumGray }}>{preset.category}</span>
                              <span className="text-xs font-medium" style={{ color: COLORS.incomeColor }}>
                                {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(preset.potentialValue)}
                              </span>
                            </div>
                          </div>
                          <Plus className="h-4 w-4 flex-shrink-0" style={{ color: COLORS.slainteBlue }} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Create Custom Task Button */}
                  <button
                    onClick={() => setShowCustomTaskForm(true)}
                    className="w-full p-3 rounded-lg border-2 border-dashed text-center hover:bg-gray-50 transition-colors"
                    style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                  >
                    <Plus className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Create Custom Task</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Back button */}
                  <button
                    onClick={() => setShowCustomTaskForm(false)}
                    className="flex items-center gap-1 text-sm mb-2"
                    style={{ color: COLORS.slainteBlue }}
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Back to preset tasks
                  </button>

                  {/* Custom Task Form */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Title *</label>
                    <input
                      type="text"
                      value={addTaskForm.title}
                      onChange={(e) => setAddTaskForm({ ...addTaskForm, title: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                      style={{ borderColor: COLORS.lightGray }}
                      placeholder="e.g., Review flu vaccination uptake"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Category</label>
                      <select
                        value={addTaskForm.category}
                        onChange={(e) => setAddTaskForm({ ...addTaskForm, category: e.target.value })}
                        className="w-full p-2 border rounded-lg"
                        style={{ borderColor: COLORS.lightGray }}
                      >
                        <option value="manual">Manual</option>
                        <option value="vaccinations">Vaccinations</option>
                        <option value="screening">Screening</option>
                        <option value="chronic-disease">Chronic Disease</option>
                        <option value="registration">Registration</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Type</label>
                      <select
                        value={addTaskForm.type}
                        onChange={(e) => setAddTaskForm({ ...addTaskForm, type: e.target.value })}
                        className="w-full p-2 border rounded-lg"
                        style={{ borderColor: COLORS.lightGray }}
                      >
                        <option value="growth">Growth Opportunity</option>
                        <option value="priority">Priority Action</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Potential Value (€)</label>
                      <input
                        type="number"
                        value={addTaskForm.potentialValue}
                        onChange={(e) => setAddTaskForm({ ...addTaskForm, potentialValue: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 border rounded-lg"
                        style={{ borderColor: COLORS.lightGray }}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Effort</label>
                      <select
                        value={addTaskForm.effort}
                        onChange={(e) => setAddTaskForm({ ...addTaskForm, effort: e.target.value })}
                        className="w-full p-2 border rounded-lg"
                        style={{ borderColor: COLORS.lightGray }}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Assign To</label>
                    <select
                      value={addTaskForm.assignedTo}
                      onChange={(e) => setAddTaskForm({ ...addTaskForm, assignedTo: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                      style={{ borderColor: COLORS.lightGray }}
                    >
                      <option value="">Unassigned</option>
                      {getAssigneeList().map((person, idx) => (
                        <option key={idx} value={person.name}>
                          {person.name} ({person.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>Due Date</label>
                    <input
                      type="date"
                      value={addTaskForm.dueDate}
                      onChange={(e) => setAddTaskForm({ ...addTaskForm, dueDate: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                      style={{ borderColor: COLORS.lightGray }}
                    />
                  </div>
                </>
              )}
            </div>
            {showCustomTaskForm && (
              <div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: COLORS.lightGray }}>
                <button
                  onClick={() => {
                    setShowAddTask(false);
                    setShowCustomTaskForm(false);
                  }}
                  className="px-4 py-2 text-sm rounded-lg border"
                  style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddTask(addTaskForm)}
                  disabled={!addTaskForm.title}
                  className="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50"
                  style={{ backgroundColor: COLORS.slainteBlue }}
                >
                  Add Task
                </button>
              </div>
            )}
          </div>
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
    </>
  );
};

export default GMSTasksModal;
