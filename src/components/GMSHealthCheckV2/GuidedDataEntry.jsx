import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader, CheckCircle, AlertCircle, ListRestart } from 'lucide-react';
import DOMPurify from 'dompurify';
import { callClaude } from '../../utils/claudeAPI';
import { MODELS } from '../../data/modelConfig';
import COLORS from '../../utils/colors';
import GUIDED_PROMPTS from '../../data/guidedEntryPrompts';

/**
 * Build the extraction prompt for Claude to parse a user's natural language response.
 */
function buildExtractionPrompt(field, userResponse, areaId) {
  if (field.isComplex && field.id === 'staffDetails') {
    return `Extract staff details from this natural language response. Return ONLY valid JSON — no explanation, no markdown.

User said: "${userResponse}"

Return a JSON array of staff objects. Each object must have:
- firstName (string)
- surname (string, "" if not given)
- staffType (one of: "secretary", "nurse", "practiceManager")
- actualHoursWorked (number, weekly hours)
- yearsExperience (number)

Map roles: "receptionist"/"admin" → "secretary", "practice manager"/"PM" → "practiceManager".
If hours not specified, use 35 (full-time).
If experience not specified, use 1.

Example input: "Mary Smith is a nurse, 30 hours, 5 years. John is a secretary, full time, 2 years experience"
Example output: [{"firstName":"Mary","surname":"Smith","staffType":"nurse","actualHoursWorked":30,"yearsExperience":5},{"firstName":"John","surname":"","staffType":"secretary","actualHoursWorked":35,"yearsExperience":2}]`;
  }

  return `Extract a single number from this response. Return ONLY the number — no text, no explanation.

Context: ${field.question}
User said: "${userResponse}"

${field.parseHint}

If the user says "no", "none", "zero", or "0", return 0.
If you cannot extract a number, return -1.`;
}

/**
 * Format parsed staff details for confirmation display.
 */
function formatStaffConfirmation(staff) {
  const roleLabels = { secretary: 'Secretary', nurse: 'Nurse', practiceManager: 'Practice Manager' };
  return staff.map(s => {
    const name = `${s.firstName || ''} ${s.surname || ''}`.trim() || 'Unnamed';
    return `${name} — ${roleLabels[s.staffType] || s.staffType}, ${s.actualHoursWorked} hrs/week, ${s.yearsExperience} yrs experience`;
  }).join('\n');
}

/**
 * GuidedDataEntry — Conversational alternative to raw forms.
 * Finn asks questions one at a time, parses natural language responses,
 * confirms before writing, and tracks progress.
 */
