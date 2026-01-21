import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, Search, X, Menu } from 'lucide-react';
import { chatStorage } from '../../storage/chatStorage';
import COLORS from '../../utils/colors';

export function ChatSidebar({ currentChatId, onSelectChat, onNewChat, onDeleteChat }) {
  const [chats, setChats] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    loadChats();
  }, [currentChatId]);

  const loadChats = () => {
    const allChats = chatStorage.getAllChats();
    setChats(allChats);
  };

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group chats by date
  const groupedChats = groupChatsByDate(filteredChats);

  const handleDelete = (chatId, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation?')) {
      onDeleteChat(chatId);
      loadChats();
    }
  };

  return (
    <>
      {/* Sidebar */}
      <div
        style={{
          width: showSidebar ? '20rem' : '0',
          backgroundColor: COLORS.backgroundGray,
          borderRight: `1px solid ${COLORS.lightGray}`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '1rem', borderBottom: `1px solid ${COLORS.lightGray}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 600, color: COLORS.darkGray }}>Conversations</h3>
            <button
              onClick={() => setShowSidebar(false)}
              style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.lightGray}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X style={{ height: '1rem', width: '1rem', color: COLORS.mediumGray }} />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            style={{
              width: '100%',
              padding: '0.5rem 1rem',
              backgroundColor: COLORS.slainteBlue,
              color: COLORS.white,
              borderRadius: '0.5rem',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e40af'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
          >
            <Plus style={{ height: '1rem', width: '1rem' }} />
            New Chat
          </button>

          {/* Search */}
          <div style={{ marginTop: '0.75rem', position: 'relative' }}>
            <Search
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                height: '1rem',
                width: '1rem',
                color: COLORS.mediumGray
              }}
            />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '2.5rem',
                paddingRight: '0.75rem',
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem',
                border: `1px solid ${COLORS.lightGray}`,
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Chat List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {Object.entries(groupedChats).map(([group, groupChats]) => (
            <div key={group} style={{ marginBottom: '1rem' }}>
              <div style={{
                padding: '0.5rem 1rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: COLORS.mediumGray,
                textTransform: 'uppercase'
              }}>
                {group}
              </div>
              {groupChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    borderLeft: `4px solid ${chat.id === currentChatId ? COLORS.slainteBlue : 'transparent'}`,
                    backgroundColor: chat.id === currentChatId ? `${COLORS.slainteBlue}10` : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (chat.id !== currentChatId) {
                      e.currentTarget.style.backgroundColor = COLORS.lightGray;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (chat.id !== currentChatId) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        color: COLORS.darkGray,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {chat.title}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>
                        {chat.messages.length} messages
                        {chat.artifacts?.length > 0 && ` • ${chat.artifacts.length} artifacts`}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>
                        {formatTimestamp(chat.updated_at)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(chat.id, e)}
                      style={{
                        padding: '0.25rem',
                        background: 'none',
                        border: 'none',
                        borderRadius: '0.25rem',
                        color: COLORS.mediumGray,
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${COLORS.expenseColor}20`;
                        e.currentTarget.style.color = COLORS.expenseColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = COLORS.mediumGray;
                      }}
                    >
                      <Trash2 style={{ height: '1rem', width: '1rem' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {filteredChats.length === 0 && (
            <div style={{
              padding: '1rem',
              paddingTop: '2rem',
              paddingBottom: '2rem',
              textAlign: 'center',
              color: COLORS.mediumGray,
              fontSize: '0.875rem'
            }}>
              {searchTerm ? 'No chats found' : 'No conversations yet'}
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button (when sidebar hidden) */}
      {!showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          style={{
            position: 'absolute',
            left: '1rem',
            top: '1rem',
            padding: '0.5rem',
            backgroundColor: COLORS.white,
            border: `1px solid ${COLORS.lightGray}`,
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            zIndex: 10
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.white}
        >
          <Menu style={{ height: '1.25rem', width: '1.25rem', color: COLORS.mediumGray }} />
        </button>
      )}
    </>
  );
}

// Helper: Group chats by date
function groupChatsByDate(chats) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastMonth = new Date(today);
  lastMonth.setDate(lastMonth.getDate() - 30);

  const groups = {
    'Today': [],
    'Yesterday': [],
    'Last 7 Days': [],
    'Last 30 Days': [],
    'Older': [],
  };

  chats.forEach(chat => {
    const chatDate = new Date(chat.updated_at);

    if (chatDate >= today) {
      groups['Today'].push(chat);
    } else if (chatDate >= yesterday) {
      groups['Yesterday'].push(chat);
    } else if (chatDate >= lastWeek) {
      groups['Last 7 Days'].push(chat);
    } else if (chatDate >= lastMonth) {
      groups['Last 30 Days'].push(chat);
    } else {
      groups['Older'].push(chat);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) delete groups[key];
  });

  return groups;
}

// Helper: Format timestamp
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}
