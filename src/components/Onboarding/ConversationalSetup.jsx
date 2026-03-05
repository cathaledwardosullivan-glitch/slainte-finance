import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader, User, Bot, ArrowLeft, Building2, MapPin, Users, Stethoscope, UserCheck, CheckCircle, ArrowRight } from 'lucide-react';
import COLORS from '../../utils/colors';
import { getRoleCode } from '../../utils/categoryGenerator';
import { callClaude as callClaudeAPI } from '../../utils/claudeAPI';
import { MODELS } from '../../data/modelConfig';

export default function ConversationalSetup({ apiKey, initialProfile, websiteData, onComplete, onBack, editMode }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // In edit mode, load existing profile from localStorage
  const getInitialProfile = () => {
    const defaultProfile = {
      practiceDetails: { practiceName: '', locations: [] },
      gps: { partners: [], salaried: [] },
      staff: [],
      metadata: {}
    };

    if (editMode) {
      try {
        const stored = localStorage.getItem('slainte_practice_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Merge with default to ensure all required fields exist
          return {
            ...defaultProfile,
            ...parsed,
            practiceDetails: { ...defaultProfile.practiceDetails, ...parsed.practiceDetails },
            gps: { ...defaultProfile.gps, ...parsed.gps },
            staff: parsed.staff || [],
            metadata: { ...defaultProfile.metadata, ...parsed.metadata }
          };
        }
      } catch (e) {
        console.error('Error loading profile for edit:', e);
      }
    }
    return initialProfile || defaultProfile;
  };

  const [profile, setProfile] = useState(getInitialProfile);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isConversationComplete, setIsConversationComplete] = useState(false);
  const messagesEndRef = useRef(null);
  const hasStarted = useRef(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start conversation on mount (only once)
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      startConversation();
    }
  }, []);

  const startConversation = async () => {
    const systemPrompt = buildSystemPrompt();
    setIsThinking(true);
    try {
      const userMessage = editMode
        ? "I'm here to update my practice profile. Please show me what's currently saved and ask what I'd like to change."
        : "Continue the conversation naturally. You've already introduced yourself earlier, so jump right in. If website data was provided, acknowledge it and what you found. Then start collecting practice information.";
      const message = await callClaude(systemPrompt, userMessage);
      addMessage('assistant', message);
    } catch (error) {
      console.error('Error starting conversation:', error);
      const fallbackMessage = editMode
        ? "Hi! I can help you update your practice profile. What would you like to change - practice details, GPs, or staff members?"
        : "Great! Let's get started with setting up your practice. Can you tell me your practice name?";
      addMessage('assistant', fallbackMessage);
    } finally {
      setIsThinking(false);
    }
  };

  const buildSystemPrompt = () => {
    let prompt = `You are Finn, a friendly AI assistant helping ${editMode ? 'update' : 'set up'} a GP practice in Ireland for financial tracking.

${editMode ? `MODE: EDIT PROFILE
The user already has a profile set up. They want to update/change some information.
Show them their current data and ask what they'd like to change.
Be helpful and make updates as requested - they may want to add staff, change names, or update details.

` : ''}INFORMATION TO COLLECT (in a natural conversational flow):

Required (must have before completing):
• Practice name
• Location/address
• GP Partners (the doctors who own the practice - need at least one name)

Optional (ask about, but okay if none):
• Salaried GPs (employed doctors who aren't partners)
• Staff members by role: reception, nursing, phlebotomy, practice management, other

CONVERSATION APPROACH:
${editMode ? `1. First summarize what's currently in their profile
2. Ask what they'd like to update or change
3. Make changes as requested
4. When they're done, confirm the updates and say "COMPLETE:"` : `1. If website data was found, confirm what's correct and ask about anything missing
2. Work through the required items naturally - don't interrogate
3. For staff, a simple "Do you have any staff you'd like to add - reception, nurses, etc?" works well
4. If they say "no" or "none" for optional items, accept that and move on
5. Once you have the 3 required items, ask if they'd like to add any staff, then wrap up`}

`;

    if (websiteData && websiteData.success) {
      prompt += `WEBSITE DATA FOUND:\n`;
      if (websiteData.data.practiceName) prompt += `- Practice: ${websiteData.data.practiceName}\n`;
      if (websiteData.data.locations?.length > 0) prompt += `- Location: ${websiteData.data.locations.join(', ')}\n`;
      if (websiteData.data.gpNames?.length > 0) prompt += `- GPs found: ${websiteData.data.gpNames.join(', ')}\n`;
      prompt += `\nConfirm this info is correct, then fill in any gaps.\n\n`;
    }

    prompt += `RULES:
- Don't re-introduce yourself (already done)
- Ask ONE question at a time, keep responses to 1-2 sentences
- Listen carefully - don't re-ask things they've already answered
- Accept "no" or "none" for optional items and move on
- When you have: practice name + location + at least one GP partner, AND have offered to add staff, say "COMPLETE:" at the start of your final summary message

CURRENT STATUS:
${buildProgressSummary()}

`;

    // Include actual conversation history for context
    if (messages.length > 0) {
      prompt += `CONVERSATION SO FAR:\n`;
      messages.forEach(msg => {
        prompt += `${msg.type === 'user' ? 'User' : 'Finn'}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    return prompt;
  };

  const buildProgressSummary = () => {
    const lines = [];

    // Required fields - show what we have and what's still needed
    lines.push(`REQUIRED:`);
    if (profile.practiceDetails.practiceName) {
      lines.push(`  ✓ Practice name: ${profile.practiceDetails.practiceName}`);
    } else {
      lines.push(`  ○ Practice name: (still needed)`);
    }

    if (profile.practiceDetails.locations?.length > 0) {
      lines.push(`  ✓ Location: ${profile.practiceDetails.locations.join(', ')}`);
    } else {
      lines.push(`  ○ Location: (still needed)`);
    }

    if (profile.gps.partners?.length > 0) {
      lines.push(`  ✓ GP Partners: ${profile.gps.partners.map(p => p.name).join(', ')}`);
    } else {
      lines.push(`  ○ GP Partners: (still needed)`);
    }

    // Optional fields
    lines.push(`\nOPTIONAL:`);
    if (profile.gps.salaried?.length > 0) {
      lines.push(`  ✓ Salaried GPs: ${profile.gps.salaried.map(g => g.name).join(', ')}`);
    } else {
      lines.push(`  ○ Salaried GPs: (none added)`);
    }

    if (profile.staff?.length > 0) {
      const byRole = {};
      profile.staff.forEach(s => {
        const role = s.role || 'other';
        if (!byRole[role]) byRole[role] = [];
        byRole[role].push(s.name);
      });
      Object.entries(byRole).forEach(([role, names]) => {
        lines.push(`  ✓ Staff (${role}): ${names.join(', ')}`);
      });
    } else {
      lines.push(`  ○ Staff: (none added)`);
    }

    return lines.join('\n');
  };

  const addMessage = (type, content) => {
    setMessages(prev => [...prev, {
      type,
      content,
      timestamp: new Date().toISOString(),
      id: `${type}-${Date.now()}-${Math.random()}`
    }]);
  };

  const callClaude = async (systemPrompt, userMessage) => {
    const fullPrompt = `${systemPrompt}\n\nUser: ${userMessage}`;
    const response = await callClaudeAPI(fullPrompt, {
      model: MODELS.STANDARD,
      maxTokens: 1000,
      apiKey: apiKey
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to get response from Claude');
    }

    const assistantMessage = response.content;
    setConversationHistory(prev => [
      ...prev,
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantMessage }
    ]);

    return assistantMessage;
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMessage = input.trim();
    addMessage('user', userMessage);
    setInput('');
    setIsThinking(true);

    try {
      const systemPrompt = buildSystemPrompt();
      const response = await callClaude(systemPrompt, userMessage);

      if (response.includes('COMPLETE:')) {
        const finalMessage = response.replace('COMPLETE:', '').trim();
        addMessage('assistant', finalMessage);
        setIsThinking(false);

        // Add confirmation message after a brief delay
        setTimeout(() => {
          addMessage('assistant', "Please take a moment to review your practice profile on the right. Does everything look correct? When you're happy with it, click 'Confirm & Continue' below.");
          setIsConversationComplete(true);
        }, 1500);
      } else {
        addMessage('assistant', response);
        setIsThinking(false);

        extractDataFromConversation(userMessage, response).catch(err => {
          console.error('Background extraction error:', err);
        });
      }
    } catch (error) {
      console.error('Conversation error:', error);
      addMessage('assistant', 'Sorry, I encountered an error. Could you repeat that?');
      setIsThinking(false);
    }
  };

  const extractDataFromConversation = async (userMessage, assistantResponse) => {
    try {
      const extractionPrompt = `Based on this conversation exchange, extract any practice information changes.

User said: "${userMessage}"
Assistant responded: "${assistantResponse}"

Current profile data:
${JSON.stringify(profile, null, 2)}

IMPORTANT: The user may be:
1. ADDING new information (use "add" action)
2. CORRECTING/EDITING existing information (use "replace" action - this REPLACES the entire list)
3. REMOVING information (use "remove" action with items to remove)

Return a JSON object with this format:
{
  "action": "add" | "replace" | "remove" | "none",
  "practiceName": "string or null",
  "locations": ["array of strings"] or null,
  "partners": [{"name": "string", "profitShare": number or null}] or null,
  "salariedGPs": [{"name": "string"}] or null,
  "staff": [{"name": "string", "role": "reception|nursing|phlebotomy|gp_assistant|management"}] or null,
  "removeStaff": ["names to remove"] or null,
  "accountant": "string or null",
  "yearEndDate": "MM-DD or null"
}

KEY RULES:
- If user is CORRECTING a typo (e.g., "Linda Donne" to "Linda Dunne"), use action "replace" and provide the COMPLETE corrected list
- If user says to REMOVE someone, use action "remove" with "removeStaff" containing their name(s)
- If user is just ADDING new people to existing list, use action "add"
- If no changes mentioned, return {"action": "none"}

Return ONLY valid JSON, nothing else.`;

      const extractResponse = await callClaudeAPI(extractionPrompt, {
        model: MODELS.STANDARD,
        maxTokens: 800,
        apiKey: apiKey
      });

      if (extractResponse.success) {
        const extracted = extractResponse.content;
        const jsonMatch = extracted.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const updates = JSON.parse(jsonMatch[0]);

          if (updates.action !== 'none') {
            setProfile(prev => {
              const newProfile = {
                ...prev,
                practiceDetails: { ...prev.practiceDetails },
                gps: { ...prev.gps },
                staff: [...(prev.staff || [])]
              };

              // Handle practice details
              if (updates.practiceName) newProfile.practiceDetails.practiceName = updates.practiceName;
              if (updates.locations) newProfile.practiceDetails.locations = updates.locations;
              if (updates.accountant) newProfile.practiceDetails.accountant = updates.accountant;
              if (updates.yearEndDate) newProfile.practiceDetails.yearEndDate = updates.yearEndDate;

              // Handle partners - replace always replaces entire list
              if (updates.partners) {
                newProfile.gps.partners = updates.partners;
              }

              // Handle salaried GPs - replace always replaces entire list
              if (updates.salariedGPs) {
                newProfile.gps.salaried = updates.salariedGPs;
              }

              // Handle staff based on action
              if (updates.action === 'remove' && updates.removeStaff) {
                // Remove specific staff by name
                const namesToRemove = updates.removeStaff.map(n => n.toLowerCase());
                newProfile.staff = prev.staff.filter(s =>
                  !namesToRemove.includes(s.name?.toLowerCase())
                );
              } else if (updates.action === 'replace' && updates.staff) {
                // Replace entire staff list
                newProfile.staff = updates.staff.map(member => ({
                  ...member,
                  roleCode: getRoleCode(member.role),
                  categoryCode: null
                }));
              } else if (updates.action === 'add' && updates.staff) {
                // Add new staff, avoiding duplicates
                const existingNames = new Set(prev.staff.map(s => s.name?.toLowerCase()));
                const newStaff = updates.staff
                  .filter(member => !existingNames.has(member.name?.toLowerCase()))
                  .map(member => ({
                    ...member,
                    roleCode: getRoleCode(member.role),
                    categoryCode: null
                  }));
                newProfile.staff = [...prev.staff, ...newStaff];
              }

              console.log('[ConversationalSetup] Profile updated:', updates.action, newProfile);
              return newProfile;
            });
          }
        }
      }
    } catch (error) {
      console.error('Error extracting data:', error);
    }
  };

  // Profile card helper - check if a section has data
  const hasProfileData = () => {
    return profile?.practiceDetails?.practiceName ||
           profile?.practiceDetails?.locations?.length > 0 ||
           profile?.gps?.partners?.length > 0 ||
           profile?.gps?.salaried?.length > 0 ||
           profile?.staff?.length > 0;
  };

  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      alignItems: 'flex-start',
      maxWidth: '1600px',
      margin: '0 auto',
      height: 'min(70vh, 650px)'
    }}>
      {/* Left side - Finn Chat Box */}
      <div style={{
        flex: '1 1 45%',
        minWidth: '450px',
        maxWidth: '600px',
        height: '100%',
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: `1px solid ${COLORS.lightGray}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Chat Header */}
        <div style={{
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              backgroundColor: COLORS.slainteBlueDark,
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <User style={{ height: '1.25rem', width: '1.25rem' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1rem' }}>Finn</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Sláinte Guide</div>
            </div>
          </div>

          <button
            onClick={onBack}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              color: COLORS.white,
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
            }}
          >
            <ArrowLeft style={{ width: '14px', height: '14px' }} />
            Back
          </button>
        </div>

        {/* Chat Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
                flexDirection: msg.type === 'user' ? 'row-reverse' : 'row'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: msg.type === 'user' ? COLORS.slainteBlue : COLORS.backgroundGray,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {msg.type === 'user' ? (
                  <User style={{ width: '16px', height: '16px', color: COLORS.white }} />
                ) : (
                  <MessageCircle style={{ width: '16px', height: '16px', color: COLORS.slainteBlue }} />
                )}
              </div>

              <div style={{
                maxWidth: '80%',
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                backgroundColor: msg.type === 'user' ? COLORS.slainteBlue : COLORS.backgroundGray,
                color: msg.type === 'user' ? COLORS.white : COLORS.darkGray,
                fontSize: '0.9375rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap'
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {isThinking && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: COLORS.backgroundGray,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <MessageCircle style={{ width: '16px', height: '16px', color: COLORS.slainteBlue }} />
              </div>
              <div style={{
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                backgroundColor: COLORS.backgroundGray,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Loader style={{ width: '16px', height: '16px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${COLORS.lightGray}`,
          backgroundColor: COLORS.white
        }}>
          {isConversationComplete ? (
            /* Confirmation Buttons */
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  setIsConversationComplete(false);
                  addMessage('assistant', "No problem! What would you like to change? You can tell me to update any details - practice name, location, staff members, or anything else.");
                }}
                style={{
                  flex: '1',
                  padding: '0.875rem',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  color: COLORS.darkGray,
                  backgroundColor: COLORS.white,
                  border: `2px solid ${COLORS.lightGray}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                Make Changes
              </button>
              <button
                onClick={() => onComplete(profile)}
                style={{
                  flex: '2',
                  padding: '0.875rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  backgroundColor: COLORS.incomeColor,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <CheckCircle style={{ width: '20px', height: '20px' }} />
                Confirm & Continue
                <ArrowRight style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
          ) : (
            /* Normal Input */
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type your response..."
                disabled={isThinking}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  border: `2px solid ${COLORS.lightGray}`,
                  borderRadius: '8px',
                  outline: 'none',
                  backgroundColor: isThinking ? COLORS.backgroundGray : COLORS.white
                }}
              />
              <button
                onClick={handleSend}
                disabled={isThinking || !input.trim()}
                style={{
                  padding: '0.75rem 1.25rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  backgroundColor: COLORS.slainteBlue,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (isThinking || !input.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (isThinking || !input.trim()) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Send style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Practice Profile Card */}
      <div style={{
        flex: '1 1 55%',
        minWidth: '400px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {/* Profile Card */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `2px solid ${COLORS.lightGray}`,
          borderRadius: '16px',
          padding: '1.5rem',
          flex: 1,
          overflow: 'auto',
          maxHeight: '100%'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            paddingBottom: '1rem',
            borderBottom: `1px solid ${COLORS.lightGray}`
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: `${COLORS.slainteBlue}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 style={{ width: '20px', height: '20px', color: COLORS.slainteBlue }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.darkGray }}>
                Practice Profile
              </h3>
              <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
                Building as we chat...
              </p>
            </div>
          </div>

          {!hasProfileData() ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem 1rem',
              color: COLORS.mediumGray
            }}>
              <Building2 style={{ width: '48px', height: '48px', color: COLORS.lightGray, margin: '0 auto 1rem' }} />
              <p style={{ fontSize: '0.9375rem' }}>
                Your practice profile will appear here as we chat
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Practice Name */}
              {profile.practiceDetails.practiceName && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.375rem'
                  }}>
                    <Building2 style={{ width: '14px', height: '14px', color: COLORS.slainteBlue }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.mediumGray, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Practice Name
                    </span>
                  </div>
                  <p style={{ fontSize: '1rem', color: COLORS.darkGray, fontWeight: 500, paddingLeft: '1.375rem' }}>
                    {profile.practiceDetails.practiceName}
                  </p>
                </div>
              )}

              {/* Location */}
              {profile.practiceDetails.locations?.length > 0 && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.375rem'
                  }}>
                    <MapPin style={{ width: '14px', height: '14px', color: COLORS.slainteBlue }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.mediumGray, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Location
                    </span>
                  </div>
                  <p style={{ fontSize: '1rem', color: COLORS.darkGray, paddingLeft: '1.375rem' }}>
                    {profile.practiceDetails.locations.join(', ')}
                  </p>
                </div>
              )}

              {/* GP Partners */}
              {profile.gps.partners?.length > 0 && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.375rem'
                  }}>
                    <Stethoscope style={{ width: '14px', height: '14px', color: COLORS.slainteBlue }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.mediumGray, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      GP Partners ({profile.gps.partners.length})
                    </span>
                  </div>
                  <div style={{ paddingLeft: '1.375rem' }}>
                    {profile.gps.partners.map((partner, idx) => (
                      <p key={idx} style={{ fontSize: '0.9375rem', color: COLORS.darkGray, marginBottom: '0.25rem' }}>
                        {partner.name}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Salaried GPs */}
              {profile.gps.salaried?.length > 0 && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.375rem'
                  }}>
                    <UserCheck style={{ width: '14px', height: '14px', color: COLORS.slainteBlue }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.mediumGray, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Salaried GPs ({profile.gps.salaried.length})
                    </span>
                  </div>
                  <div style={{ paddingLeft: '1.375rem' }}>
                    {profile.gps.salaried.map((gp, idx) => (
                      <p key={idx} style={{ fontSize: '0.9375rem', color: COLORS.darkGray, marginBottom: '0.25rem' }}>
                        {gp.name}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Staff */}
              {profile.staff?.length > 0 && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.375rem'
                  }}>
                    <Users style={{ width: '14px', height: '14px', color: COLORS.slainteBlue }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.mediumGray, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Staff ({profile.staff.length})
                    </span>
                  </div>
                  <div style={{ paddingLeft: '1.375rem' }}>
                    {(() => {
                      const byRole = {};
                      profile.staff.forEach(s => {
                        const role = s.role || 'Other';
                        if (!byRole[role]) byRole[role] = [];
                        byRole[role].push(s.name);
                      });
                      return Object.entries(byRole).map(([role, names], idx) => (
                        <div key={idx} style={{ marginBottom: '0.5rem' }}>
                          <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, textTransform: 'capitalize', marginBottom: '0.125rem' }}>
                            {role}
                          </p>
                          <p style={{ fontSize: '0.9375rem', color: COLORS.darkGray }}>
                            {names.join(', ')}
                          </p>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