const GuidedDataEntry = ({ areaId, healthCheckData, onUpdate, onSwitchToForm }) => {
  const config = GUIDED_PROMPTS[areaId];
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [pendingValue, setPendingValue] = useState(null); // { field, value, display }
  const [completedFields, setCompletedFields] = useState(new Set());
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const initRef = useRef(false);

  const fields = config?.fields || [];
  const totalFields = fields.length;
  const progress = completedFields.size;
  const isComplete = progress >= totalFields;

  // Add a message to the chat
  const addMessage = useCallback((role, content) => {
    setMessages(prev => [...prev, { role, content }]);
  }, []);

  // Start with intro + first question
  useEffect(() => {
    if (!config || initRef.current) return;
    initRef.current = true;
    addMessage('assistant', config.intro);
    // Small delay before first question
    setTimeout(() => {
      if (fields.length > 0) {
        addMessage('assistant', fields[0].question);
      }
    }, 500);
  }, [config, fields, addMessage]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 96) + 'px';
  };

  // Write a value to healthCheckData
  const writeValue = useCallback((field, value) => {
    const current = healthCheckData || {};

    if (field.id === 'staffDetails' && Array.isArray(value)) {
      // Staff array — merge with existing PCRS staff
      const existingPCRS = (current.staffDetails || []).filter(s => s.fromPCRS);
      const newStaff = value.map(s => ({
        ...s,
        incrementPoint: 1,
        weeklyHours: '',
        fromPCRS: false,
        fromProfile: false
      }));
      onUpdate({ ...current, staffDetails: [...existingPCRS, ...newStaff] });
      return;
    }

    if (field.section === '_meta') return; // Meta fields don't write

    const sectionData = current[field.section] || {};
    onUpdate({
      ...current,
      [field.section]: { ...sectionData, [field.field]: value }
    });
  }, [healthCheckData, onUpdate]);

  // Handle confirm/reject of pending value
  const handleConfirm = useCallback(() => {
    if (!pendingValue) return;
    writeValue(pendingValue.field, pendingValue.value);
    setCompletedFields(prev => new Set([...prev, pendingValue.field.id]));
    addMessage('assistant', 'Saved.');

    const nextIndex = currentFieldIndex + 1;
    if (nextIndex < fields.length) {
      setCurrentFieldIndex(nextIndex);
      setTimeout(() => addMessage('assistant', fields[nextIndex].question), 300);
    } else {
      setTimeout(() => addMessage('assistant', "That's everything I need for this area. Your data has been saved and the analysis will update automatically. You can switch to the Analysis tab to see the results."), 300);
    }
    setPendingValue(null);
  }, [pendingValue, writeValue, currentFieldIndex, fields, addMessage]);

  const handleReject = useCallback(() => {
    setPendingValue(null);
    addMessage('assistant', "No problem — let me ask again. " + fields[currentFieldIndex]?.question);
  }, [currentFieldIndex, fields, addMessage]);

  // Process user input
  const handleSend = async (text) => {
    const userMessage = text?.trim() || input.trim();
    if (!userMessage || isProcessing) return;

    addMessage('user', userMessage);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // If there's a pending confirmation, treat as yes/no
    if (pendingValue) {
      const lower = userMessage.toLowerCase();
      if (lower === 'yes' || lower === 'y' || lower === 'correct' || lower === 'confirm' || lower === 'looks good') {
        handleConfirm();
        return;
      } else if (lower === 'no' || lower === 'n' || lower === 'wrong' || lower === 'redo') {
        handleReject();
        return;
      }
      // If they typed something else, treat it as a new answer and re-parse
      setPendingValue(null);
    }

    const field = fields[currentFieldIndex];
    if (!field || isComplete) return;

    setIsProcessing(true);

    try {
      const prompt = buildExtractionPrompt(field, userMessage, areaId);
      const result = await callClaude(prompt, {
        model: MODELS.FAST,
        maxTokens: 500,
        temperature: 0
      });

      if (!result.success || !result.content) {
        addMessage('assistant', "I couldn't quite understand that. Could you try rephrasing?");
        setIsProcessing(false);
        return;
      }

      const raw = result.content.trim();

      if (field.isComplex && field.id === 'staffDetails') {
        // Parse JSON array
        try {
          const staffArray = JSON.parse(raw);
          if (!Array.isArray(staffArray) || staffArray.length === 0) {
            addMessage('assistant', "I couldn't extract staff details from that. Could you try listing each person with their role, hours, and experience?");
            setIsProcessing(false);
            return;
          }
          const display = formatStaffConfirmation(staffArray);
          addMessage('assistant', `Here's what I understood:\n\n${display}\n\nIs this correct? (yes/no)`);
          setPendingValue({ field, value: staffArray, display });
        } catch {
          addMessage('assistant', "I had trouble parsing that. Could you try listing each staff member clearly? For example: \"Mary is a nurse, 30 hours, 5 years experience\"");
        }
      } else {
        // Parse number
        const num = parseInt(raw, 10);
        if (isNaN(num) || num === -1) {
          addMessage('assistant', "I couldn't extract a number from that. Could you give me just the number?");
        } else {
          addMessage('assistant', `Got it — **${num}**. Is that correct? (yes/no)`);
          setPendingValue({ field, value: num, display: String(num) });
        }
      }
    } catch {
      addMessage('assistant', "Something went wrong. Could you try again?");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!config) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: COLORS.textSecondary, fontSize: '0.85rem' }}>
        Guided entry is not available for this area — it uses PCRS data only.
        <button
          onClick={onSwitchToForm}
          style={{
            display: 'block',
            margin: '0.75rem auto 0',
            padding: '0.4rem 1rem',
            borderRadius: '0.375rem',
            border: `1px solid ${COLORS.slainteBlue}`,
            background: 'none',
            color: COLORS.slainteBlue,
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Switch to Form
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '500px' }}>
      {/* Progress bar */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: `1px solid ${COLORS.borderLight}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '120px',
            height: '6px',
            backgroundColor: COLORS.bgPage,
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${totalFields > 0 ? (progress / totalFields) * 100 : 0}%`,
              height: '100%',
              backgroundColor: isComplete ? COLORS.success : COLORS.slainteBlue,
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <span style={{ fontSize: '0.72rem', color: COLORS.textSecondary }}>
            {isComplete ? 'Complete' : `${progress}/${totalFields} fields`}
          </span>
        </div>
        <button
          onClick={onSwitchToForm}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.375rem',
            border: `1px solid ${COLORS.borderLight}`,
            background: 'none',
            color: COLORS.textSecondary,
            fontSize: '0.72rem',
            cursor: 'pointer'
          }}
        >
          <ListRestart size={12} />
          Switch to form
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        padding: '1rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem'
      }}>
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.75rem',
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                backgroundColor: isUser ? COLORS.slainteBlue : COLORS.bgPage,
                color: isUser ? COLORS.white : COLORS.textPrimary,
                whiteSpace: 'pre-line'
              }}
                dangerouslySetInnerHTML={isUser ? undefined : { __html: DOMPurify.sanitize(msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')) }}
              >
                {isUser ? msg.content : undefined}
              </div>
            </div>
          );
        })}

        {/* Confirm/reject buttons */}
        {pendingValue && !isProcessing && (
          <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '0.25rem' }}>
            <button
              onClick={handleConfirm}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: COLORS.success,
                color: 'white',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <CheckCircle size={13} />
              Yes, save it
            </button>
            <button
              onClick={handleReject}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.375rem',
                border: `1px solid ${COLORS.borderLight}`,
                backgroundColor: COLORS.white,
                color: COLORS.textSecondary,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <AlertCircle size={13} />
              No, redo
            </button>
          </div>
        )}

        {isProcessing && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.75rem',
              backgroundColor: COLORS.bgPage,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8125rem',
              color: COLORS.textSecondary
            }}>
              <Loader style={{ height: '0.875rem', width: '0.875rem', animation: 'spin 1s linear infinite' }} />
              Processing...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '0.75rem 1rem',
        borderTop: `1px solid ${COLORS.borderLight}`,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '0.5rem',
        flexShrink: 0
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isComplete ? 'All done! Switch to Analysis to see results.' : pendingValue ? 'Type yes or no...' : 'Type your answer...'}
          rows={1}
          disabled={isComplete}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            border: `1px solid ${COLORS.borderLight}`,
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
            fontFamily: 'inherit',
            maxHeight: '96px',
            overflow: 'auto',
            opacity: isComplete ? 0.5 : 1
          }}
          onFocus={(e) => e.target.style.borderColor = COLORS.slainteBlue}
          onBlur={(e) => e.target.style.borderColor = COLORS.borderLight}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isProcessing || isComplete}
          style={{
            padding: '0.5rem',
            backgroundColor: input.trim() && !isProcessing ? COLORS.slainteBlue : COLORS.borderLight,
            border: 'none',
            borderRadius: '0.5rem',
            cursor: input.trim() && !isProcessing ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Send style={{ height: '1rem', width: '1rem', color: COLORS.white }} />
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default GuidedDataEntry;
