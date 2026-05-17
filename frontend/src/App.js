import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

function App() {
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false); // API 요청 후 첫 응답을 기다리는 상태
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const currentChat = chats.find(c => c.id === currentChatId) || { messages: [] };
  const messages = currentChat.messages;

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, isWaiting]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const createNewChat = () => {
    if (!isStreaming && !isWaiting) {
      setCurrentChatId(null);
      setInput('');
    }
  };

  const selectChat = (id) => {
    if (!isStreaming && !isWaiting) {
      setCurrentChatId(id);
      setInput('');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming || isWaiting) return;

    const currentInput = input;
    let targetChatId = currentChatId;
    let updatedChats = [...chats];
    
    // 이전 대화 내역 (history) 생성
    const history = targetChatId 
      ? updatedChats.find(c => c.id === targetChatId).messages.map(m => ({ role: m.role, content: m.content })) 
      : [];

    if (!targetChatId) {
      const newChat = {
        id: Date.now(),
        title: currentInput.slice(0, 15) + (currentInput.length > 15 ? '...' : ''),
        messages: []
      };
      targetChatId = newChat.id;
      updatedChats = [newChat, ...chats];
      setCurrentChatId(targetChatId);
    }

    const chatIndex = updatedChats.findIndex(c => c.id === targetChatId);
    const userMsg = { role: 'user', content: currentInput };
    
    updatedChats[chatIndex] = {
      ...updatedChats[chatIndex],
      messages: [...updatedChats[chatIndex].messages, userMsg, { role: 'assistant', content: '' }]
    };
    
    setChats(updatedChats);
    setInput('');
    setIsStreaming(true);
    setIsWaiting(true); // 요청 시작 시 대기 상태 활성화

    try {
      const response = await fetch('http://localhost:8000/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, history: history }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          // 첫 응답 조각을 받으면 대기 상태 해제
          if (isWaiting) setIsWaiting(false);
          
          const chunk = decoder.decode(value, { stream: true });
          setChats(prev => {
            const newChats = [...prev];
            const idx = newChats.findIndex(c => c.id === targetChatId);
            if (idx !== -1) {
              const chatToUpdate = {...newChats[idx]};
              const msgs = [...chatToUpdate.messages];
              msgs[msgs.length - 1].content += chunk;
              chatToUpdate.messages = msgs;
              newChats[idx] = chatToUpdate;
            }
            return newChats;
          });
        }
      }
    } catch (error) {
      console.error("API Error:", error);
    } finally {
      setIsStreaming(false);
      setIsWaiting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderMessageContent = (content, isCurrentMessageWaiting) => {
    // 응답 내용이 비어있고 대기 중일 때 로딩 애니메이션 표시
    if (!content && isCurrentMessageWaiting) {
      return (
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      );
    }

    const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    const hasThink = !!thinkMatch;
    
    let answerText = content;
    let thinkText = '';

    if (hasThink) {
      thinkText = thinkMatch[1];
      const endThinkIdx = content.indexOf('</think>');
      if (endThinkIdx !== -1) {
         answerText = content.substring(endThinkIdx + 8).trimStart();
      } else {
         answerText = ''; // 아직 생각 중
      }
    }

    return (
      <>
        {hasThink && (
          <details className="think-box" open={!content.includes('</think>')}>
            <summary className="think-summary">
              {content.includes('</think>') ? '🤔 생각 과정 접기/펴기' : '🤔 생각 중...'}
            </summary>
            <div className="think-content">
              <ReactMarkdown>{thinkText}</ReactMarkdown>
            </div>
          </details>
        )}
        {answerText && (
          <div className="answer-content">
            <ReactMarkdown>{answerText}</ReactMarkdown>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="app-container">
      {/* Sidebar Area */}
      <div className="sidebar">
        <button className="new-chat-button" onClick={createNewChat}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          새로운 대화
        </button>
        <div className="chat-list">
          {chats.map(chat => (
            <div 
              key={chat.id} 
              className={`chat-list-item ${currentChatId === chat.id ? 'active' : ''}`}
              onClick={() => selectChat(chat.id)}
            >
              {chat.title}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-container">
        <div className="chat-window">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h1>무엇을 도와드릴까요?</h1>
              <p>왼쪽 패널에서 새로운 대화를 시작하거나 이전 대화를 선택하세요.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`message-wrapper ${msg.role}`}>
                <div className="message-content">
                  <div className={`avatar ${msg.role}`}>
                    {msg.role === 'user' ? '나' : 'AI'}
                  </div>
                  <div className="text-content">
                    {msg.role === 'assistant' ? (
                      renderMessageContent(msg.content, isWaiting && idx === messages.length - 1)
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="input-box">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요..."
              disabled={isStreaming || isWaiting}
              rows={1}
            />
            <button 
              className="send-button" 
              onClick={sendMessage} 
              disabled={isStreaming || isWaiting || !input.trim()}
            >
              <svg className="send-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
